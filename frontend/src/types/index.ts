// User types
export interface User {
  id: string;
  githubId: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  defaultLlmProvider: LlmProvider;
  plan: PlanType;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
  lastLoginAt: string;
}

// Subscription types
export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';

export interface SubscriptionInfo {
  plan: PlanType;
  status: SubscriptionStatus;
  expiresAt?: string;
  usage: {
    scans: UsageInfo;
    repositories: UsageInfo;
    fixes: UsageInfo;
  };
  features: {
    prioritySupport: boolean;
    customScanners: boolean;
    apiAccess: boolean;
  };
  usageResetAt: string;
}

export interface UsageInfo {
  used: number;
  limit: number;
  unlimited: boolean;
}

// Repository types
export interface Repository {
  id: string;
  githubRepoId: string;
  name: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  language?: string;
  isPrivate: boolean;
  htmlUrl: string;
  autoScanEnabled: boolean;
  scanOnPush: boolean;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    scans: number;
  };
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language?: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

// Scan types
export interface Scan {
  id: string;
  repositoryId: string;
  branch: string;
  commitHash?: string;
  scanType: ScanType;
  status: ScanStatus;
  progress: number;
  totalFiles: number;
  filesScanned: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  repository?: {
    id: string;
    name: string;
    fullName: string;
    language?: string;
  };
  _count?: {
    vulnerabilities: number;
    reports: number;
  };
}

export type ScanType = 'FULL' | 'QUICK' | 'CUSTOM';
export type ScanStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Vulnerability types
export interface Vulnerability {
  id: string;
  scanId: string;
  title: string;
  description: string;
  severity: Severity;
  category: VulnerabilityCategory;
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet?: string;
  cweId?: string;
  cveId?: string;
  suggestedFix?: string;
  fixConfidence?: number;
  autoFixAvailable: boolean;
  status: VulnerabilityStatus;
  falsePositive: boolean;
  createdAt: string;
  scan?: {
    id: string;
    branch: string;
    repository: {
      id: string;
      name: string;
      fullName: string;
    };
  };
  fixes?: Fix[];
  _count?: {
    fixes: number;
  };
}

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type VulnerabilityCategory =
  | 'XSS'
  | 'SQL_INJECTION'
  | 'COMMAND_INJECTION'
  | 'PATH_TRAVERSAL'
  | 'SSRF'
  | 'XXE'
  | 'DESERIALIZATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'CRYPTOGRAPHY'
  | 'SECRETS_EXPOSURE'
  | 'DEPENDENCY'
  | 'CONFIGURATION'
  | 'CODE_QUALITY'
  | 'CSRF'
  | 'SESSION'
  | 'IDOR'
  | 'MASS_ASSIGNMENT'
  | 'OPEN_REDIRECT'
  | 'OTHER';
export type VulnerabilityStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'FALSE_POSITIVE';

// Fix types
export interface Fix {
  id: string;
  vulnerabilityId: string;
  originalCode: string;
  fixedCode: string;
  explanation?: string;
  llmProvider: LlmProvider;
  llmModel?: string;
  status: FixStatus;
  appliedAt?: string;
  prUrl?: string;
  prNumber?: number;
  prStatus?: PrStatus;
  createdAt: string;
}

export type LlmProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE';
export type FixStatus = 'PENDING' | 'APPLIED' | 'FAILED' | 'REJECTED';
export type PrStatus = 'OPEN' | 'MERGED' | 'CLOSED';

// LLM Model types
export interface LlmModel {
  id: string;
  name: string;
  description: string;
  context_window: number;
  max_output: number;
  is_default: boolean;
}

export interface LlmProviderConfig {
  name: string;
  display_name: string;
  models: LlmModel[];
}

