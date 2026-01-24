/**
 * AI Configuration
 *
 * Configuration for Claude Agent SDK and AI-related settings
 */

import { PromptName, PlaywrightAgent, MCP_AGENT_MAPPING } from '../temporal/types';

// ============================================================================
// Model Configuration
// ============================================================================

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
export const FALLBACK_MODEL = 'claude-3-5-sonnet-20241022';

export const MODEL_CONFIG = {
  model: DEFAULT_MODEL,
  maxTurns: 10_000,  // Allow extensive analysis
  maxTokens: 8192,   // Max output tokens per turn
};

// ============================================================================
// MCP Server Configuration
// ============================================================================

export interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Get MCP server configuration for a prompt
 */
export function getMcpServerConfig(
  promptName: PromptName,
  isDocker: boolean = false
): Record<string, McpServerConfig> {
  const playwrightAgent = MCP_AGENT_MAPPING[promptName];
  const userDataDir = `/tmp/${playwrightAgent}`;

  const baseArgs = [
    '@playwright/mcp@latest',
    '--isolated',
    '--user-data-dir', userDataDir,
  ];

  if (isDocker) {
    baseArgs.push('--executable-path', '/usr/bin/chromium-browser');
  }

  return {
    [playwrightAgent]: {
      type: 'stdio',
      command: 'npx',
      args: baseArgs,
    },
    'shannon-helper': {
      type: 'stdio',
      command: 'node',
      args: ['./mcp/shannon-helper.js'],
    },
  };
}

/**
 * Get all MCP servers for parallel execution
 */
export function getAllMcpServers(isDocker: boolean = false): Record<string, McpServerConfig> {
  const agents: PlaywrightAgent[] = [
    'playwright-agent1',
    'playwright-agent2',
    'playwright-agent3',
    'playwright-agent4',
    'playwright-agent5',
  ];

  const servers: Record<string, McpServerConfig> = {
    'shannon-helper': {
      type: 'stdio',
      command: 'node',
      args: ['./mcp/shannon-helper.js'],
    },
  };

  for (const agent of agents) {
    const userDataDir = `/tmp/${agent}`;
    const baseArgs = [
      '@playwright/mcp@latest',
      '--isolated',
      '--user-data-dir', userDataDir,
    ];

    if (isDocker) {
      baseArgs.push('--executable-path', '/usr/bin/chromium-browser');
    }

    servers[agent] = {
      type: 'stdio',
      command: 'npx',
      args: baseArgs,
    };
  }

  return servers;
}

// ============================================================================
// Retry Configuration
// ============================================================================

export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// ============================================================================
// Timeout Configuration
// ============================================================================

export const TIMEOUT_CONFIG = {
  // Per-agent execution timeout
  agentExecutionTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours

  // API call timeout
  apiCallTimeoutMs: 5 * 60 * 1000, // 5 minutes

  // Git operation timeout
  gitOperationTimeoutMs: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Cost Tracking
// ============================================================================

// Approximate costs per 1M tokens (as of 2025)
export const TOKEN_COSTS = {
  'claude-sonnet-4-5-20250929': {
    input: 3.00,   // $3 per 1M input tokens
    output: 15.00, // $15 per 1M output tokens
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.00,
    output: 15.00,
  },
  'claude-opus-4-5-20250929': {
    input: 15.00,
    output: 75.00,
  },
};

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = TOKEN_COSTS[model as keyof typeof TOKEN_COSTS] || TOKEN_COSTS[DEFAULT_MODEL];

  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;

  return inputCost + outputCost;
}

// ============================================================================
// Environment
// ============================================================================

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  return key;
}

export function isDockerEnvironment(): boolean {
  return process.env.DOCKER_ENV === 'true' ||
         process.env.NODE_ENV === 'production' ||
         Boolean(process.env.TEMPORAL_ADDRESS?.includes('temporal:'));
}

// ============================================================================
// Validation
// ============================================================================

export function validateConfig(): void {
  // Check API key
  getAnthropicApiKey();

  // Log configuration
  console.log('AI Configuration validated:', {
    model: DEFAULT_MODEL,
    isDocker: isDockerEnvironment(),
    retryMaxAttempts: RETRY_CONFIG.maxAttempts,
    agentTimeoutMs: TIMEOUT_CONFIG.agentExecutionTimeoutMs,
  });
}
