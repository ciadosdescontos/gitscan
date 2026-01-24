/**
 * Temporal Activities for Pentest Pipeline
 *
 * Each activity wraps an agent execution with:
 * - Heartbeat monitoring
 * - Git checkpoints
 * - Validation
 * - Audit logging
 * - Claude SDK execution
 */

import { heartbeat, activityInfo } from '@temporalio/activity';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ActivityInput,
  AgentMetrics,
  AgentName,
  ExploitationDecision,
  VulnType,
  VulnerabilityFinding,
  HeartbeatInfo,
  PromptName,
  PhaseName,
} from './types';
import { logger } from '../utils/logger';
import {
  runStaticAnalysis,
  createCodeAnalysisDeliverable,
} from '../services/pentest.service';
import {
  runClaudePromptWithRetry,
  ExecutionContext,
} from '../ai/claude-executor';
import { loadPrompt, interpolatePrompt, PROMPT_TO_AGENT, PromptVariables } from '../ai/prompt-manager';
import { createAuditSession, AuditSessionManager } from '../audit';
import {
  checkExploitationDecision,
  validateSession,
  VulnType as ValidationVulnType,
} from '../validation';
import { AGENTS } from '../agents/definitions';

// ============================================================================
// Constants
// ============================================================================

const HEARTBEAT_INTERVAL_MS = 2000; // 2 seconds
const PENTEST_BASE_DIR = process.env.PENTEST_BASE_DIR || '/tmp/pentest';

// Audit sessions cache (per workflow)
const auditSessions = new Map<string, AuditSessionManager>();

// ============================================================================
// Audit Session Management
// ============================================================================

/**
 * Get or create audit session for a workflow
 */
async function getAuditSession(
  input: ActivityInput
): Promise<AuditSessionManager> {
  let session = auditSessions.get(input.workflowId);

  if (!session) {
    session = createAuditSession(
      input.workflowId,
      input.workflowId,
      input.webUrl,
      input.repoPath,
      input.userId,
      input.repositoryId,
      input.configPath
    );

    await session.initialize();
    auditSessions.set(input.workflowId, session);
  }

  return session;
}

/**
 * Clean up audit session on workflow completion
 */
async function cleanupAuditSession(workflowId: string): Promise<void> {
  auditSessions.delete(workflowId);
}

// ============================================================================
// Generic Agent Activity
// ============================================================================

/**
 * Generic activity runner for all agents
 * Handles heartbeat, logging, validation, and Claude execution
 */
async function runAgentActivity(
  agentName: AgentName,
  input: ActivityInput,
  promptName: PromptName
): Promise<AgentMetrics> {
  const startTime = Date.now();
  const info = activityInfo();
  const attemptNumber = info.attempt;
  const agentDef = AGENTS[agentName];

  logger.info(`Starting agent activity`, {
    agentName,
    workflowId: input.workflowId,
    attempt: attemptNumber,
    phase: agentDef.phase,
  });

  // Get audit session
  const auditSession = await getAuditSession(input);

  // Initialize agent for audit
  await auditSession.initAgent(agentName, agentDef.phase);

  // Start heartbeat loop
  const heartbeatInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const heartbeatInfo: HeartbeatInfo = {
      agent: agentName,
      elapsedSeconds: elapsed,
      attempt: attemptNumber,
    };
    heartbeat(heartbeatInfo);
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // Start agent attempt in audit
    await auditSession.startAgentAttempt(agentName, attemptNumber);

    // Get session directory
    const sessionDir = path.join(PENTEST_BASE_DIR, input.workflowId);
    await fs.ensureDir(path.join(sessionDir, 'deliverables'));

    // Build prompt variables
    const promptVariables: PromptVariables = {
      webUrl: input.webUrl,
      repoPath: sessionDir,
      MCP_SERVER: undefined,
    };

    // Load prompt template (includes variable interpolation)
    const prompt = await loadPrompt(
      promptName,
      promptVariables,
      undefined, // config - TODO: pass from input
      input.pipelineTestingMode
    );

    // Additional variables for context
    const variables = {
      targetUrl: input.webUrl,
      sourceDir: sessionDir,
      deliverablesDir: path.join(sessionDir, 'deliverables'),
      ...input.variables,
    };

    // Save prompt to audit
    await auditSession.savePrompt(agentName, prompt);

    // Create execution context
    const context: ExecutionContext = {
      sessionId: input.workflowId,
      agentName,
      promptName,
      sourceDir: sessionDir,
      webUrl: input.webUrl,
      prompt,
      variables,
    };

    // Execute with Claude SDK
    const result = await runClaudePromptWithRetry(context);

    if (!result.success) {
      // Agent failed
      await auditSession.failAgentAttempt(
        agentName,
        attemptNumber,
        result.error || 'Unknown error',
        false // No retry at activity level - Temporal handles retries
      );

      throw new Error(result.error || `Agent ${agentName} failed`);
    }

    // Complete agent in audit
    await auditSession.completeAgentAttempt(
      agentName,
      attemptNumber,
      result.metrics,
      result.commitHash
    );

    logger.info(`Agent activity completed`, {
      agentName,
      workflowId: input.workflowId,
      durationMs: result.metrics.durationMs,
      costUsd: result.metrics.costUsd,
    });

    return result.metrics;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(`Agent activity failed`, {
      agentName,
      workflowId: input.workflowId,
      attempt: attemptNumber,
      error: errorMessage,
    });

    // Log failure in audit (if not already logged)
    try {
      await auditSession.failAgentAttempt(
        agentName,
        attemptNumber,
        errorMessage,
        false
      );
    } catch {
      // Ignore audit errors on failure path
    }

    throw error;
  } finally {
    clearInterval(heartbeatInterval);
  }
}

