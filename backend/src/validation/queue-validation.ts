/**
 * Queue Validation
 *
 * Validates exploitation queues with symmetric validation rules
 * (Queue + Deliverable must exist together)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import {
  VulnType,
  ExploitationQueue,
  ExploitationDecision,
  QueueValidationResult,
  QUEUE_FILES,
  VULN_REPORT_FILES,
} from './types';
import { logger } from '../utils/logger';

// ============================================================================
// Queue Reading
// ============================================================================

/**
 * Read exploitation queue from file
 */
export async function readExploitationQueue(
  sessionDir: string,
  vulnType: VulnType
): Promise<ExploitationQueue | null> {
  const queueFile = path.join(sessionDir, 'deliverables', QUEUE_FILES[vulnType]);

  if (!(await fs.pathExists(queueFile))) {
    return null;
  }

  try {
    const content = await fs.readFile(queueFile, 'utf-8');
    const queue = JSON.parse(content) as ExploitationQueue;

    // Basic validation
    if (!queue.items || !Array.isArray(queue.items)) {
      logger.warn('Invalid queue format', { vulnType, file: queueFile });
      return null;
    }

    return queue;
  } catch (error) {
    logger.error('Failed to read queue file', {
      vulnType,
      file: queueFile,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Check if vulnerability report exists
 */
export async function checkVulnReportExists(
  sessionDir: string,
  vulnType: VulnType
): Promise<boolean> {
  const reportFile = path.join(sessionDir, 'deliverables', VULN_REPORT_FILES[vulnType]);
  return fs.pathExists(reportFile);
}

// ============================================================================
// Symmetric Validation
// ============================================================================

/**
 * Validate queue with symmetric validation
 * Rule: Queue file and vulnerability report must BOTH exist or BOTH not exist
 */
export async function validateQueueSymmetry(
  sessionDir: string,
  vulnType: VulnType
): Promise<QueueValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const queueFile = path.join(sessionDir, 'deliverables', QUEUE_FILES[vulnType]);
  const reportFile = path.join(sessionDir, 'deliverables', VULN_REPORT_FILES[vulnType]);

  const queueExists = await fs.pathExists(queueFile);
  const deliverableExists = await fs.pathExists(reportFile);

  // Symmetric validation: both must exist or neither
  if (queueExists !== deliverableExists) {
    if (queueExists && !deliverableExists) {
      errors.push(
        `Queue file exists but vulnerability report is missing: ${VULN_REPORT_FILES[vulnType]}`
      );
    } else {
      errors.push(
        `Vulnerability report exists but queue file is missing: ${QUEUE_FILES[vulnType]}`
      );
    }
  }

  // Validate queue contents if it exists
  let itemCount: number | undefined;
  if (queueExists) {
    const queue = await readExploitationQueue(sessionDir, vulnType);

    if (queue) {
      itemCount = queue.items.length;

      // Check for empty queue
      if (queue.items.length === 0) {
        warnings.push(`Queue for ${vulnType} is empty - no vulnerabilities found`);
      }

      // Validate queue items
      for (const item of queue.items) {
        if (!item.vulnerabilityId) {
          errors.push(`Queue item missing vulnerabilityId in ${vulnType} queue`);
        }
        if (!item.targetEndpoint) {
          warnings.push(`Queue item missing targetEndpoint in ${vulnType} queue`);
        }
        if (item.priority === undefined || item.priority < 0) {
          warnings.push(`Queue item has invalid priority in ${vulnType} queue`);
        }
      }
    } else {
      errors.push(`Failed to parse queue file: ${QUEUE_FILES[vulnType]}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    queueExists,
    deliverableExists,
    itemCount,
  };
}

// ============================================================================
// Exploitation Decision
// ============================================================================

/**
 * Check if exploitation should run for a vulnerability type
 * Returns decision with queue data if exploitation should proceed
 */
export async function checkExploitationDecision(
  sessionDir: string,
  vulnType: VulnType
): Promise<ExploitationDecision> {
  // First, validate queue symmetry
  const validation = await validateQueueSymmetry(sessionDir, vulnType);

  if (!validation.valid) {
    return {
      shouldExploit: false,
      reason: `Validation failed: ${validation.errors.join('; ')}`,
      vulnerabilityCount: 0,
    };
  }

  if (!validation.queueExists) {
    return {
      shouldExploit: false,
      reason: `No ${vulnType} queue file found - vulnerability analysis may have been skipped`,
      vulnerabilityCount: 0,
    };
  }

  // Read queue
  const queue = await readExploitationQueue(sessionDir, vulnType);

  if (!queue) {
    return {
      shouldExploit: false,
      reason: `Failed to read ${vulnType} queue`,
      vulnerabilityCount: 0,
    };
  }

  // Check if there are exploitable vulnerabilities
  const exploitableItems = queue.items.filter(item => {
    // Filter by severity - only critical, high, medium
    return ['critical', 'high', 'medium'].includes(item.severity);
  });

  if (exploitableItems.length === 0) {
    return {
      shouldExploit: false,
      reason: `No exploitable ${vulnType} vulnerabilities in queue (${queue.items.length} low/info findings)`,
      vulnerabilityCount: queue.items.length,
    };
  }

  logger.info('Exploitation decision: proceed', {
    vulnType,
    totalItems: queue.items.length,
    exploitableItems: exploitableItems.length,
  });

  return {
    shouldExploit: true,
    reason: `Found ${exploitableItems.length} exploitable ${vulnType} vulnerabilities`,
    queue,
    vulnerabilityCount: queue.items.length,
  };
}

// ============================================================================
// Queue Writing
// ============================================================================

/**
 * Write exploitation queue to file
 */
export async function writeExploitationQueue(
  sessionDir: string,
  vulnType: VulnType,
  queue: ExploitationQueue
): Promise<void> {
  const deliverablesDir = path.join(sessionDir, 'deliverables');
  await fs.ensureDir(deliverablesDir);

  const queueFile = path.join(deliverablesDir, QUEUE_FILES[vulnType]);

  // Sort items by priority (higher first)
  queue.items.sort((a, b) => b.priority - a.priority);

  // Atomic write via temp file
  const tempFile = `${queueFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(queue, null, 2));
  await fs.rename(tempFile, queueFile);

  logger.debug('Exploitation queue written', {
    vulnType,
    itemCount: queue.items.length,
    file: queueFile,
  });
}

/**
 * Create an empty queue (for when no vulnerabilities found)
 */
export function createEmptyQueue(
  vulnType: VulnType,
  agentName: string
): ExploitationQueue {
  return {
    vulnType,
    createdAt: new Date().toISOString(),
    createdBy: agentName as any,
    totalItems: 0,
    items: [],
  };
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate all queues in a session
 */
export async function validateAllQueues(
  sessionDir: string
): Promise<Record<VulnType, QueueValidationResult>> {
  const vulnTypes: VulnType[] = ['injection', 'xss', 'auth', 'ssrf', 'authz'];
  const results: Record<VulnType, QueueValidationResult> = {} as any;

  for (const vulnType of vulnTypes) {
    results[vulnType] = await validateQueueSymmetry(sessionDir, vulnType);
  }

  return results;
}

/**
 * Get all exploitation decisions for a session
 */
export async function getAllExploitationDecisions(
  sessionDir: string
): Promise<Record<VulnType, ExploitationDecision>> {
  const vulnTypes: VulnType[] = ['injection', 'xss', 'auth', 'ssrf', 'authz'];
  const decisions: Record<VulnType, ExploitationDecision> = {} as any;

  for (const vulnType of vulnTypes) {
    decisions[vulnType] = await checkExploitationDecision(sessionDir, vulnType);
  }

  return decisions;
}
