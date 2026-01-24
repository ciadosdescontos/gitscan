/**
 * Temporal Workflows for Pentest Pipeline
 *
 * Main workflow: pentestPipelineWorkflow
 * Orchestrates 13 agents across 5 phases with pipelined execution
 */

import {
  proxyActivities,
  setHandler,
  defineQuery,
  defineSignal,
  condition,
  sleep,
  ApplicationFailure,
} from '@temporalio/workflow';
import type * as activities from './activities';
import {
  PipelineInput,
  PipelineState,
  PipelineProgress,
  PipelineSummary,
  AgentMetrics,
  AgentName,
  PhaseName,
  ActivityInput,
  ExploitationDecision,
  VulnType,
  PRODUCTION_RETRY_CONFIG,
  TESTING_RETRY_CONFIG,
} from './types';

// ============================================================================
// Activity Proxies
// ============================================================================

const {
  runPreReconAgent,
  runReconAgent,
  runInjectionVulnAgent,
  runXssVulnAgent,
  runAuthVulnAgent,
  runSsrfVulnAgent,
  runAuthzVulnAgent,
  runInjectionExploitAgent,
  runXssExploitAgent,
  runAuthExploitAgent,
  runSsrfExploitAgent,
  runAuthzExploitAgent,
  runReportAgent,
  checkExploitationQueue,
  logPhaseTransition,
  logWorkflowComplete,
  injectReportMetadataActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2h',
  heartbeatTimeout: '30s',
  retry: {
    initialInterval: '5m',
    maximumInterval: '30m',
    backoffCoefficient: 2,
    maximumAttempts: 50,
    nonRetryableErrorTypes: [
      'AuthenticationError',
      'PermissionError',
      'InvalidRequestError',
      'ConfigurationError',
      'InvalidTargetError',
    ],
  },
});

// ============================================================================
// Queries & Signals
// ============================================================================

export const getProgress = defineQuery<PipelineProgress>('getProgress');
export const getSummary = defineQuery<PipelineSummary | null>('getSummary');
export const cancelRequested = defineSignal('cancelRequested');

// ============================================================================
// Agent Phase Mapping
// ============================================================================

const AGENT_PHASE_MAP: Record<AgentName, PhaseName> = {
  'pre-recon': 'pre-recon',
  'recon': 'recon',
  'injection-vuln': 'vulnerability-analysis',
  'xss-vuln': 'vulnerability-analysis',
  'auth-vuln': 'vulnerability-analysis',
  'ssrf-vuln': 'vulnerability-analysis',
  'authz-vuln': 'vulnerability-analysis',
  'injection-exploit': 'exploitation',
  'xss-exploit': 'exploitation',
  'auth-exploit': 'exploitation',
  'ssrf-exploit': 'exploitation',
  'authz-exploit': 'exploitation',
  'report': 'reporting',
};

// ============================================================================
// Vuln Type Mapping
// ============================================================================

const VULN_TYPES: VulnType[] = ['injection', 'xss', 'auth', 'ssrf', 'authz'];

const VULN_AGENT_MAP: Record<VulnType, { vuln: AgentName; exploit: AgentName }> = {
  injection: { vuln: 'injection-vuln', exploit: 'injection-exploit' },
  xss: { vuln: 'xss-vuln', exploit: 'xss-exploit' },
  auth: { vuln: 'auth-vuln', exploit: 'auth-exploit' },
  ssrf: { vuln: 'ssrf-vuln', exploit: 'ssrf-exploit' },
  authz: { vuln: 'authz-vuln', exploit: 'authz-exploit' },
};

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Main pentest pipeline workflow
 *
 * Phases:
 * 1. Pre-Recon (sequential)
 * 2. Recon (sequential)
 * 3-4. Vuln + Exploit (pipelined parallel)
 * 5. Reporting (sequential)
 */
