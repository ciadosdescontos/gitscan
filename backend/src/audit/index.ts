/**
 * Audit System Module Exports
 *
 * Provides crash-safe audit logging for pentest workflows
 */

// Main session manager
export {
  AuditSessionManager,
  createAuditSession,
  AUDIT_BASE_DIR,
} from './audit-session';

// Agent logging
export { AgentLogger } from './agent-logger';

// Workflow logging
export { WorkflowLogger } from './workflow-logger';

// Types
export type {
  SessionMetadata,
  SessionSummary,
  AttemptStatus,
  AgentAttempt,
  AgentAuditRecord,
  MessageRole,
  TurnMessage,
  PhaseTransition,
  WorkflowEvent,
  AuditSession,
  AuditPaths,
} from './types';