// ============================================================================
// Phase 1: Pre-Recon Activity
// ============================================================================

/**
 * Pre-reconnaissance agent
 * - Runs static analysis via scanner-service
 * - Creates code_analysis_deliverable.md
 */
export async function runPreReconAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  const startTime = Date.now();
  const info = activityInfo();
  const attemptNumber = info.attempt;

  logger.info('Starting pre-recon agent', {
    workflowId: input.workflowId,
    attempt: attemptNumber,
  });

  // Get audit session
  const auditSession = await getAuditSession(input);
  await auditSession.initAgent('pre-recon', 'pre-recon');
  await auditSession.startAgentAttempt('pre-recon', attemptNumber);

  // Start heartbeat
  const heartbeatInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    heartbeat({ agent: 'pre-recon', elapsedSeconds: elapsed, attempt: attemptNumber });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // Get session directory
    const sessionDir = path.join(PENTEST_BASE_DIR, input.workflowId);
    await fs.ensureDir(path.join(sessionDir, 'deliverables'));

    // Run static analysis via scanner-service
    logger.info('Running static analysis', { workflowId: input.workflowId });

    const scanResult = await runStaticAnalysis(
      input.workflowId,
      input.repoPath, // clone URL
      input.branch || 'main',
      input.accessToken
    );

    // Create code analysis deliverable
    await createCodeAnalysisDeliverable(sessionDir, scanResult);

    const metrics: AgentMetrics = {
      durationMs: Date.now() - startTime,
      inputTokens: null,
      outputTokens: null,
      costUsd: 0, // Static analysis doesn't use LLM
      numTurns: null,
      model: 'scanner-service',
    };

    // Complete in audit
    await auditSession.completeAgentAttempt('pre-recon', attemptNumber, metrics);

    logger.info('Pre-recon agent completed', {
      workflowId: input.workflowId,
      vulnerabilities: scanResult.summary.total,
      durationMs: metrics.durationMs,
    });

    return metrics;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Pre-recon agent failed', {
      workflowId: input.workflowId,
      error: errorMessage,
    });

    await auditSession.failAgentAttempt('pre-recon', attemptNumber, errorMessage, false);
    throw error;
  } finally {
    clearInterval(heartbeatInterval);
  }
}

// ============================================================================
// Phase 2: Recon Activity
// ============================================================================

/**
 * Reconnaissance agent
 * - Maps attack surface
 * - Identifies endpoints, parameters, auth flows
 * - Creates attack_surface_deliverable.md
 */
export async function runReconAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('recon', input, 'recon');
}

// ============================================================================
// Phase 3: Vulnerability Analysis Activities
// ============================================================================

/**
 * Injection vulnerability analysis
 * - SQLi, Command Injection, LDAP Injection, etc.
 * - Creates injection_vulnerability_report.md
 * - Creates injection_exploitation_queue.json
 */
export async function runInjectionVulnAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('injection-vuln', input, 'vuln-injection');
}

/**
 * XSS vulnerability analysis
 * - Reflected, Stored, DOM-based XSS
 * - Creates xss_vulnerability_report.md
 * - Creates xss_exploitation_queue.json
 */
export async function runXssVulnAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('xss-vuln', input, 'vuln-xss');
}

/**
 * Authentication vulnerability analysis
 * - Weak passwords, session management, MFA bypass
 * - Creates auth_vulnerability_report.md
 * - Creates auth_exploitation_queue.json
 */
export async function runAuthVulnAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('auth-vuln', input, 'vuln-auth');
}

/**
 * SSRF vulnerability analysis
 * - Server-Side Request Forgery
 * - Creates ssrf_vulnerability_report.md
 * - Creates ssrf_exploitation_queue.json
 */
export async function runSsrfVulnAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('ssrf-vuln', input, 'vuln-ssrf');
}

