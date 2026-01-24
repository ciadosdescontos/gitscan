/**
 * Workflow Logger
 *
 * Handles workflow-level audit logging including phase transitions
 * and overall workflow events.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentName, PhaseName } from '../temporal/types';
import { PhaseTransition, WorkflowEvent } from './types';
import { logger } from '../utils/logger';

// ============================================================================
// Workflow Logger Class
// ============================================================================

export class WorkflowLogger {
  private sessionId: string;
  private baseDir: string;
  private logFile: string;
  private phaseTransitions: PhaseTransition[] = [];
  private events: WorkflowEvent[] = [];

  constructor(sessionId: string, baseDir: string) {
    this.sessionId = sessionId;
    this.baseDir = baseDir;
    this.logFile = path.join(baseDir, 'workflow.log');
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize workflow log
   */
  async init(): Promise<void> {
    await fs.ensureDir(this.baseDir);

    // Write header
    const header = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      type: 'workflow_log',
    };

    await this.appendLog(header);

    logger.debug('Workflow logger initialized', { sessionId: this.sessionId });
  }

  // ==========================================================================
  // Phase Transitions
  // ==========================================================================

  /**
   * Log phase transition
   */
  async logPhaseTransition(
    fromPhase: PhaseName | null,
    toPhase: PhaseName,
    trigger: PhaseTransition['trigger']
  ): Promise<void> {
    const transition: PhaseTransition = {
      timestamp: new Date().toISOString(),
      fromPhase,
      toPhase,
      trigger,
    };

    this.phaseTransitions.push(transition);

    await this.appendLog({
      type: 'phase_transition',
      ...transition,
    });

    logger.info('Phase transition', {
      sessionId: this.sessionId,
      fromPhase,
      toPhase,
      trigger,
    });
  }

  /**
   * Log phase start
   */
  async logPhaseStart(phase: PhaseName): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      type: 'phase_start',
      phase,
      message: `Phase ${phase} started`,
    });
  }

  /**
   * Log phase end
   */
  async logPhaseEnd(phase: PhaseName, success: boolean): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      type: 'phase_end',
      phase,
      message: `Phase ${phase} ${success ? 'completed' : 'failed'}`,
      details: { success },
    });
  }

  // ==========================================================================
  // Agent Events
  // ==========================================================================

  /**
   * Log agent start
   */
  async logAgentStart(agent: AgentName, phase: PhaseName): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      type: 'agent_start',
      phase,
      agent,
      message: `Agent ${agent} started`,
    });
  }

  /**
   * Log agent end
   */
  async logAgentEnd(
    agent: AgentName,
    phase: PhaseName,
    success: boolean,
    durationMs?: number,
    error?: string
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      type: 'agent_end',
      phase,
      agent,
      message: `Agent ${agent} ${success ? 'completed' : 'failed'}`,
      details: {
        success,
        durationMs,
        error,
      },
    });
  }

  // ==========================================================================
  // Workflow Events
  // ==========================================================================

  /**
   * Log generic event
   */
  async logEvent(event: WorkflowEvent): Promise<void> {
    this.events.push(event);
    await this.appendLog(event as unknown as Record<string, unknown>);
  }

  /**
   * Log error
   */
  async logError(error: string, details?: Record<string, unknown>): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: error,
      details,
    });

    logger.error('Workflow error', {
      sessionId: this.sessionId,
      error,
      details,
    });
  }

  /**
   * Log cancellation
   */
  async logCancel(reason?: string): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      type: 'cancel',
      message: 'Workflow cancelled',
      details: { reason },
    });

    logger.info('Workflow cancelled', {
      sessionId: this.sessionId,
      reason,
    });
  }

  /**
   * Log completion
   */
  async logComplete(success: boolean, summary?: Record<string, unknown>): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      type: 'complete',
      message: `Workflow ${success ? 'completed successfully' : 'failed'}`,
      details: {
        success,
        ...summary,
      },
    });

    logger.info('Workflow complete', {
      sessionId: this.sessionId,
      success,
    });
  }

  // ==========================================================================
  // Append-Only Logging
  // ==========================================================================

  /**
   * Append to workflow log (crash-safe)
   */
  private async appendLog(entry: Record<string, unknown>): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.logFile, line);
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get phase transitions
   */
  getPhaseTransitions(): PhaseTransition[] {
    return [...this.phaseTransitions];
  }

  /**
   * Get events
   */
  getEvents(): WorkflowEvent[] {
    return [...this.events];
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): PhaseName | null {
    if (this.phaseTransitions.length === 0) return null;
    return this.phaseTransitions[this.phaseTransitions.length - 1].toPhase;
  }
}
