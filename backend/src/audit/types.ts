/**
 * Audit System Types
 *
 * Types for crash-safe audit logging
 */

import { AgentName, AgentMetrics, PhaseName } from '../temporal/types';

// ============================================================================
// Session Types
// ============================================================================

export interface SessionMetadata {
  sessionId: string;
  workflowId: string;
  startTime: string;
  webUrl: string;
  repoPath: string;
  configPath?: string;
  userId: string;
  repositoryId: string;
}

export interface SessionSummary {
  totalCostUsd: number;
  totalDurationMs: number;
  agentCount: number;
  completedAgents: number;
  failedAgents: number;
  skippedAgents: number;
  vulnerabilitiesFound: number;
  exploitsSuccessful: number;
}

// ============================================================================
// Agent Audit Types
// ============================================================================

export type AttemptStatus = 'started' | 'completed' | 'failed' | 'retrying';

export interface AgentAttempt {
  attemptNumber: number;
  status: AttemptStatus;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  numTurns?: number;
  model?: string;
  checkpoint?: string;
  commitHash?: string;
  error?: string;
}

export interface AgentAuditRecord {
  agentName: AgentName;
  phase: PhaseName;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  attempts: AgentAttempt[];
  finalMetrics?: AgentMetrics;
}

// ============================================================================
// Turn-by-Turn Logging
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface TurnMessage {
  turnNumber: number;
  timestamp: string;
  role: MessageRole;
  content: string;
  toolUse?: {
    name: string;
    input: unknown;
  };
  toolResult?: {
    name: string;
    output: unknown;
    error?: string;
  };
  tokenCount?: number;
}

// ============================================================================
// Workflow Audit Types
// ============================================================================

export interface PhaseTransition {
  timestamp: string;
  fromPhase: PhaseName | null;
  toPhase: PhaseName;
  trigger: 'start' | 'agent_complete' | 'agent_failed' | 'all_complete';
}

export interface WorkflowEvent {
  timestamp: string;
  type: 'phase_start' | 'phase_end' | 'agent_start' | 'agent_end' | 'error' | 'cancel' | 'complete';
  phase?: PhaseName;
  agent?: AgentName;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Full Audit Session
// ============================================================================

export interface AuditSession {
  metadata: SessionMetadata;
  agents: Record<AgentName, AgentAuditRecord>;
  phaseTransitions: PhaseTransition[];
  events: WorkflowEvent[];
  summary?: SessionSummary;
  endTime?: string;
  finalStatus: 'running' | 'completed' | 'failed' | 'cancelled';
}

// ============================================================================
// File Paths
// ============================================================================

export interface AuditPaths {
  baseDir: string;
  sessionFile: string;
  workflowLog: string;
  promptsDir: string;
  agentsDir: string;
  deliverablesDir: string;
}
