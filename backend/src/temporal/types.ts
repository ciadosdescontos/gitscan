/**
 * Temporal Workflow Types for Pentest Pipeline
 *
 * Defines all types, interfaces, and enums for the Shannon-style
 * pentest orchestration system.
 */

// ============================================================================
// Agent Types
// ============================================================================

export type AgentName =
  | 'pre-recon'
  | 'recon'
  | 'injection-vuln'
  | 'xss-vuln'
  | 'auth-vuln'
  | 'ssrf-vuln'
  | 'authz-vuln'
  | 'injection-exploit'
  | 'xss-exploit'
  | 'auth-exploit'
  | 'ssrf-exploit'
  | 'authz-exploit'
  | 'report';

export type PhaseName =
  | 'pre-recon'
  | 'recon'
  | 'vulnerability-analysis'
  | 'exploitation'
  | 'reporting';

export type VulnType =
  | 'injection'
  | 'xss'
  | 'auth'
  | 'ssrf'
  | 'authz';

export type PromptName =
  | 'pre-recon-code'
  | 'recon'
  | 'vuln-injection'
  | 'vuln-xss'
  | 'vuln-auth'
  | 'vuln-ssrf'
  | 'vuln-authz'
  | 'exploit-injection'
  | 'exploit-xss'
  | 'exploit-auth'
  | 'exploit-ssrf'
  | 'exploit-authz'
  | 'report-executive';

// ============================================================================
// Agent Definition
// ============================================================================

export interface AgentDefinition {
  name: AgentName;
  displayName: string;
  description: string;
  phase: PhaseName;
  prerequisites: AgentName[];
  promptName: PromptName;
  mcpServer: string;
  validator: string;
  deliverables: string[];
}

// ============================================================================
// Pipeline Input/Output
// ============================================================================

export interface PipelineInput {
  webUrl: string;
  repoPath: string;
  repositoryId: string;
  userId: string;
  branch?: string;
  configPath?: string;
  pipelineTestingMode?: boolean;
}

export interface ActivityInput extends PipelineInput {
  workflowId: string;
  outputPath?: string;
  accessToken?: string;
  variables?: Record<string, string>;
}

export interface AgentMetrics {
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  numTurns: number | null;
  model?: string;
}

