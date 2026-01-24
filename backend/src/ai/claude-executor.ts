/**
 * Claude Executor
 *
 * Wraps Claude Agent SDK execution with:
 * - Retry logic with exponential backoff
 * - Git checkpoints for rollback
 * - Validation of deliverables
 * - Audit logging
 * - Cost tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AgentName,
  AgentMetrics,
  PromptName,
  PentestError,
} from '../temporal/types';
import {
  DEFAULT_MODEL,
  RETRY_CONFIG,
  TIMEOUT_CONFIG,
  getAnthropicApiKey,
  getMcpServerConfig,
  isDockerEnvironment,
  calculateCost,
} from './config';
import { validateAgentOutput } from '../agents/validators';
import {
  createCheckpoint,
  commitChanges,
  rollbackToCheckpoint,
} from '../agents/session-manager';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionContext {
  sessionId: string;
  agentName: AgentName;
  promptName: PromptName;
  sourceDir: string;
  webUrl: string;
  prompt: string;
  variables?: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  metrics: AgentMetrics;
  error?: string;
  checkpoint?: string;
  commitHash?: string;
}

interface MessageStreamEvent {
  type: string;
  message?: {
    role: string;
    content: Array<{ type: string; text?: string }>;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  content_block?: {
    type: string;
    text?: string;
  };
  delta?: {
    type: string;
    text?: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Claude Client
// ============================================================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: getAnthropicApiKey(),
    });
  }
  return anthropicClient;
}

// ============================================================================
// Main Execution Function
// ============================================================================

/**
 * Execute Claude prompt with retry and validation
 */
export async function runClaudePromptWithRetry(
  context: ExecutionContext
): Promise<ExecutionResult> {
  const { agentName, sessionId } = context;
  let lastError: Error | null = null;
  let checkpoint: string | undefined = undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    logger.info(`Executing agent`, {
      agentName,
      sessionId,
      attempt,
      maxAttempts: RETRY_CONFIG.maxAttempts,
    });

    try {
      // Create git checkpoint before execution
      checkpoint = await createCheckpoint(sessionId, agentName);

      // Run the prompt
      const result = await runClaudePrompt(context, attempt);

      // Validate output
      const validation = await validateAgentOutput(agentName, context.sourceDir);

      if (validation.valid) {
        // Commit successful changes
        const commitHash = await commitChanges(sessionId, agentName, attempt);

        logger.info(`Agent completed successfully`, {
          agentName,
          sessionId,
          attempt,
          durationMs: result.durationMs,
          costUsd: result.costUsd,
        });

        return {
          success: true,
          metrics: result,
          checkpoint,
          commitHash,
        };
      } else {
        // Validation failed - rollback and retry
        logger.warn(`Validation failed, rolling back`, {
          agentName,
          sessionId,
          attempt,
          missingFiles: validation.missingFiles,
          errors: validation.errors,
        });

        await rollbackToCheckpoint(sessionId, agentName);
        lastError = new Error(
          `Validation failed: ${validation.errors.join(', ')} Missing: ${validation.missingFiles.join(', ')}`
        );
      }
    } catch (error) {
      lastError = error as Error;

      // Rollback on error
      if (checkpoint) {
        try {
          await rollbackToCheckpoint(sessionId, agentName);
        } catch (rollbackError) {
          logger.error(`Rollback failed`, { agentName, rollbackError });
        }
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        logger.error(`Non-retryable error`, { agentName, error });
        break;
      }

      // Wait before retry with exponential backoff
      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );

        logger.info(`Retrying after delay`, {
          agentName,
          attempt,
          delayMs: delay,
        });

        await sleep(delay);
      }
    }
  }

  // All attempts failed
  logger.error(`All attempts failed`, {
    agentName,
    sessionId,
    maxAttempts: RETRY_CONFIG.maxAttempts,
    lastError: lastError?.message,
  });

  return {
    success: false,
    metrics: {
      durationMs: 0,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      numTurns: null,
      model: DEFAULT_MODEL,
    },
    error: lastError?.message || 'Unknown error',
    checkpoint,
  };
}

/**
 * Execute a single Claude prompt attempt
 */