export async function pentestPipelineWorkflow(
  input: PipelineInput
): Promise<PipelineSummary> {
  // Initialize state
  const state: PipelineState = {
    status: 'running',
    currentPhase: null,
    currentAgent: null,
    completedAgents: [],
    failedAgent: null,
    skippedAgents: [],
    error: null,
    startTime: Date.now(),
    agentMetrics: {} as Record<AgentName, AgentMetrics>,
    summary: null,
  };

  // Cancellation flag
  let isCancelled = false;

  // Register cancel signal handler
  setHandler(cancelRequested, () => {
    isCancelled = true;
    state.status = 'cancelled';
  });

  // Register query handlers
  setHandler(getProgress, (): PipelineProgress => ({
    ...state,
    workflowId: input.repositoryId, // Use repositoryId as workflow identifier
    elapsedMs: Date.now() - state.startTime,
  }));

  setHandler(getSummary, (): PipelineSummary | null => state.summary);

  // Helper: Create activity input
  const createActivityInput = (): ActivityInput => ({
    ...input,
    workflowId: input.repositoryId,
  });

  // Helper: Update state for agent start
  const startAgent = (agent: AgentName) => {
    state.currentAgent = agent;
    state.currentPhase = AGENT_PHASE_MAP[agent];
  };

  // Helper: Update state for agent completion
  const completeAgent = (agent: AgentName, metrics: AgentMetrics) => {
    state.completedAgents.push(agent);
    state.agentMetrics[agent] = metrics;
    state.currentAgent = null;
  };

  // Helper: Update state for agent skip
  const skipAgent = (agent: AgentName) => {
    state.skippedAgents.push(agent);
  };

  // Helper: Check if cancelled
  const checkCancelled = () => {
    if (isCancelled) {
      throw ApplicationFailure.nonRetryable('Workflow cancelled by user');
    }
  };

  try {
    // ========================================================================
    // PHASE 1: Pre-Recon
    // ========================================================================
    await logPhaseTransition(input.repositoryId, null, 'pre-recon');
    checkCancelled();

    startAgent('pre-recon');
    const preReconMetrics = await runPreReconAgent(createActivityInput());
    completeAgent('pre-recon', preReconMetrics);

    // ========================================================================
    // PHASE 2: Recon
    // ========================================================================
    await logPhaseTransition(input.repositoryId, 'pre-recon', 'recon');
    checkCancelled();

    startAgent('recon');
    const reconMetrics = await runReconAgent(createActivityInput());
    completeAgent('recon', reconMetrics);

    // ========================================================================
    // PHASES 3-4: Vulnerability Analysis + Exploitation (Pipelined Parallel)
    // ========================================================================
    await logPhaseTransition(input.repositoryId, 'recon', 'vulnerability-analysis');

    // Create pipeline for each vulnerability type
    const pipelinePromises = VULN_TYPES.map(async (vulnType) => {
      checkCancelled();

      const agents = VULN_AGENT_MAP[vulnType];
      const activityInput = createActivityInput();

      // Run vulnerability analysis
      startAgent(agents.vuln);
      let vulnMetrics: AgentMetrics;

      switch (vulnType) {
        case 'injection':
          vulnMetrics = await runInjectionVulnAgent(activityInput);
          break;
        case 'xss':
          vulnMetrics = await runXssVulnAgent(activityInput);
          break;
        case 'auth':
          vulnMetrics = await runAuthVulnAgent(activityInput);
          break;
        case 'ssrf':
          vulnMetrics = await runSsrfVulnAgent(activityInput);
          break;
        case 'authz':
          vulnMetrics = await runAuthzVulnAgent(activityInput);
          break;
      }

      completeAgent(agents.vuln, vulnMetrics);

      // Check if exploitation should run
      const decision: ExploitationDecision = await checkExploitationQueue(
        activityInput,
        vulnType
      );

      if (!decision.shouldExploit) {
        skipAgent(agents.exploit);
        return;
      }

      // Run exploitation
      checkCancelled();
      startAgent(agents.exploit);
      let exploitMetrics: AgentMetrics;

      switch (vulnType) {
        case 'injection':
          exploitMetrics = await runInjectionExploitAgent(activityInput);
          break;
        case 'xss':
          exploitMetrics = await runXssExploitAgent(activityInput);
          break;
        case 'auth':
          exploitMetrics = await runAuthExploitAgent(activityInput);
          break;
        case 'ssrf':
          exploitMetrics = await runSsrfExploitAgent(activityInput);
          break;
        case 'authz':
          exploitMetrics = await runAuthzExploitAgent(activityInput);
          break;
      }

      completeAgent(agents.exploit, exploitMetrics);
    });

    // Wait for all pipelines to complete (graceful failure handling)
    const pipelineResults = await Promise.allSettled(pipelinePromises);

    // Check for any failures
    const failures = pipelineResults.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    if (failures.length > 0) {
      // Log failures but continue to reporting
      for (const failure of failures) {
        console.warn('Pipeline failure:', failure.reason);
      }
    }

    // ========================================================================
    // PHASE 5: Reporting
    // ========================================================================
    await logPhaseTransition(input.repositoryId, 'exploitation', 'reporting');
    checkCancelled();

    startAgent('report');
    const reportMetrics = await runReportAgent(createActivityInput());
    completeAgent('report', reportMetrics);

    // Inject metadata into report
    await injectReportMetadataActivity(createActivityInput(), state.agentMetrics);

    // ========================================================================
    // Compute Summary
    // ========================================================================
    const summary = computeSummary(state);
    state.summary = summary;
    state.status = 'completed';
    state.currentPhase = null;

    await logWorkflowComplete(input.repositoryId, true);

    return summary;
  } catch (error) {
    state.status = 'failed';
    state.error = error instanceof Error ? error.message : String(error);
    state.failedAgent = state.currentAgent;

    await logWorkflowComplete(input.repositoryId, false, state.error);

    throw error;
  }
}

// ============================================================================
// Summary Computation
// ============================================================================

function computeSummary(state: PipelineState): PipelineSummary {
  const metrics = Object.values(state.agentMetrics);

  const totalCostUsd = metrics.reduce(
    (sum, m) => sum + (m.costUsd || 0),
    0
  );

  const totalDurationMs = Date.now() - state.startTime;

  // Count vulnerabilities from queue files (TODO: implement actual counting)
  const vulnerabilitiesFound = 0;
  const exploitsSuccessful = 0;

  return {
    totalCostUsd,
    totalDurationMs,
    agentCount: 13,
    completedAgents: state.completedAgents.length,
    failedAgents: state.failedAgent ? 1 : 0,
    skippedAgents: state.skippedAgents.length,
    vulnerabilitiesFound,
    exploitsSuccessful,
  };
}
