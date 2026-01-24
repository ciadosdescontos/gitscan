/**
 * Agent Output Validators
 *
 * Validates that each agent created the required deliverables.
 * Uses symmetric validation for vuln agents (queue + deliverable must both exist).
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentName, VulnType, ExploitationQueue } from '../temporal/types';
import { AGENTS } from './definitions';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  missingFiles: string[];
  errors: string[];
}

export type AgentValidator = (sourceDir: string) => Promise<ValidationResult>;

// ============================================================================
// File Existence Checker
// ============================================================================

async function checkFilesExist(
  sourceDir: string,
  files: string[]
): Promise<{ existing: string[]; missing: string[] }> {
  const results = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(sourceDir, file);
      const exists = await fs.pathExists(fullPath);
      return { file, exists };
    })
  );

  return {
    existing: results.filter(r => r.exists).map(r => r.file),
    missing: results.filter(r => !r.exists).map(r => r.file),
  };
}

// ============================================================================
// Queue Validation (for Vuln Agents)
// ============================================================================

async function validateQueueContent(
  sourceDir: string,
  queueFile: string
): Promise<{ valid: boolean; error?: string }> {
  const fullPath = path.join(sourceDir, queueFile);

  try {
    const content = await fs.readFile(fullPath, 'utf8');
    const queue: ExploitationQueue = JSON.parse(content);

    // Validate structure
    if (!Array.isArray(queue.vulnerabilities)) {
      return {
        valid: false,
        error: `Queue file ${queueFile} missing 'vulnerabilities' array`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to parse queue file ${queueFile}: ${error}`,
    };
  }
}

// ============================================================================
// Symmetric Validation (Queue + Deliverable)
// ============================================================================

async function validateQueueAndDeliverable(
  vulnType: VulnType,
  sourceDir: string
): Promise<ValidationResult> {
  const deliverableFile = `deliverables/${vulnType}_analysis_deliverable.md`;
  const queueFile = `deliverables/${vulnType}_exploitation_queue.json`;

  const { existing, missing } = await checkFilesExist(sourceDir, [
    deliverableFile,
    queueFile,
  ]);

  const errors: string[] = [];

  // Symmetric validation: both must exist or neither
  if (missing.length > 0 && existing.length > 0) {
    errors.push(
      `Asymmetric state: ${existing.join(', ')} exists but ${missing.join(', ')} missing`
    );
    return { valid: false, missingFiles: missing, errors };
  }

  if (missing.length === 2) {
    return { valid: false, missingFiles: missing, errors: ['Neither deliverable nor queue file exists'] };
  }

  // Validate queue content
  const queueValidation = await validateQueueContent(sourceDir, queueFile);
  if (!queueValidation.valid) {
    errors.push(queueValidation.error!);
    return { valid: false, missingFiles: [], errors };
  }

  return { valid: true, missingFiles: [], errors: [] };
}

// ============================================================================
// Individual Validators
// ============================================================================

const validators: Record<AgentName, AgentValidator> = {
  // Pre-Recon: Check code analysis deliverable
  'pre-recon': async (sourceDir: string): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/code_analysis_deliverable.md',
    ]);
    return {
      valid: missing.length === 0,
      missingFiles: missing,
      errors: [],
    };
  },

  // Recon: Check recon deliverable
  'recon': async (sourceDir: string): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/recon_deliverable.md',
    ]);
    return {
      valid: missing.length === 0,
      missingFiles: missing,
      errors: [],
    };
  },

  // Vulnerability Agents: Symmetric validation
  'injection-vuln': (sourceDir) => validateQueueAndDeliverable('injection', sourceDir),
  'xss-vuln': (sourceDir) => validateQueueAndDeliverable('xss', sourceDir),
  'auth-vuln': (sourceDir) => validateQueueAndDeliverable('auth', sourceDir),
  'ssrf-vuln': (sourceDir) => validateQueueAndDeliverable('ssrf', sourceDir),
  'authz-vuln': (sourceDir) => validateQueueAndDeliverable('authz', sourceDir),

  // Exploit Agents: Check evidence file
  'injection-exploit': async (sourceDir): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/injection_evidence.md',
    ]);
    return { valid: missing.length === 0, missingFiles: missing, errors: [] };
  },

  'xss-exploit': async (sourceDir): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/xss_evidence.md',
    ]);
    return { valid: missing.length === 0, missingFiles: missing, errors: [] };
  },

  'auth-exploit': async (sourceDir): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/auth_evidence.md',
    ]);
    return { valid: missing.length === 0, missingFiles: missing, errors: [] };
  },

  'ssrf-exploit': async (sourceDir): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/ssrf_evidence.md',
    ]);
    return { valid: missing.length === 0, missingFiles: missing, errors: [] };
  },

  'authz-exploit': async (sourceDir): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/authz_evidence.md',
    ]);
    return { valid: missing.length === 0, missingFiles: missing, errors: [] };
  },

  // Report: Check final report
  'report': async (sourceDir): Promise<ValidationResult> => {
    const { missing } = await checkFilesExist(sourceDir, [
      'deliverables/comprehensive_security_assessment_report.md',
    ]);
    return { valid: missing.length === 0, missingFiles: missing, errors: [] };
  },
};

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate agent output
 */
export async function validateAgentOutput(
  agentName: AgentName,
  sourceDir: string
): Promise<ValidationResult> {
  const validator = validators[agentName];

  if (!validator) {
    return {
      valid: false,
      missingFiles: [],
      errors: [`No validator defined for agent: ${agentName}`],
    };
  }

  logger.info(`Validating agent output`, { agentName, sourceDir });

  try {
    const result = await validator(sourceDir);

    if (result.valid) {
      logger.info(`Agent output valid`, { agentName });
    } else {
      logger.warn(`Agent output invalid`, {
        agentName,
        missingFiles: result.missingFiles,
        errors: result.errors,
      });
    }

    return result;
  } catch (error) {
    logger.error(`Validation failed`, { agentName, error });
    return {
      valid: false,
      missingFiles: [],
      errors: [`Validation error: ${error}`],
    };
  }
}

/**
 * Get expected deliverables for an agent
 */
export function getExpectedDeliverables(agentName: AgentName): string[] {
  return AGENTS[agentName].deliverables;
}

/**
 * Check if exploitation should proceed based on queue
 */
export async function shouldExploit(
  vulnType: VulnType,
  sourceDir: string
): Promise<{ shouldExploit: boolean; vulnerabilityCount: number }> {
  const queueFile = path.join(
    sourceDir,
    `deliverables/${vulnType}_exploitation_queue.json`
  );

  try {
    if (!(await fs.pathExists(queueFile))) {
      return { shouldExploit: false, vulnerabilityCount: 0 };
    }

    const content = await fs.readFile(queueFile, 'utf8');
    const queue: ExploitationQueue = JSON.parse(content);

    const count = queue.vulnerabilities?.length || 0;
    return {
      shouldExploit: count > 0,
      vulnerabilityCount: count,
    };
  } catch (error) {
    logger.error(`Failed to check exploitation queue`, { vulnType, error });
    return { shouldExploit: false, vulnerabilityCount: 0 };
  }
}
