/**
 * Audit Session
 *
 * Main facade for the audit system. Coordinates agent and workflow
 * logging with crash-safe persistence.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { AgentName, AgentMetrics, PhaseName } from '../temporal/types';
import {
  SessionMetadata,
  SessionSummary,
  AuditSession,
  AuditPaths,
  TurnMessage,
} from './types';
import { AgentLogger } from './agent-logger';
import { WorkflowLogger } from './workflow-logger';
import { logger } from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const AUDIT_BASE_DIR = process.env.AUDIT_LOG_DIR || path.join(os.tmpdir(), 'gitscan-audit');

// ============================================================================
// Audit Session Manager
// ============================================================================

export class AuditSessionManager {
  private metadata: SessionMetadata;
  private paths: AuditPaths;
  private agentLogger: AgentLogger;
  private workflowLogger: WorkflowLogger;
  private initialized: boolean = false;
  private finalStatus: AuditSession['finalStatus'] = 'running';

  constructor(metadata: Omit<SessionMetadata, 'startTime'>) {
    this.metadata = {
      ...metadata,
      startTime: new Date().toISOString(),
    };

    // Generate unique directory name
    const hostname = os.hostname().replace(/[^a-zA-Z0-9]/g, '-');
    const dirName = `${hostname}_${metadata.sessionId}`;

    this.paths = {
      baseDir: path.join(AUDIT_BASE_DIR, dirName),
      sessionFile: path.join(AUDIT_BASE_DIR, dirName, 'session.json'),
      workflowLog: path.join(AUDIT_BASE_DIR, dirName, 'workflow.log'),
      promptsDir: path.join(AUDIT_BASE_DIR, dirName, 'prompts'),
      agentsDir: path.join(AUDIT_BASE_DIR, dirName, 'agents'),
      deliverablesDir: path.join(AUDIT_BASE_DIR, dirName, 'deliverables'),
    };

    this.agentLogger = new AgentLogger(metadata.sessionId, this.paths.baseDir);
    this.workflowLogger = new WorkflowLogger(metadata.sessionId, this.paths.baseDir);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize audit session
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create directory structure
    await fs.ensureDir(this.paths.baseDir);
    await fs.ensureDir(this.paths.promptsDir);
    await fs.ensureDir(this.paths.agentsDir);
    await fs.ensureDir(this.paths.deliverablesDir);

    // Initialize workflow logger
    await this.workflowLogger.init();

    // Write initial session file
    await this.saveSession();

    this.initialized = true;

    logger.info('Audit session initialized', {
      sessionId: this.metadata.sessionId,
      path: this.paths.baseDir,
    });
  }

  // ==========================================================================
  // Agent Operations (Delegated)
  // ==========================================================================

  /**
   * Initialize an agent for logging
   */
  async initAgent(agentName: AgentName, phase: PhaseName): Promise<void> {
    await this.agentLogger.initAgent(agentName, phase);
  }

  /**
   * Start an agent attempt
   */
  async startAgentAttempt(
    agentName: AgentName,
    attemptNumber: number,
    checkpoint?: string
  ): Promise<void> {
    await this.agentLogger.startAttempt(agentName, attemptNumber, checkpoint);
    await this.workflowLogger.logAgentStart(
      agentName,
      this.workflowLogger.getCurrentPhase() || 'pre-recon'
    );
  }

  /**
   * Complete an agent attempt
   */
  async completeAgentAttempt(
    agentName: AgentName,
    attemptNumber: number,
    metrics: AgentMetrics,
    commitHash?: string
  ): Promise<void> {
    await this.agentLogger.completeAttempt(agentName, attemptNumber, metrics, commitHash);
    await this.workflowLogger.logAgentEnd(
      agentName,
      this.workflowLogger.getCurrentPhase() || 'pre-recon',
      true,
      metrics.durationMs
    );
    await this.saveSession();
  }

  /**
   * Fail an agent attempt
   */
  async failAgentAttempt(
    agentName: AgentName,
    attemptNumber: number,
    error: string,
    willRetry: boolean
  ): Promise<void> {
    await this.agentLogger.failAttempt(agentName, attemptNumber, error, willRetry);

    if (!willRetry) {
      await this.workflowLogger.logAgentEnd(
        agentName,
        this.workflowLogger.getCurrentPhase() || 'pre-recon',
        false,
        undefined,
        error
      );
    }

    await this.saveSession();
  }

  /**
   * Skip an agent
   */
  async skipAgent(agentName: AgentName, reason: string): Promise<void> {
    await this.agentLogger.skipAgent(agentName, reason);
    await this.saveSession();
  }

  /**
   * Log turn for an agent
   */
  async logTurn(
    agentName: AgentName,
    attemptNumber: number,
    turn: TurnMessage
  ): Promise<void> {
    await this.agentLogger.logTurn(agentName, attemptNumber, turn);
  }

  /**
   * Save prompt for an agent
   */
  async savePrompt(agentName: AgentName, prompt: string): Promise<void> {
    await this.agentLogger.savePrompt(agentName, prompt);
  }

  // ==========================================================================
  // Workflow Operations (Delegated)
  // ==========================================================================

  /**
   * Log phase transition
   */
  async logPhaseTransition(
    fromPhase: PhaseName | null,
    toPhase: PhaseName,
    trigger: 'start' | 'agent_complete' | 'agent_failed' | 'all_complete'
  ): Promise<void> {
    await this.workflowLogger.logPhaseTransition(fromPhase, toPhase, trigger);
    await this.saveSession();
  }

  /**
   * Log phase start
   */
  async logPhaseStart(phase: PhaseName): Promise<void> {
    await this.workflowLogger.logPhaseStart(phase);
  }

  /**
   * Log phase end
   */
  async logPhaseEnd(phase: PhaseName, success: boolean): Promise<void> {
    await this.workflowLogger.logPhaseEnd(phase, success);
  }

  /**
   * Log error
   */
  async logError(error: string, details?: Record<string, unknown>): Promise<void> {
    await this.workflowLogger.logError(error, details);
    await this.saveSession();
  }

  /**
   * Log cancellation
   */
  async logCancel(reason?: string): Promise<void> {
    this.finalStatus = 'cancelled';
    await this.workflowLogger.logCancel(reason);
    await this.saveSession();
  }

  // ==========================================================================
  // Session Finalization
  // ==========================================================================

  /**
   * Complete the audit session
   */
  async complete(success: boolean, summary?: SessionSummary): Promise<void> {
    this.finalStatus = success ? 'completed' : 'failed';

    await this.workflowLogger.logComplete(success, summary as unknown as Record<string, unknown>);
    await this.saveSession(summary);

    logger.info('Audit session completed', {
      sessionId: this.metadata.sessionId,
      success,
      path: this.paths.baseDir,
    });
  }

  // ==========================================================================
  // Session Persistence
  // ==========================================================================

  /**
   * Save session to JSON file (atomic write)
   */
  private async saveSession(summary?: SessionSummary): Promise<void> {
    const session: AuditSession = {
      metadata: this.metadata,
      agents: Object.fromEntries(this.agentLogger.getAgentRecords()) as Record<AgentName, any>,
      phaseTransitions: this.workflowLogger.getPhaseTransitions(),
      events: this.workflowLogger.getEvents(),
      summary,
      endTime: this.finalStatus !== 'running' ? new Date().toISOString() : undefined,
      finalStatus: this.finalStatus,
    };

    // Atomic write via temp file
    const tempFile = `${this.paths.sessionFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(session, null, 2));
    await fs.rename(tempFile, this.paths.sessionFile);
  }

  // ==========================================================================
  // Deliverables
  // ==========================================================================

  /**
   * Copy deliverable to audit logs
   */
  async archiveDeliverable(filename: string, content: string): Promise<void> {
    const destPath = path.join(this.paths.deliverablesDir, filename);
    await fs.writeFile(destPath, content);

    logger.debug('Deliverable archived', {
      sessionId: this.metadata.sessionId,
      filename,
    });
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get session metadata
   */
  getMetadata(): SessionMetadata {
    return { ...this.metadata };
  }

  /**
   * Get audit paths
   */
  getPaths(): AuditPaths {
    return { ...this.paths };
  }

  /**
   * Get all agent metrics
   */
  getAllMetrics(): Record<AgentName, AgentMetrics> {
    return this.agentLogger.getAllMetrics();
  }

  /**
   * Get agent record
   */
  getAgentRecord(agentName: AgentName) {
    return this.agentLogger.getAgentRecord(agentName);
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new audit session
 */
export function createAuditSession(
  sessionId: string,
  workflowId: string,
  webUrl: string,
  repoPath: string,
  userId: string,
  repositoryId: string,
  configPath?: string
): AuditSessionManager {
  return new AuditSessionManager({
    sessionId,
    workflowId,
    webUrl,
    repoPath,
    userId,
    repositoryId,
    configPath,
  });
}

// ============================================================================
// Export Base Directory
// ============================================================================

export { AUDIT_BASE_DIR };