/**
 * Authorization vulnerability analysis
 * - IDOR, privilege escalation, access control
 * - Creates authz_vulnerability_report.md
 * - Creates authz_exploitation_queue.json
 */
export async function runAuthzVulnAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('authz-vuln', input, 'vuln-authz');
}

// ============================================================================
// Phase 4: Exploitation Activities
// ============================================================================

/**
 * Injection exploitation
 * - Attempts to exploit found injection vulnerabilities
 * - Creates injection_exploitation_result.md
 */
export async function runInjectionExploitAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('injection-exploit', input, 'exploit-injection');
}

/**
 * XSS exploitation
 * - Attempts to exploit found XSS vulnerabilities
 * - Creates xss_exploitation_result.md
 */
export async function runXssExploitAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('xss-exploit', input, 'exploit-xss');
}

/**
 * Authentication exploitation
 * - Attempts to exploit found auth vulnerabilities
 * - Creates auth_exploitation_result.md
 */
export async function runAuthExploitAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('auth-exploit', input, 'exploit-auth');
}

/**
 * SSRF exploitation
 * - Attempts to exploit found SSRF vulnerabilities
 * - Creates ssrf_exploitation_result.md
 */
export async function runSsrfExploitAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('ssrf-exploit', input, 'exploit-ssrf');
}

/**
 * Authorization exploitation
 * - Attempts to exploit found authz vulnerabilities
 * - Creates authz_exploitation_result.md
 */
export async function runAuthzExploitAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('authz-exploit', input, 'exploit-authz');
}

// ============================================================================
// Phase 5: Reporting Activity
// ============================================================================

/**
 * Report generation agent
 * - Aggregates all findings and evidence
 * - Creates executive_report.md, technical_report.md, summary.json
 */
export async function runReportAgent(
  input: ActivityInput
): Promise<AgentMetrics> {
  return runAgentActivity('report', input, 'report-executive');
}

// ============================================================================
// Utility Activities
// ============================================================================

/**
 * Check exploitation queue to decide if exploit should run
 * Returns decision based on vulnerabilities found
 */
export async function checkExploitationQueueActivity(
  input: ActivityInput,
  vulnType: VulnType
): Promise<ExploitationDecision> {
  logger.info('Checking exploitation queue', {
    vulnType,
    workflowId: input.workflowId,
  });

  const sessionDir = path.join(PENTEST_BASE_DIR, input.workflowId);

  // Use the validation module's decision logic
  const decision = await checkExploitationDecision(
    sessionDir,
    vulnType as ValidationVulnType
  );

  logger.info('Exploitation queue checked', {
    vulnType,
    workflowId: input.workflowId,
    shouldExploit: decision.shouldExploit,
    reason: decision.reason,
    vulnerabilityCount: decision.vulnerabilityCount,
  });

  // Map ExploitationQueueItem to VulnerabilityFinding
  const vulnerabilities: VulnerabilityFinding[] = (decision.queue?.items || []).map(item => ({
    description: item.exploitStrategy || `Vulnerability ${item.vulnerabilityId}`,
    endpoint: item.targetEndpoint,
    parameter: undefined,
    type: item.type,
    severity: item.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
    proof: undefined,
    cweId: undefined,
  }));

  return {
    shouldExploit: decision.shouldExploit,
    vulnerabilityCount: decision.vulnerabilityCount,
    vulnerabilities,
  };
}

/**
 * Log phase transition for observability
 */
export async function logPhaseTransition(
  input: ActivityInput,
  fromPhase: PhaseName | null,
  toPhase: PhaseName,
  trigger: 'start' | 'agent_complete' | 'agent_failed' | 'all_complete'
): Promise<void> {
  const auditSession = await getAuditSession(input);

  await auditSession.logPhaseTransition(fromPhase, toPhase, trigger);

  logger.info(`Phase transition`, {
    workflowId: input.workflowId,
    fromPhase,
    toPhase,
    trigger,
  });
}

/**
 * Log workflow error
 */
export async function logWorkflowError(
  input: ActivityInput,
  error: string,
  details?: Record<string, unknown>
): Promise<void> {
  const auditSession = await getAuditSession(input);

  await auditSession.logError(error, details);

  logger.error(`Workflow error`, {
    workflowId: input.workflowId,
    error,
    details,
  });
}

/**
 * Log workflow completion
 */
export async function logWorkflowComplete(
  input: ActivityInput,
  success: boolean,
  summary?: Record<string, unknown>
): Promise<void> {
  const auditSession = await getAuditSession(input);

  await auditSession.complete(success, summary as any);

  // Clean up audit session from cache
  await cleanupAuditSession(input.workflowId);

  if (success) {
    logger.info(`Workflow completed successfully`, {
      workflowId: input.workflowId,
    });
  } else {
    logger.error(`Workflow failed`, {
      workflowId: input.workflowId,
    });
  }
}

