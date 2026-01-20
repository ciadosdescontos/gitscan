// User types
export interface User {
  id: string;
  githubId: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  defaultLlmProvider: LlmProvider;
  createdAt: string;
  lastLoginAt: string;
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
