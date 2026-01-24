/**
 * Config Parser
 *
 * Parses and validates YAML configuration files for pentest workflows
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { PentestConfig, ParseResult, ValidationResult, ValidationError } from './types';
import { validateConfig } from './validator';
import { runSecurityChecks } from './security';
import { logger } from '../utils/logger';

// ============================================================================
// YAML Parsing
// ============================================================================

/**
 * Parse YAML string into configuration object
 */
export function parseYaml(content: string): { config: unknown; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  try {
    const config = yaml.parse(content, {
      prettyErrors: true,
      strict: false,
    });

    if (config === null || config === undefined) {
      errors.push({
        path: '/',
        message: 'Configuration file is empty',
      });
      return { config: {}, errors };
    }

    if (typeof config !== 'object' || Array.isArray(config)) {
      errors.push({
        path: '/',
        message: 'Configuration must be an object',
      });
      return { config: {}, errors };
    }

    return { config, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parsing error';
    errors.push({
      path: '/',
      message: `YAML parsing error: ${message}`,
    });
    return { config: {}, errors };
  }
}

// ============================================================================
// Environment Variable Interpolation
// ============================================================================

/**
 * Replace environment variable placeholders in config values
 * Supports: ${VAR_NAME} and ${VAR_NAME:-default}
 */
export function interpolateEnvVars(config: unknown): unknown {
  if (config === null || config === undefined) {
    return config;
  }

  if (typeof config === 'string') {
    return interpolateString(config);
  }

  if (Array.isArray(config)) {
    return config.map(item => interpolateEnvVars(item));
  }

  if (typeof config === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      result[key] = interpolateEnvVars(value);
    }
    return result;
  }

  return config;
}

/**
 * Interpolate environment variables in a string
 */
function interpolateString(str: string): string {
  // Pattern: ${VAR_NAME} or ${VAR_NAME:-default}
  const pattern = /\$\{([^}:]+)(?::-([^}]*))?\}/g;

  return str.replace(pattern, (match, varName, defaultValue) => {
    const envValue = process.env[varName];

    if (envValue !== undefined) {
      return envValue;
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    // Return original if not found (will be flagged as warning)
    return match;
  });
}

/**
 * Find unresolved environment variables
 */
export function findUnresolvedEnvVars(config: unknown, currentPath = ''): ValidationError[] {
  const errors: ValidationError[] = [];
  const pattern = /\$\{([^}:]+)(?::-[^}]*)?\}/g;

  if (typeof config === 'string') {
    let match;
    while ((match = pattern.exec(config)) !== null) {
      if (process.env[match[1]] === undefined) {
        errors.push({
          path: currentPath || '/',
          message: `Unresolved environment variable: ${match[1]}`,
          value: config,
        });
      }
    }
  } else if (Array.isArray(config)) {
    config.forEach((item, index) => {
      errors.push(...findUnresolvedEnvVars(item, `${currentPath}[${index}]`));
    });
  } else if (config !== null && typeof config === 'object') {
    for (const [key, value] of Object.entries(config)) {
      errors.push(...findUnresolvedEnvVars(value, `${currentPath}/${key}`));
    }
  }

  return errors;
}

// ============================================================================
// File Loading
// ============================================================================

/**
 * Load configuration from a YAML file
 */
export async function loadConfigFile(filePath: string): Promise<ParseResult> {
  const absolutePath = path.resolve(filePath);

  // Check if file exists
  if (!(await fs.pathExists(absolutePath))) {
    return {
      success: false,
      validation: {
        valid: false,
        errors: [{
          path: '/',
          message: `Configuration file not found: ${absolutePath}`,
        }],
        warnings: [],
      },
    };
  }

  // Read file
  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      validation: {
        valid: false,
        errors: [{
          path: '/',
          message: `Failed to read configuration file: ${message}`,
        }],
        warnings: [],
      },
    };
  }

  // Parse YAML
  const { config: rawConfig, errors: parseErrors } = parseYaml(content);

  if (parseErrors.length > 0) {
    return {
      success: false,
      rawYaml: content,
      validation: {
        valid: false,
        errors: parseErrors,
        warnings: [],
      },
    };
  }

  // Interpolate environment variables
  const config = interpolateEnvVars(rawConfig);

  // Find unresolved env vars (as warnings)
  const unresolvedWarnings = findUnresolvedEnvVars(rawConfig);

  // Validate against schema and semantics
  const schemaValidation = validateConfig(config);

  // Run security checks
  const securityResult = runSecurityChecks(config as PentestConfig);

  // Combine all results
  const allErrors = [
    ...schemaValidation.errors,
    ...securityResult.errors,
  ];

  const allWarnings = [
    ...schemaValidation.warnings,
    ...securityResult.warnings,
    ...unresolvedWarnings,
  ];

  const success = allErrors.length === 0;

  if (success) {
    logger.info('Configuration loaded successfully', {
      path: absolutePath,
      warnings: allWarnings.length,
    });
  } else {
    logger.warn('Configuration validation failed', {
      path: absolutePath,
      errors: allErrors.length,
    });
  }

  return {
    success,
    config: success ? (config as PentestConfig) : undefined,
    rawYaml: content,
    validation: {
      valid: success,
      errors: allErrors,
      warnings: allWarnings,
    },
  };
}

