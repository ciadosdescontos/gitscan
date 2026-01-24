/**
 * Validation System Types
 *
 * Types for queue validation and deliverable checking
 */

import { AgentName } from '../temporal/types';

// ============================================================================
// Vulnerability Types
// ============================================================================

export type VulnType = 'injection' | 'xss' | 'auth' | 'ssrf' | 'authz';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface VulnerabilityFinding {
  id: string;
  type: VulnType;
  severity: SeverityLevel;
  title: string;
  description: string;
  location: {
    file?: string;
    line?: number;
    endpoint?: string;
    parameter?: string;
  };
  evidence?: string;
  recommendation?: string;
  cwe?: string;
  cvss?: number;
  exploitable: boolean;
  exploitDifficulty?: 'trivial' | 'easy' | 'moderate' | 'hard';
}

// ============================================================================
// Queue Types
// ============================================================================

export interface ExploitationQueueItem {
  vulnerabilityId: string;
  type: VulnType;
  severity: SeverityLevel;
  priority: number;  // Higher = more important
  targetEndpoint: string;
  exploitStrategy?: string;
  prereqs?: string[];
}

export interface ExploitationQueue {
  vulnType: VulnType;
  createdAt: string;
  createdBy: AgentName;
  totalItems: number;
  items: ExploitationQueueItem[];
}

export interface ExploitationDecision {
  shouldExploit: boolean;
  reason: string;
  queue?: ExploitationQueue;
  vulnerabilityCount: number;
}

// ============================================================================
// Deliverable Types
// ============================================================================

export type DeliverableType =
  | 'code_analysis'
  | 'attack_surface'
  | 'vulnerability_report'
  | 'exploitation_queue'
  | 'exploitation_result'
  | 'executive_report';

export interface DeliverableMetadata {
  type: DeliverableType;
  agentName: AgentName;
  createdAt: string;
  sessionId: string;
  checksum?: string;
}

export interface DeliverableValidationResult {
  valid: boolean;
  exists: boolean;
  errors: string[];
  warnings: string[];
  metadata?: DeliverableMetadata;
}

// ============================================================================
// Validation Results
// ============================================================================

export interface QueueValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  queueExists: boolean;
  deliverableExists: boolean;
  itemCount?: number;
}

export interface SessionValidationResult {
  valid: boolean;
  sessionDir: string;
  errors: string[];
  warnings: string[];
  deliverables: Record<string, DeliverableValidationResult>;
  queues: Record<VulnType, QueueValidationResult>;
}

// ============================================================================
// Expected Files
// ============================================================================

export const EXPECTED_DELIVERABLES: Record<AgentName, string[]> = {
  'pre-recon': ['code_analysis_deliverable.md'],
  'recon': ['attack_surface_deliverable.md'],
  'injection-vuln': ['injection_vulnerability_report.md', 'injection_exploitation_queue.json'],
  'xss-vuln': ['xss_vulnerability_report.md', 'xss_exploitation_queue.json'],
  'auth-vuln': ['auth_vulnerability_report.md', 'auth_exploitation_queue.json'],
  'ssrf-vuln': ['ssrf_vulnerability_report.md', 'ssrf_exploitation_queue.json'],
  'authz-vuln': ['authz_vulnerability_report.md', 'authz_exploitation_queue.json'],
  'injection-exploit': ['injection_exploitation_result.md'],
  'xss-exploit': ['xss_exploitation_result.md'],
  'auth-exploit': ['auth_exploitation_result.md'],
  'ssrf-exploit': ['ssrf_exploitation_result.md'],
  'authz-exploit': ['authz_exploitation_result.md'],
  'report': ['executive_report.md', 'technical_report.md', 'summary.json'],
};

export const QUEUE_FILES: Record<VulnType, string> = {
  injection: 'injection_exploitation_queue.json',
  xss: 'xss_exploitation_queue.json',
  auth: 'auth_exploitation_queue.json',
  ssrf: 'ssrf_exploitation_queue.json',
  authz: 'authz_exploitation_queue.json',
};

export const VULN_REPORT_FILES: Record<VulnType, string> = {
  injection: 'injection_vulnerability_report.md',
  xss: 'xss_vulnerability_report.md',
  auth: 'auth_vulnerability_report.md',
  ssrf: 'ssrf_vulnerability_report.md',
  authz: 'authz_vulnerability_report.md',
};