/**
 * Cancel workflow
 */
export async function logWorkflowCancel(
  input: ActivityInput,
  reason?: string
): Promise<void> {
  const auditSession = await getAuditSession(input);

  await auditSession.logCancel(reason);

  // Clean up
  await cleanupAuditSession(input.workflowId);

  logger.info(`Workflow cancelled`, {
    workflowId: input.workflowId,
    reason,
  });
}

/**
 * Validate session deliverables
 */
export async function validateSessionDeliverables(
  input: ActivityInput
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const sessionDir = path.join(PENTEST_BASE_DIR, input.workflowId);

  const result = await validateSession(sessionDir);

  logger.info('Session validation completed', {
    workflowId: input.workflowId,
    valid: result.valid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
  });

  return {
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  };
}

/**
 * Skip an agent (for conditional execution)
 */
export async function skipAgent(
  input: ActivityInput,
  agentName: AgentName,
  reason: string
): Promise<void> {
  const auditSession = await getAuditSession(input);

  await auditSession.skipAgent(agentName, reason);

  logger.info('Agent skipped', {
    workflowId: input.workflowId,
    agentName,
    reason,
  });
}

/**
 * Assemble report metadata
 * Injects model info, costs, etc. into final report
 */
export async function injectReportMetadataActivity(
  input: ActivityInput,
  metrics: Record<AgentName, AgentMetrics>
): Promise<void> {
  logger.info(`Injecting report metadata`, {
    workflowId: input.workflowId,
    agentCount: Object.keys(metrics).length,
  });

  const sessionDir = path.join(PENTEST_BASE_DIR, input.workflowId);
  const summaryFile = path.join(sessionDir, 'deliverables', 'summary.json');

  // Calculate totals
  let totalCostUsd = 0;
  let totalDurationMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let agentCount = 0;
  let completedAgents = 0;
  let failedAgents = 0;

  for (const [name, m] of Object.entries(metrics)) {
    agentCount++;
    if (m.durationMs > 0) {
      completedAgents++;
      totalDurationMs += m.durationMs;
      totalCostUsd += m.costUsd || 0;
      totalInputTokens += m.inputTokens || 0;
      totalOutputTokens += m.outputTokens || 0;
    } else {
      failedAgents++;
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    workflowId: input.workflowId,
    webUrl: input.webUrl,
    totals: {
      costUsd: totalCostUsd,
      durationMs: totalDurationMs,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
    agents: {
      total: agentCount,
      completed: completedAgents,
      failed: failedAgents,
    },
    perAgent: metrics,
  };

  // Write summary file
  await fs.ensureDir(path.dirname(summaryFile));
  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));

  logger.info('Report metadata injected', {
    workflowId: input.workflowId,
    totalCostUsd,
    completedAgents,
  });
}

// ============================================================================
// Git Checkpoint Activities
// ============================================================================

/**
 * Create git checkpoint before agent execution
 */
export async function createGitCheckpoint(
  input: ActivityInput,
  agentName: AgentName
): Promise<string> {
  const { createCheckpoint } = await import('../agents/session-manager');

  const checkpointId = await createCheckpoint(input.workflowId, agentName);

  logger.info(`Git checkpoint created`, {
    workflowId: input.workflowId,
    agentName,
    checkpointId,
  });

  return checkpointId;
}

/**
 * Commit changes after successful agent execution
 */
export async function commitGitChanges(
  input: ActivityInput,
  agentName: AgentName,
  attemptNumber: number
): Promise<string> {
  const { commitChanges } = await import('../agents/session-manager');

  const commitHash = await commitChanges(input.workflowId, agentName, attemptNumber);

  logger.info(`Git changes committed`, {
    workflowId: input.workflowId,
    agentName,
    attemptNumber,
    commitHash,
  });

  return commitHash;
}

/**
 * Rollback to checkpoint after failed agent execution
 */
export async function rollbackGitCheckpoint(
  input: ActivityInput,
  agentName: AgentName
): Promise<void> {
  const { rollbackToCheckpoint } = await import('../agents/session-manager');

  await rollbackToCheckpoint(input.workflowId, agentName);

  logger.info(`Rolled back to checkpoint`, {
    workflowId: input.workflowId,
    agentName,
  });
}

// ============================================================================
// Archive Deliverables
// ============================================================================

/**
 * Archive deliverable to audit logs
 */
export async function archiveDeliverable(
  input: ActivityInput,
  filename: string,
  content: string
): Promise<void> {
  const auditSession = await getAuditSession(input);

  await auditSession.archiveDeliverable(filename, content);

  logger.debug('Deliverable archived', {
    workflowId: input.workflowId,
    filename,
  });
}
