/**
 * Deliverable Check
 *
 * Validates deliverable files created by agents
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { AgentName } from '../temporal/types';
import {
  DeliverableType,
  DeliverableMetadata,
  DeliverableValidationResult,
  SessionValidationResult,
  EXPECTED_DELIVERABLES,
  VulnType,
} from './types';
import { validateAllQueues } from './queue-validation';
import { logger } from '../utils/logger';

// ============================================================================
// Deliverable Validation
// ============================================================================

/**
 * Validate a single deliverable file
 */
export async function validateDeliverable(
  filePath: string,
  expectedType: DeliverableType,
  agentName: AgentName
): Promise<DeliverableValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if file exists
  const exists = await fs.pathExists(filePath);

  if (!exists) {
    return {
      valid: false,
      exists: false,
      errors: [`Deliverable not found: ${path.basename(filePath)}`],
      warnings: [],
    };
  }

  // Read file
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    return {
      valid: false,
      exists: true,
      errors: [`Failed to read deliverable: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
    };
  }

  // Check for empty file
  if (content.trim().length === 0) {
    errors.push('Deliverable file is empty');
    return {
      valid: false,
      exists: true,
      errors,
      warnings,
    };
  }

  // Type-specific validation
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    // Validate JSON structure
    try {
      const parsed = JSON.parse(content);

      // Check for required fields based on type
      if (expectedType === 'exploitation_queue') {
        if (!parsed.items || !Array.isArray(parsed.items)) {
          errors.push('Queue file missing "items" array');
        }
        if (!parsed.vulnType) {
          errors.push('Queue file missing "vulnType"');
        }
      }
    } catch {
      errors.push('Invalid JSON format');
    }
  } else if (ext === '.md') {
    // Validate Markdown structure
    const lines = content.split('\n');

    // Check for title
    const hasTitle = lines.some(line => line.startsWith('# '));
    if (!hasTitle) {
      warnings.push('Markdown file missing main title (# heading)');
    }

    // Check minimum content
    if (content.length < 100) {
      warnings.push('Deliverable content seems too short');
    }

    // Check for required sections based on type
    if (expectedType === 'vulnerability_report') {
      if (!content.toLowerCase().includes('severity')) {
        warnings.push('Vulnerability report should include severity information');
      }
      if (!content.toLowerCase().includes('recommendation')) {
        warnings.push('Vulnerability report should include recommendations');
      }
    }

    if (expectedType === 'executive_report') {
      if (!content.toLowerCase().includes('summary') && !content.toLowerCase().includes('executive')) {
        warnings.push('Executive report should include an executive summary');
      }
    }
  }

  // Calculate checksum
  const checksum = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);

  const metadata: DeliverableMetadata = {
    type: expectedType,
    agentName,
    createdAt: (await fs.stat(filePath)).mtime.toISOString(),
    sessionId: path.basename(path.dirname(path.dirname(filePath))),
    checksum,
  };

  return {
    valid: errors.length === 0,
    exists: true,
    errors,
    warnings,
    metadata,
  };
}

// ============================================================================
// Agent Deliverable Validation
// ============================================================================

/**
 * Validate all deliverables for an agent
 */
export async function validateAgentDeliverables(
  sessionDir: string,
  agentName: AgentName
): Promise<Record<string, DeliverableValidationResult>> {
  const results: Record<string, DeliverableValidationResult> = {};
  const expectedFiles = EXPECTED_DELIVERABLES[agentName] || [];
  const deliverablesDir = path.join(sessionDir, 'deliverables');

  for (const filename of expectedFiles) {
    const filePath = path.join(deliverablesDir, filename);
    const type = inferDeliverableType(filename);

    results[filename] = await validateDeliverable(filePath, type, agentName);
  }

  return results;
}

/**
 * Check if agent has produced all required deliverables
 */
export async function checkAgentCompletion(
  sessionDir: string,
  agentName: AgentName
): Promise<{ complete: boolean; missing: string[]; errors: string[] }> {
  const expectedFiles = EXPECTED_DELIVERABLES[agentName] || [];
  const deliverablesDir = path.join(sessionDir, 'deliverables');

  const missing: string[] = [];
  const errors: string[] = [];

  for (const filename of expectedFiles) {
    const filePath = path.join(deliverablesDir, filename);
    const exists = await fs.pathExists(filePath);

    if (!exists) {
      missing.push(filename);
    } else {
      // Quick validation
      const type = inferDeliverableType(filename);
      const validation = await validateDeliverable(filePath, type, agentName);

      if (!validation.valid) {
        errors.push(`${filename}: ${validation.errors.join(', ')}`);
      }
    }
  }

  return {
    complete: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Validate entire session deliverables
 */
export async function validateSession(
  sessionDir: string
): Promise<SessionValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const deliverables: Record<string, DeliverableValidationResult> = {};

  // Check session directory exists
  if (!(await fs.pathExists(sessionDir))) {
    return {
      valid: false,
      sessionDir,
      errors: ['Session directory not found'],
      warnings: [],
      deliverables: {},
      queues: {} as any,
    };
  }

  // Check deliverables directory
  const deliverablesDir = path.join(sessionDir, 'deliverables');
  if (!(await fs.pathExists(deliverablesDir))) {
    return {
      valid: false,
      sessionDir,
      errors: ['Deliverables directory not found'],
      warnings: [],
      deliverables: {},
      queues: {} as any,
    };
  }

  // List all files in deliverables
  const files = await fs.readdir(deliverablesDir);

  for (const filename of files) {
    const filePath = path.join(deliverablesDir, filename);
    const stat = await fs.stat(filePath);

    if (stat.isFile()) {
      const type = inferDeliverableType(filename);
      const agentName = inferAgentFromFilename(filename);

      deliverables[filename] = await validateDeliverable(filePath, type, agentName);

      if (!deliverables[filename].valid) {
        errors.push(...deliverables[filename].errors.map(e => `${filename}: ${e}`));
      }
      warnings.push(...deliverables[filename].warnings.map(w => `${filename}: ${w}`));
    }
  }

  // Validate queues (symmetric validation)
  const queues = await validateAllQueues(sessionDir);

  for (const [vulnType, result] of Object.entries(queues)) {
    if (!result.valid) {
      errors.push(...result.errors.map(e => `${vulnType}: ${e}`));
    }
    warnings.push(...result.warnings.map(w => `${vulnType}: ${w}`));
  }

  return {
    valid: errors.length === 0,
    sessionDir,
    errors,
    warnings,
    deliverables,
    queues,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer deliverable type from filename
 */
function inferDeliverableType(filename: string): DeliverableType {
  const lower = filename.toLowerCase();

  if (lower.includes('code_analysis')) return 'code_analysis';
  if (lower.includes('attack_surface')) return 'attack_surface';
  if (lower.includes('vulnerability_report') || lower.includes('vuln')) return 'vulnerability_report';
  if (lower.includes('exploitation_queue') || lower.includes('queue')) return 'exploitation_queue';
  if (lower.includes('exploitation_result') || lower.includes('exploit')) return 'exploitation_result';
  if (lower.includes('executive') || lower.includes('report')) return 'executive_report';

  return 'executive_report'; // Default
}

/**
 * Infer agent name from filename
 */
function inferAgentFromFilename(filename: string): AgentName {
  const lower = filename.toLowerCase();

  if (lower.includes('code_analysis')) return 'pre-recon';
  if (lower.includes('attack_surface')) return 'recon';
  if (lower.includes('injection') && lower.includes('vuln')) return 'injection-vuln';
  if (lower.includes('xss') && lower.includes('vuln')) return 'xss-vuln';
  if (lower.includes('auth') && !lower.includes('authz') && lower.includes('vuln')) return 'auth-vuln';
  if (lower.includes('ssrf') && lower.includes('vuln')) return 'ssrf-vuln';
  if (lower.includes('authz') && lower.includes('vuln')) return 'authz-vuln';
  if (lower.includes('injection') && lower.includes('exploit')) return 'injection-exploit';
  if (lower.includes('xss') && lower.includes('exploit')) return 'xss-exploit';
  if (lower.includes('auth') && !lower.includes('authz') && lower.includes('exploit')) return 'auth-exploit';
  if (lower.includes('ssrf') && lower.includes('exploit')) return 'ssrf-exploit';
  if (lower.includes('authz') && lower.includes('exploit')) return 'authz-exploit';
  if (lower.includes('report') || lower.includes('executive')) return 'report';

  return 'pre-recon'; // Default
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up session deliverables (for failed/cancelled sessions)
 */
export async function cleanupSession(
  sessionDir: string,
  keepAuditLogs = true
): Promise<void> {
  if (!(await fs.pathExists(sessionDir))) {
    return;
  }

  if (keepAuditLogs) {
    // Only remove deliverables, keep audit logs
    const deliverablesDir = path.join(sessionDir, 'deliverables');
    if (await fs.pathExists(deliverablesDir)) {
      await fs.remove(deliverablesDir);
    }
  } else {
    // Remove entire session directory
    await fs.remove(sessionDir);
  }

  logger.info('Session cleanup completed', {
    sessionDir,
    keepAuditLogs,
  });
}