/**
 * Parse configuration from a YAML string
 */
export function parseConfigString(content: string): ParseResult {
  // Parse YAML
  const { config: rawConfig, errors: parseErrors } = parseYaml(content);

  if (parseErrors.length > 0) {
    return {
      success: false,
      rawYaml: content,
      validation: {
        valid: false,
        errors: parseErrors,
        warnings: [],
      },
    };
  }

  // Interpolate environment variables
  const config = interpolateEnvVars(rawConfig);

  // Find unresolved env vars (as warnings)
  const unresolvedWarnings = findUnresolvedEnvVars(rawConfig);

  // Validate against schema and semantics
  const schemaValidation = validateConfig(config);

  // Run security checks
  const securityResult = runSecurityChecks(config as PentestConfig);

  // Combine all results
  const allErrors = [
    ...schemaValidation.errors,
    ...securityResult.errors,
  ];

  const allWarnings = [
    ...schemaValidation.warnings,
    ...securityResult.warnings,
    ...unresolvedWarnings,
  ];

  const success = allErrors.length === 0;

  return {
    success,
    config: success ? (config as PentestConfig) : undefined,
    rawYaml: content,
    validation: {
      valid: success,
      errors: allErrors,
      warnings: allWarnings,
    },
  };
}

// ============================================================================
// Config Utilities
// ============================================================================

/**
 * Get default configuration
 */
export function getDefaultConfig(): Partial<PentestConfig> {
  return {
    version: '1.0',
    rules: {
      max_depth: 10,
      rate_limit: 10,
      avoid: [
        { type: 'path', url_path: '/admin/*', description: 'Avoid admin paths' },
        { type: 'path', url_path: '*/delete*', description: 'Avoid delete endpoints' },
        { type: 'path', url_path: '*/reset*', description: 'Avoid reset endpoints' },
      ],
    },
    agents: {},
    output: {
      report_formats: ['markdown', 'json'],
      include_logs: false,
      verbosity: 'normal',
    },
  };
}

/**
 * Merge user config with defaults
 */
export function mergeWithDefaults(config: PentestConfig): PentestConfig {
  const defaults = getDefaultConfig();

  return {
    ...defaults,
    ...config,
    rules: {
      ...defaults.rules,
      ...config.rules,
      avoid: [
        ...(defaults.rules?.avoid || []),
        ...(config.rules?.avoid || []),
      ],
    },
    output: {
      ...defaults.output,
      ...config.output,
    },
  };
}

/**
 * Generate a sample configuration file
 */
export function generateSampleConfig(): string {
  return `# GitScan Pentest Configuration
# Version: 1.0

version: "1.0"

# Target application
target:
  url: "https://example.com"
  name: "Example Application"
  tech_stack:
    - Node.js
    - React
    - PostgreSQL
  api_endpoints:
    - /api/v1/users
    - /api/v1/auth
    - /api/v1/products

# Authentication (optional)
authentication:
  login_type: form
  login_url: "https://example.com/login"
  credentials:
    username: "\${TEST_USERNAME:-testuser}"
    password: "\${TEST_PASSWORD:-testpass123}"
  login_flow:
    - "Enter username in the email field"
    - "Enter password in the password field"
    - "Click the Login button"
  success_indicator: "/dashboard"

# Testing rules
rules:
  # Paths to avoid
  avoid:
    - type: path
      url_path: /admin/*
      description: Avoid administrative paths
    - type: path
      url_path: "*/delete*"
      description: Avoid destructive endpoints
    - type: method
      method: DELETE
      description: Avoid DELETE requests

  # Paths to focus on (optional - if set, only these are tested)
  # focus:
  #   - type: path
  #     url_path: /api/*

  # Crawling settings
  max_depth: 10
  rate_limit: 10  # requests per second

# Agent configuration (optional)
agents:
  # Skip specific agents
  # skip:
  #   - ssrf-vuln
  #   - ssrf-exploit

  # Per-agent overrides
  overrides:
    report:
      timeout_ms: 300000  # 5 minutes for report generation

# Output settings
output:
  report_formats:
    - markdown
    - json
  include_logs: false
  verbosity: normal

# Custom variables for prompt interpolation
variables:
  company_name: "Example Corp"
  contact_email: "security@example.com"
`;
}