export interface LlmProvidersResponse {
  [key: string]: LlmProviderConfig;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Dashboard stats
export interface DashboardStats {
  totalScans: number;
  recentScans: Scan[];
  vulnerabilitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

// ============================================================================
// Pentest Types
// ============================================================================

export type PentestStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AgentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

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

export interface AgentRun {
  id: string;
  pentestRunId: string;
  agentName: AgentName;
  phase: PhaseName;
  status: AgentStatus;
  attemptNumber: number;
  durationMs?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  numTurns?: number;
  model?: string;
  checkpoint?: string;
  commitHash?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface PentestReport {
  id: string;
  pentestRunId: string;
  content: string;
  format: 'JSON' | 'HTML' | 'PDF' | 'MARKDOWN';
  summary?: Record<string, unknown>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  exploitsAttempted: number;
  exploitsSuccessful: number;
  createdAt: string;
}

export interface PentestRun {
  id: string;
  userId: string;
  repositoryId: string;
  webUrl: string;
  branch: string;
  workflowId: string;
  runId?: string;
  status: PentestStatus;
  currentPhase?: string;
  currentAgent?: string;
  completedAgents: string[];
  skippedAgents: string[];
  failedAgent?: string;
  error?: string;
  totalCostUsd?: number;
  totalDurationMs?: number;
  configPath?: string;
  auditLogPath?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  repository?: {
    id: string;
    name: string;
    fullName: string;
  };
  agentRuns?: AgentRun[];
  pentestReport?: PentestReport;
}

export interface PentestProgress {
  workflowId: string;
  status: PentestStatus;
  currentPhase: PhaseName | null;
  currentAgent: AgentName | null;
  completedAgents: AgentName[];
  skippedAgents: AgentName[];
  failedAgent: AgentName | null;
  error?: string;
  elapsedMs: number;
  agentMetrics?: Record<AgentName, AgentMetrics>;
}

export interface AgentMetrics {
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  numTurns: number | null;
  model?: string;
}

// Agent definitions for UI
export const AGENT_DEFINITIONS: Record<AgentName, { name: string; description: string; phase: PhaseName }> = {
  'pre-recon': { name: 'Pre-Recon', description: 'Análise estática de código', phase: 'pre-recon' },
  'recon': { name: 'Reconhecimento', description: 'Mapeamento de superfície de ataque', phase: 'recon' },
  'injection-vuln': { name: 'Injection Vuln', description: 'Detecção de SQLi, Command Injection', phase: 'vulnerability-analysis' },
  'xss-vuln': { name: 'XSS Vuln', description: 'Detecção de Cross-Site Scripting', phase: 'vulnerability-analysis' },
  'auth-vuln': { name: 'Auth Vuln', description: 'Detecção de falhas de autenticação', phase: 'vulnerability-analysis' },
  'ssrf-vuln': { name: 'SSRF Vuln', description: 'Detecção de Server-Side Request Forgery', phase: 'vulnerability-analysis' },
  'authz-vuln': { name: 'Authz Vuln', description: 'Detecção de falhas de autorização', phase: 'vulnerability-analysis' },
  'injection-exploit': { name: 'Injection Exploit', description: 'Exploração de injeção', phase: 'exploitation' },
  'xss-exploit': { name: 'XSS Exploit', description: 'Exploração de XSS', phase: 'exploitation' },
  'auth-exploit': { name: 'Auth Exploit', description: 'Exploração de autenticação', phase: 'exploitation' },
  'ssrf-exploit': { name: 'SSRF Exploit', description: 'Exploração de SSRF', phase: 'exploitation' },
  'authz-exploit': { name: 'Authz Exploit', description: 'Exploração de autorização', phase: 'exploitation' },
  'report': { name: 'Relatório', description: 'Geração de relatório executivo', phase: 'reporting' },
};

export const PHASE_DEFINITIONS: Record<PhaseName, { name: string; description: string }> = {
  'pre-recon': { name: 'Pré-Reconhecimento', description: 'Análise estática inicial' },
  'recon': { name: 'Reconhecimento', description: 'Mapeamento da aplicação' },
  'vulnerability-analysis': { name: 'Análise de Vulnerabilidades', description: 'Detecção de vulnerabilidades' },
  'exploitation': { name: 'Exploração', description: 'Validação de vulnerabilidades' },
  'reporting': { name: 'Relatório', description: 'Geração de relatório' },
};
