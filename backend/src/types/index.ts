import { Request } from 'express';
import { User as PrismaUser } from '@prisma/client';

// Extended Express Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

// JWT payload structure
export interface UserPayload {
  id: string;
  githubId: string;
  username: string;
  email?: string;
}

// GitHub OAuth profile
export interface GitHubProfile {
  id: string;
  username: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
  _json: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

// GitHub Repository from API
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
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

// Pagination params
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Scan request payload
export interface CreateScanRequest {
  repositoryId: string;
  branch?: string;
  scanType?: 'FULL' | 'QUICK' | 'CUSTOM';
  customRules?: string[];
}

// Scan progress update
export interface ScanProgress {
  scanId: string;
  status: string;
  progress: number;
  currentFile?: string;
  filesScanned: number;
  totalFiles: number;
  vulnerabilitiesFound: number;
}

// Vulnerability severity levels
export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

// LLM Provider types
export type LlmProviderType = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE';

// LLM request for fix generation
export interface LlmFixRequest {
  vulnerability: {
    title: string;
    description: string;
    category: string;
    filePath: string;
    codeSnippet: string;
    cweId?: string;
  };
  context?: {
    language: string;
    framework?: string;
  };
  provider: LlmProviderType;
}

// LLM fix response
export interface LlmFixResponse {
  fixedCode: string;
  explanation: string;
  confidence: number;
  provider: LlmProviderType;
  model: string;
}

// Error codes
export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  GITHUB_AUTH_FAILED = 'GITHUB_AUTH_FAILED',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',

  // Scanner errors
  SCAN_FAILED = 'SCAN_FAILED',
  SCAN_TIMEOUT = 'SCAN_TIMEOUT',

  // LLM errors
  LLM_ERROR = 'LLM_ERROR',
  LLM_RATE_LIMITED = 'LLM_RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}
