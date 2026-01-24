/**
 * Agent Logger
 *
 * Handles per-agent audit logging with crash-safe append-only writes.
 * Logs each attempt and turn-by-turn interactions.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentName, AgentMetrics, PhaseName } from '../temporal/types';
import {
  AgentAttempt,
  AgentAuditRecord,
  TurnMessage,
  AttemptStatus,
} from './types';
import { logger } from '../utils/logger';

// ============================================================================
// Agent Logger Class
// ============================================================================

export class AgentLogger {
  private sessionId: string;
  private baseDir: string;
  private agentRecords: Map<AgentName, AgentAuditRecord> = new Map();

  constructor(sessionId: string, baseDir: string) {
    this.sessionId = sessionId;
    this.baseDir = baseDir;
  }

  // ==========================================================================
  // Directory Setup
  // ==========================================================================

  /**
   * Get agent directory path
   */
  private getAgentDir(agentName: AgentName): string {
    return path.join(this.baseDir, 'agents', agentName);
  }

  /**
   * Ensure agent directory exists
   */
  private async ensureAgentDir(agentName: AgentName): Promise<string> {
    const dir = this.getAgentDir(agentName);
    await fs.ensureDir(dir);
    await fs.ensureDir(path.join(dir, 'turn-by-turn'));
    return dir;
  }

  // ==========================================================================
  // Agent Lifecycle
  // ==========================================================================

  /**
   * Initialize agent record
   */
  async initAgent(agentName: AgentName, phase: PhaseName): Promise<void> {
    await this.ensureAgentDir(agentName);

    const record: AgentAuditRecord = {
      agentName,
      phase,
      status: 'pending',
      attempts: [],
    };

    this.agentRecords.set(agentName, record);

    logger.debug('Agent initialized for audit', { sessionId: this.sessionId, agentName });
  }

  /**
   * Start a new attempt for an agent
   */
  async startAttempt(
    agentName: AgentName,
    attemptNumber: number,
    checkpoint?: string
  ): Promise<void> {
    const record = this.agentRecords.get(agentName);
    if (!record) {
      throw new Error(`Agent ${agentName} not initialized`);
    }

    const attempt: AgentAttempt = {
      attemptNumber,
      status: 'started',
      startTime: new Date().toISOString(),
      checkpoint,
    };

    record.attempts.push(attempt);
    record.status = 'running';

    // Write attempt log file (append-only)
    await this.appendAttemptLog(agentName, attemptNumber, {
      event: 'attempt_started',
      timestamp: attempt.startTime,
      attemptNumber,
      checkpoint,
    });

    logger.info('Agent attempt started', {
      sessionId: this.sessionId,
      agentName,
      attemptNumber,
    });
  }

  /**
   * Complete an attempt successfully
   */
  async completeAttempt(
    agentName: AgentName,
    attemptNumber: number,
    metrics: AgentMetrics,
    commitHash?: string
  ): Promise<void> {
    const record = this.agentRecords.get(agentName);
    if (!record) return;

    const attempt = record.attempts.find(a => a.attemptNumber === attemptNumber);
    if (!attempt) return;

    attempt.status = 'completed';
    attempt.endTime = new Date().toISOString();
    attempt.durationMs = metrics.durationMs;
    attempt.costUsd = metrics.costUsd || undefined;
    attempt.inputTokens = metrics.inputTokens || undefined;
    attempt.outputTokens = metrics.outputTokens || undefined;
    attempt.numTurns = metrics.numTurns || undefined;
    attempt.model = metrics.model;
    attempt.commitHash = commitHash;

    record.status = 'completed';
    record.finalMetrics = metrics;

    await this.appendAttemptLog(agentName, attemptNumber, {
      event: 'attempt_completed',
      timestamp: attempt.endTime,
      metrics,
      commitHash,
    });

    logger.info('Agent attempt completed', {
      sessionId: this.sessionId,
      agentName,
      attemptNumber,
      durationMs: metrics.durationMs,
    });
  }

  /**
   * Fail an attempt
   */
  async failAttempt(
    agentName: AgentName,
    attemptNumber: number,
    error: string,
    willRetry: boolean
  ): Promise<void> {
    const record = this.agentRecords.get(agentName);
    if (!record) return;

    const attempt = record.attempts.find(a => a.attemptNumber === attemptNumber);
    if (!attempt) return;

    attempt.status = willRetry ? 'retrying' : 'failed';
    attempt.endTime = new Date().toISOString();
    attempt.error = error;

    if (!willRetry) {
      record.status = 'failed';
    }

    await this.appendAttemptLog(agentName, attemptNumber, {
      event: willRetry ? 'attempt_retrying' : 'attempt_failed',
      timestamp: attempt.endTime,
      error,
      willRetry,
    });

    logger.warn('Agent attempt failed', {
      sessionId: this.sessionId,
      agentName,
      attemptNumber,
      error,
      willRetry,
    });
  }

  /**
   * Skip an agent
   */
  async skipAgent(agentName: AgentName, reason: string): Promise<void> {
    const record = this.agentRecords.get(agentName);
    if (record) {
      record.status = 'skipped';
    }

    await this.appendAttemptLog(agentName, 0, {
      event: 'agent_skipped',
      timestamp: new Date().toISOString(),
      reason,
    });

    logger.info('Agent skipped', {
      sessionId: this.sessionId,
      agentName,
      reason,
    });
  }

  // ==========================================================================
  // Turn-by-Turn Logging
  // ==========================================================================

  /**
   * Log a turn in the conversation
   */
  async logTurn(
    agentName: AgentName,
    attemptNumber: number,
    turn: TurnMessage
  ): Promise<void> {
    const dir = this.getAgentDir(agentName);
    const turnFile = path.join(dir, 'turn-by-turn', `turn-${turn.turnNumber}.json`);

    // Atomic write via temp file
    const tempFile = `${turnFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(turn, null, 2));
    await fs.rename(tempFile, turnFile);
  }

  /**
   * Log multiple turns at once
   */
  async logTurns(
    agentName: AgentName,
    attemptNumber: number,
    turns: TurnMessage[]
  ): Promise<void> {
    for (const turn of turns) {
      await this.logTurn(agentName, attemptNumber, turn);
    }
  }

  // ==========================================================================
  // Append-Only Logging
  // ==========================================================================

  /**
   * Append to attempt log (crash-safe)
   */
  private async appendAttemptLog(
    agentName: AgentName,
    attemptNumber: number,
    entry: Record<string, unknown>
  ): Promise<void> {
    const dir = this.getAgentDir(agentName);
    const logFile = path.join(dir, `attempt-${attemptNumber}.log`);

    const line = JSON.stringify(entry) + '\n';

    // Append is atomic on most filesystems
    await fs.appendFile(logFile, line);
  }

  // ==========================================================================
  // Prompt Logging
  // ==========================================================================

  /**
   * Save the prompt used for an agent
   */
  async savePrompt(agentName: AgentName, prompt: string): Promise<void> {
    const promptsDir = path.join(this.baseDir, 'prompts');
    await fs.ensureDir(promptsDir);

    const promptFile = path.join(promptsDir, `${agentName}.md`);
    await fs.writeFile(promptFile, prompt);

    logger.debug('Prompt saved', { sessionId: this.sessionId, agentName });
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get all agent records
   */
  getAgentRecords(): Map<AgentName, AgentAuditRecord> {
    return this.agentRecords;
  }

  /**
   * Get specific agent record
   */
  getAgentRecord(agentName: AgentName): AgentAuditRecord | undefined {
    return this.agentRecords.get(agentName);
  }

  /**
   * Get agent metrics
   */
  getAgentMetrics(agentName: AgentName): AgentMetrics | undefined {
    return this.agentRecords.get(agentName)?.finalMetrics;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<AgentName, AgentMetrics> {
    const metrics: Record<string, AgentMetrics> = {};

    for (const [name, record] of this.agentRecords) {
      if (record.finalMetrics) {
        metrics[name] = record.finalMetrics;
      }
    }

    return metrics as Record<AgentName, AgentMetrics>;
  }
}
