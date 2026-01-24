/**
 * Config Validator
 *
 * Validates pentest configuration against JSON Schema using AJV
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { PentestConfig, ValidationResult, ValidationError } from './types';
import configSchema from './schema.json';

// ============================================================================
// AJV Setup
// ============================================================================

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false as any, // Disable strict mode for more lenient validation
});

// Add format validators (uri, email, etc.)
addFormats(ajv);

// Compile schema
const validateSchema = ajv.compile(configSchema);

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate configuration against JSON Schema
 */
export function validateAgainstSchema(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const valid = validateSchema(config);

  if (!valid && validateSchema.errors) {
    for (const error of validateSchema.errors) {
      errors.push(formatAjvError(error));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format AJV error into our ValidationError format
 */
function formatAjvError(error: ErrorObject): ValidationError {
  const path = (error as any).instancePath || (error as any).dataPath || '/';
  let message = error.message || 'Unknown validation error';

  // Enhanced error messages
  switch (error.keyword) {
    case 'required':
      message = `Missing required property: ${(error.params as { missingProperty: string }).missingProperty}`;
      break;
    case 'additionalProperties':
      message = `Unknown property: ${(error.params as { additionalProperty: string }).additionalProperty}`;
      break;
    case 'enum':
      message = `Invalid value. Allowed values: ${(error.params as { allowedValues: unknown[] }).allowedValues.join(', ')}`;
      break;
    case 'type':
      message = `Invalid type. Expected ${(error.params as { type: string }).type}`;
      break;
    case 'format':
      message = `Invalid format. Expected ${(error.params as { format: string }).format}`;
      break;
    case 'minimum':
      message = `Value must be >= ${(error.params as { limit: number }).limit}`;
      break;
    case 'maximum':
      message = `Value must be <= ${(error.params as { limit: number }).limit}`;
      break;
    case 'oneOf':
      message = 'Must match exactly one of the allowed schemas';
      break;
  }

  return {
    path,
    message,
    value: error.data,
  };
}

// ============================================================================
// Semantic Validation
// ============================================================================

/**
 * Perform semantic validation beyond JSON Schema
 */
export function validateSemantics(config: PentestConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check for conflicting agent configuration
  if (config.agents?.skip && config.agents?.only) {
    if (config.agents.skip.length > 0 && config.agents.only.length > 0) {
      errors.push({
        path: '/agents',
        message: 'Cannot specify both "skip" and "only" agent lists',
      });
    }
  }

  // Check for focus and avoid conflicts
  if (config.rules?.focus && config.rules?.avoid) {
    const focusPaths = config.rules.focus
      .filter(r => r.type === 'path')
      .map(r => (r as { url_path: string }).url_path);
    const avoidPaths = config.rules.avoid
      .filter(r => r.type === 'path')
      .map(r => (r as { url_path: string }).url_path);

    for (const focusPath of focusPaths) {
      for (const avoidPath of avoidPaths) {
        if (pathsOverlap(focusPath, avoidPath)) {
          warnings.push({
            path: '/rules',
            message: `Focus path "${focusPath}" overlaps with avoid path "${avoidPath}"`,
          });
        }
      }
    }
  }

  // Check authentication URLs match target
  if (config.authentication) {
    const targetUrl = new URL(config.target.url);

    if ('login_url' in config.authentication) {
      try {
        const loginUrl = new URL(config.authentication.login_url);
        if (loginUrl.hostname !== targetUrl.hostname) {
          warnings.push({
            path: '/authentication/login_url',
            message: `Login URL hostname (${loginUrl.hostname}) differs from target hostname (${targetUrl.hostname})`,
          });
        }
      } catch {
        errors.push({
          path: '/authentication/login_url',
          message: 'Invalid login URL format',
        });
      }
    }
  }

  // Check for overly broad focus rules
  if (config.rules?.focus) {
    const hasBroadRule = config.rules.focus.some(r =>
      r.type === 'path' && ((r as { url_path: string }).url_path === '/*' || (r as { url_path: string }).url_path === '/**')
    );
    if (hasBroadRule) {
      warnings.push({
        path: '/rules/focus',
        message: 'Broad focus rule (/* or /**) may slow down testing. Consider more specific paths.',
      });
    }
  }

  // Check agent overrides reference valid agents
  if (config.agents?.overrides) {
    const validAgents = [
      'pre-recon', 'recon',
      'injection-vuln', 'xss-vuln', 'auth-vuln', 'ssrf-vuln', 'authz-vuln',
      'injection-exploit', 'xss-exploit', 'auth-exploit', 'ssrf-exploit', 'authz-exploit',
      'report'
    ];

    for (const agentName of Object.keys(config.agents.overrides)) {
      if (!validAgents.includes(agentName)) {
        errors.push({
          path: `/agents/overrides/${agentName}`,
          message: `Unknown agent: ${agentName}`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if two URL path patterns overlap
 */
function pathsOverlap(path1: string, path2: string): boolean {
  // Simple overlap detection - convert glob to regex
  const pattern1 = globToRegex(path1);
  const pattern2 = globToRegex(path2);

  // Check if one matches a sample of the other
  const samples1 = generateSamples(path1);
  const samples2 = generateSamples(path2);

  for (const sample of samples1) {
    if (pattern2.test(sample)) return true;
  }
  for (const sample of samples2) {
    if (pattern1.test(sample)) return true;
  }

  return false;
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

/**
 * Generate sample paths from a glob pattern
 */
function generateSamples(glob: string): string[] {
  const base = glob
    .replace(/\*\*/g, 'a/b/c')
    .replace(/\*/g, 'sample');
  return [base, glob.replace(/\*+/g, '')];
}

// ============================================================================
// Combined Validation
// ============================================================================

/**
 * Perform full validation (schema + semantic)
 */
export function validateConfig(config: unknown): ValidationResult {
  // First, validate against JSON Schema
  const schemaResult = validateAgainstSchema(config);

  if (!schemaResult.valid) {
    return schemaResult;
  }

  // Then, perform semantic validation
  const semanticResult = validateSemantics(config as PentestConfig);

  return {
    valid: semanticResult.valid,
    errors: [...schemaResult.errors, ...semanticResult.errors],
    warnings: [...schemaResult.warnings, ...semanticResult.warnings],
  };
}
