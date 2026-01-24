/**
 * Prompt Manager
 *
 * Manages loading and processing of prompt templates for agents.
 * Supports:
 * - @include() directives for shared content
 * - Variable interpolation {{VARIABLE}}
 * - Pipeline testing mode with simplified prompts
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { PromptName, DistributedConfig } from '../temporal/types';
import { logger } from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const PROMPTS_DIR = path.join(__dirname, '../../prompts');
const PIPELINE_TESTING_DIR = path.join(PROMPTS_DIR, 'pipeline-testing');
const SHARED_DIR = path.join(PROMPTS_DIR, 'shared');

// ============================================================================
// Types
// ============================================================================

export interface PromptVariables {
  webUrl: string;
  repoPath: string;
  MCP_SERVER?: string;
  RULES_AVOID?: string;
  RULES_FOCUS?: string;
  LOGIN_INSTRUCTIONS?: string;
}

// ============================================================================
// Main Loading Function
// ============================================================================

/**
 * Load and process a prompt template
 */
export async function loadPrompt(
  promptName: PromptName,
  variables: PromptVariables,
  config?: DistributedConfig,
  pipelineTestingMode: boolean = false
): Promise<string> {
  // Select base directory
  const baseDir = pipelineTestingMode ? PIPELINE_TESTING_DIR : PROMPTS_DIR;
  const promptFile = `${promptName}.txt`;
  const promptPath = path.join(baseDir, promptFile);

  // Fallback to main prompts if testing prompt doesn't exist
  let actualPath = promptPath;
  if (pipelineTestingMode && !(await fs.pathExists(promptPath))) {
    actualPath = path.join(PROMPTS_DIR, promptFile);
    logger.debug(`Pipeline testing prompt not found, using main prompt`, {
      promptName,
      path: actualPath,
    });
  }

  if (!(await fs.pathExists(actualPath))) {
    throw new Error(`Prompt template not found: ${promptFile}`);
  }

  logger.info(`Loading prompt`, { promptName, path: actualPath });

  // Read template
  let content = await fs.readFile(actualPath, 'utf8');

  // Process @include() directives
  content = await processIncludes(content, baseDir);

  // Build extended variables with config
  const extendedVariables = buildExtendedVariables(variables, config);

  // Interpolate variables
  content = interpolateVariables(content, extendedVariables);

  return content;
}

// ============================================================================
// Include Processing
// ============================================================================

/**
 * Process @include() directives in template
 */
async function processIncludes(
  content: string,
  baseDir: string
): Promise<string> {
  const includeRegex = /@include\(([^)]+)\)/g;
  const matches = Array.from(content.matchAll(includeRegex));

  if (matches.length === 0) {
    return content;
  }

  // Load all includes in parallel
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const includePath = match[1].trim();
      const fullPath = path.join(baseDir, includePath);

      // Try shared directory if not found in base
      let actualPath = fullPath;
      if (!(await fs.pathExists(fullPath))) {
        actualPath = path.join(SHARED_DIR, path.basename(includePath));
      }

      if (!(await fs.pathExists(actualPath))) {
        logger.warn(`Include file not found`, { includePath, fullPath });
        return { placeholder: match[0], content: '' };
      }

      const includeContent = await fs.readFile(actualPath, 'utf8');

      return {
        placeholder: match[0],
        content: includeContent,
      };
    })
  );

  // Apply replacements
  let result = content;
  for (const { placeholder, content: replacement } of replacements) {
    result = result.replace(placeholder, replacement);
  }

  return result;
}

// ============================================================================
// Variable Interpolation
// ============================================================================

/**
 * Build extended variables including config-derived values
 */
function buildExtendedVariables(
  variables: PromptVariables,
  config?: DistributedConfig
): Record<string, string> {
  const extended: Record<string, string> = {
    WEB_URL: variables.webUrl,
    REPO_PATH: variables.repoPath,
    MCP_SERVER: variables.MCP_SERVER || '',
  };

  if (config) {
    // Build rules strings
    extended.RULES_AVOID = formatRules(config.avoid, 'avoid');
    extended.RULES_FOCUS = formatRules(config.focus, 'focus');

    // Build login instructions if authentication configured
    if (config.authentication) {
      extended.LOGIN_INSTRUCTIONS = buildLoginInstructions(config.authentication);
    }
  }

  return extended;
}

/**
 * Interpolate {{VARIABLE}} placeholders
 */