async function runClaudePrompt(
  context: ExecutionContext,
  attemptNumber: number
): Promise<AgentMetrics> {
  const { agentName, promptName, prompt, sourceDir, webUrl } = context;
  const startTime = Date.now();

  const client = getAnthropicClient();
  const isDocker = isDockerEnvironment();

  // Get MCP server configuration
  const mcpServers = getMcpServerConfig(promptName, isDocker);

  logger.info(`Running Claude prompt`, {
    agentName,
    promptName,
    attemptNumber,
    model: DEFAULT_MODEL,
    mcpServers: Object.keys(mcpServers),
  });

  // Build system prompt with context
  const systemPrompt = buildSystemPrompt(agentName, sourceDir, webUrl);

  // Track token usage
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let numTurns = 0;

  try {
    // Execute with streaming
    const stream = await client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Process stream events
    for await (const event of stream) {
      await processStreamEvent(event as MessageStreamEvent, agentName, context);
    }

    // Get final message for token counts
    const finalMessage = await stream.finalMessage();

    if (finalMessage.usage) {
      totalInputTokens = finalMessage.usage.input_tokens;
      totalOutputTokens = finalMessage.usage.output_tokens;
    }

    numTurns = 1; // Single turn for basic execution

    // Calculate cost
    const costUsd = calculateCost(DEFAULT_MODEL, totalInputTokens, totalOutputTokens);
    const durationMs = Date.now() - startTime;

    return {
      durationMs,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd,
      numTurns,
      model: DEFAULT_MODEL,
    };
  } catch (error) {
    logger.error(`Claude prompt execution failed`, {
      agentName,
      promptName,
      attemptNumber,
      error,
    });
    throw error;
  }
}

// ============================================================================
// System Prompt Builder
// ============================================================================

function buildSystemPrompt(
  agentName: AgentName,
  sourceDir: string,
  webUrl: string
): string {
  return `You are a specialized security testing agent named "${agentName}" in the GitScan pentest pipeline.

## Context
- Target Web Application: ${webUrl}
- Source Code Directory: ${sourceDir}
- Deliverables Directory: ${sourceDir}/deliverables/

## Your Role
You are performing automated security testing. Your findings should be:
1. Accurate and verifiable
2. Well-documented with evidence
3. Actionable for remediation

## Output Requirements
- Create all required deliverable files in the deliverables/ directory
- Use markdown format for reports
- Use JSON format for exploitation queues
- Include proof-of-concept code/payloads where applicable

## Important Guidelines
- Do NOT make destructive changes to the target system
- Do NOT exfiltrate real user data
- Document all testing steps for reproducibility
- Focus on the specific vulnerability types assigned to you

## Tools Available
You have access to MCP tools for browser automation (Playwright) and file operations.
Use these tools to interact with the web application and analyze the source code.
`;
}

// ============================================================================
// Stream Event Processing
// ============================================================================

async function processStreamEvent(
  event: MessageStreamEvent,
  agentName: AgentName,
  context: ExecutionContext
): Promise<void> {
  switch (event.type) {
    case 'message_start':
      logger.debug(`Message started`, { agentName });
      break;

    case 'content_block_start':
      if (event.content_block?.type === 'text') {
        logger.debug(`Content block started`, { agentName });
      }
      break;

    case 'content_block_delta':
      if (event.delta?.type === 'text_delta') {
        // Could stream to audit log here
      }
      break;

    case 'message_stop':
      logger.debug(`Message completed`, { agentName });
      break;

    case 'error':
      logger.error(`Stream error`, { agentName, event });
      break;
  }
}

// ============================================================================
// Error Classification
// ============================================================================

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors - retryable
    if (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('socket')
    ) {
      return true;
    }

    // Rate limiting - retryable
    if (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return true;
    }

    // Server errors - retryable
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('service unavailable')
    ) {
      return true;
    }

    // Billing errors - retryable (might resolve after wait)
    if (
      message.includes('spending cap') ||
      message.includes('billing') ||
      message.includes('budget')
    ) {
      return true;
    }

    // Authentication/permission errors - NOT retryable
    if (
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('permission') ||
      message.includes('forbidden') ||
      message.includes('invalid api key')
    ) {
      return false;
    }

    // Invalid request - NOT retryable
    if (
      message.includes('invalid request') ||
      message.includes('bad request') ||
      message.includes('malformed')
    ) {
      return false;
    }
  }

  // Default to retryable for unknown errors
  return true;
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Exports
// ============================================================================

export {
  getAnthropicClient,
  isRetryableError,
  buildSystemPrompt,
};