export interface PipelineSummary {
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
// Pipeline State
// ============================================================================

export type PipelineStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PipelineState {
  status: PipelineStatus;
  currentPhase: PhaseName | null;
  currentAgent: AgentName | null;
  completedAgents: AgentName[];
  failedAgent: AgentName | null;
  skippedAgents: AgentName[];
  error: string | null;
  startTime: number;
  agentMetrics: Record<AgentName, AgentMetrics>;
  summary: PipelineSummary | null;
}

export interface PipelineProgress extends PipelineState {
  workflowId: string;
  elapsedMs: number;
}

// ============================================================================
// Exploitation Queue
// ============================================================================

export interface VulnerabilityFinding {
  description: string;
  endpoint: string;
  parameter?: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  proof?: string;
  cweId?: string;
}

export interface ExploitationQueue {
  vulnerabilities: VulnerabilityFinding[];
}

export interface ExploitationDecision {
  shouldExploit: boolean;
  vulnerabilityCount: number;
  vulnerabilities: VulnerabilityFinding[];
}

// ============================================================================
// Configuration
// ============================================================================

export type RuleType =
  | 'path'
  | 'domain'
  | 'subdomain'
  | 'method'
  | 'header'
  | 'parameter';

export interface Rule {
  type: RuleType;
  description: string;
  url_path?: string;
  domain?: string;
  subdomain?: string;
  method?: string;
  header?: string;
  parameter?: string;
}

export type LoginType = 'form' | 'sso' | 'api' | 'basic';

export interface Credentials {
  username: string;
  password: string;
  totp_secret?: string;
}

export interface SuccessCondition {
  type: 'redirect' | 'element' | 'cookie';
  value: string;
}

export interface Authentication {
  login_type: LoginType;
  login_url: string;
  credentials: Credentials;
  login_flow: string[];
  success_condition: SuccessCondition;
}

export interface PentestConfig {
  rules?: {
    avoid?: Rule[];
    focus?: Rule[];
  };
  authentication?: Authentication;
}

export interface DistributedConfig {
  avoid: Rule[];
  focus: Rule[];
  authentication: Authentication | null;
}

// ============================================================================
// Audit Types
// ============================================================================

export interface AgentAttempt {
  attemptNumber: number;
  status: AgentStatus;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  costUsd?: number;
  model?: string;
  checkpoint?: string;
  error?: string;
}

export interface AgentAuditEntry {
  agentName: AgentName;
  status: AgentStatus;
  attempts: AgentAttempt[];
}

export interface SessionMetadata {
  sessionId: string;
  startTime: string;
  webUrl: string;
  repoPath: string;
  configPath?: string;
}

export interface AuditSession {
  metadata: SessionMetadata;
  agents: Record<AgentName, AgentAuditEntry>;
  summary?: PipelineSummary;
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorType =
  | 'network'
  | 'rate_limit'
  | 'server'
  | 'billing'
  | 'authentication'
  | 'permission'
  | 'invalid_request'
  | 'configuration'
  | 'invalid_target'
  | 'validation'
  | 'unknown';

export interface PentestError extends Error {
  type: ErrorType;
  retryable: boolean;
  agentName?: AgentName;
  attemptNumber?: number;
}

export interface TemporalErrorClassification {
  type: ErrorType;
  retryable: boolean;
  message: string;
}

// ============================================================================
// Heartbeat
// ============================================================================

export interface HeartbeatInfo {
  agent: AgentName;
  elapsedSeconds: number;
  attempt: number;
}

// ============================================================================
// MCP Server Mapping
// ============================================================================

export type PlaywrightAgent =
  | 'playwright-agent1'
  | 'playwright-agent2'
  | 'playwright-agent3'
  | 'playwright-agent4'
  | 'playwright-agent5';

export const MCP_AGENT_MAPPING: Record<PromptName, PlaywrightAgent> = {
  'pre-recon-code': 'playwright-agent1',
  'recon': 'playwright-agent2',
  'vuln-injection': 'playwright-agent1',
  'vuln-xss': 'playwright-agent2',
  'vuln-auth': 'playwright-agent3',
  'vuln-ssrf': 'playwright-agent4',
  'vuln-authz': 'playwright-agent5',
  'exploit-injection': 'playwright-agent1',
  'exploit-xss': 'playwright-agent2',
  'exploit-auth': 'playwright-agent3',
  'exploit-ssrf': 'playwright-agent4',
  'exploit-authz': 'playwright-agent5',
  'report-executive': 'playwright-agent3',
};

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryConfig {
  initialIntervalMs: number;
  maximumIntervalMs: number;
  backoffCoefficient: number;
  maximumAttempts: number;
  nonRetryableErrorTypes: ErrorType[];
}

export const PRODUCTION_RETRY_CONFIG: RetryConfig = {
  initialIntervalMs: 5 * 60 * 1000,      // 5 minutes
  maximumIntervalMs: 30 * 60 * 1000,     // 30 minutes
  backoffCoefficient: 2,
  maximumAttempts: 50,
  nonRetryableErrorTypes: [
    'authentication',
    'permission',
    'invalid_request',
    'configuration',
    'invalid_target',
  ],
};

export const TESTING_RETRY_CONFIG: RetryConfig = {
  initialIntervalMs: 10 * 1000,          // 10 seconds
  maximumIntervalMs: 30 * 1000,          // 30 seconds
  backoffCoefficient: 2,
  maximumAttempts: 5,
  nonRetryableErrorTypes: [
    'authentication',
    'permission',
    'invalid_request',
    'configuration',
    'invalid_target',
  ],
};