function interpolateVariables(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

// ============================================================================
// Rules Formatting
// ============================================================================

/**
 * Format rules array into prompt-friendly string
 */
function formatRules(
  rules: DistributedConfig['avoid'],
  type: 'avoid' | 'focus'
): string {
  if (!rules || rules.length === 0) {
    return type === 'avoid'
      ? 'No specific paths to avoid.'
      : 'No specific paths to focus on.';
  }

  const header = type === 'avoid'
    ? '## Paths to AVOID testing:\n'
    : '## Paths to FOCUS testing on:\n';

  const ruleLines = rules.map((rule, i) => {
    const path = rule.url_path || rule.domain || rule.subdomain || '';
    return `${i + 1}. ${rule.type}: ${path} - ${rule.description}`;
  });

  return header + ruleLines.join('\n');
}

// ============================================================================
// Login Instructions
// ============================================================================

/**
 * Build login instructions from authentication config
 */
function buildLoginInstructions(
  auth: NonNullable<DistributedConfig['authentication']>
): string {
  const lines: string[] = [
    '## Authentication Instructions',
    '',
    `Login Type: ${auth.login_type}`,
    `Login URL: ${auth.login_url}`,
    '',
    '### Credentials',
    `- Username: ${auth.credentials.username}`,
    `- Password: ${auth.credentials.password}`,
  ];

  if (auth.credentials.totp_secret) {
    lines.push(`- TOTP Secret: ${auth.credentials.totp_secret} (use MCP tool to generate current code)`);
  }

  lines.push('', '### Login Steps');

  auth.login_flow.forEach((step, i) => {
    lines.push(`${i + 1}. ${step}`);
  });

  lines.push('', '### Success Verification');
  lines.push(`- Type: ${auth.success_condition.type}`);
  lines.push(`- Expected: ${auth.success_condition.value}`);

  return lines.join('\n');
}

// ============================================================================
// Prompt Existence Check
// ============================================================================

/**
 * Check if a prompt template exists
 */
export async function promptExists(
  promptName: PromptName,
  pipelineTestingMode: boolean = false
): Promise<boolean> {
  const baseDir = pipelineTestingMode ? PIPELINE_TESTING_DIR : PROMPTS_DIR;
  const promptPath = path.join(baseDir, `${promptName}.txt`);

  if (await fs.pathExists(promptPath)) {
    return true;
  }

  // Check main prompts as fallback
  if (pipelineTestingMode) {
    return fs.pathExists(path.join(PROMPTS_DIR, `${promptName}.txt`));
  }

  return false;
}

/**
 * List all available prompts
 */
export async function listPrompts(): Promise<PromptName[]> {
  const files = await fs.readdir(PROMPTS_DIR);

  return files
    .filter((f: string) => f.endsWith('.txt') && !f.startsWith('_'))
    .map((f: string) => f.replace('.txt', '') as PromptName);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Ensure prompts directory exists
 */
export async function initializePromptsDir(): Promise<void> {
  await fs.ensureDir(PROMPTS_DIR);
  await fs.ensureDir(PIPELINE_TESTING_DIR);
  await fs.ensureDir(SHARED_DIR);

  logger.info(`Prompts directories initialized`, {
    main: PROMPTS_DIR,
    testing: PIPELINE_TESTING_DIR,
    shared: SHARED_DIR,
  });
}

// ============================================================================
// Public Variable Interpolation
// ============================================================================

/**
 * Interpolate variables in a prompt string
 * Public version of interpolateVariables for external use
 */
export function interpolatePrompt(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

// ============================================================================
// Prompt to Agent Mapping
// ============================================================================

import { AgentName } from '../temporal/types';

/**
 * Mapping from prompt names to agent names
 */
export const PROMPT_TO_AGENT: Record<PromptName, AgentName> = {
  'pre-recon-code': 'pre-recon',
  'recon': 'recon',
  'vuln-injection': 'injection-vuln',
  'vuln-xss': 'xss-vuln',
  'vuln-auth': 'auth-vuln',
  'vuln-ssrf': 'ssrf-vuln',
  'vuln-authz': 'authz-vuln',
  'exploit-injection': 'injection-exploit',
  'exploit-xss': 'xss-exploit',
  'exploit-auth': 'auth-exploit',
  'exploit-ssrf': 'ssrf-exploit',
  'exploit-authz': 'authz-exploit',
  'report-executive': 'report',
};

/**
 * Mapping from agent names to prompt names
 */
export const AGENT_TO_PROMPT: Record<AgentName, PromptName> = {
  'pre-recon': 'pre-recon-code',
  'recon': 'recon',
  'injection-vuln': 'vuln-injection',
  'xss-vuln': 'vuln-xss',
  'auth-vuln': 'vuln-auth',
  'ssrf-vuln': 'vuln-ssrf',
  'authz-vuln': 'vuln-authz',
  'injection-exploit': 'exploit-injection',
  'xss-exploit': 'exploit-xss',
  'auth-exploit': 'exploit-auth',
  'ssrf-exploit': 'exploit-ssrf',
  'authz-exploit': 'exploit-authz',
  'report': 'report-executive',
};
