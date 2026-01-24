/**
 * Temporal Client for Pentest Pipeline
 *
 * Provides connection to Temporal server and methods to
 * start, query, and cancel pentest workflows.
 */

import { Client, Connection, WorkflowHandle } from '@temporalio/client';
import {
  PipelineInput,
  PipelineProgress,
  PipelineSummary,
} from './types';
import { logger } from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TASK_QUEUE = 'pentest-pipeline';
const NAMESPACE = 'default';

// ============================================================================
// Singleton Connection
// ============================================================================

let connection: Connection | null = null;
let client: Client | null = null;

/**
 * Get or create Temporal connection
 */
async function getConnection(): Promise<Connection> {
  if (!connection) {
    logger.info(`Connecting to Temporal at ${TEMPORAL_ADDRESS}`);
    connection = await Connection.connect({
      address: TEMPORAL_ADDRESS,
    });
    logger.info('Temporal connection established');
  }
  return connection;
}

/**
 * Get or create Temporal client
 */
export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const conn = await getConnection();
    client = new Client({
      connection: conn,
      namespace: NAMESPACE,
    });
  }
  return client;
}

// ============================================================================
// Workflow Operations
// ============================================================================

/**
 * Start a new pentest pipeline workflow
 */
export async function startPentestPipeline(
  input: PipelineInput
): Promise<{ workflowId: string; runId: string }> {
  const temporalClient = await getTemporalClient();

  const workflowId = `pentest-${input.repositoryId}-${Date.now()}`;

  logger.info(`Starting pentest pipeline`, {
    workflowId,
    webUrl: input.webUrl,
    repositoryId: input.repositoryId,
  });

  const handle = await temporalClient.workflow.start('pentestPipelineWorkflow', {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [input],
    // Workflow execution timeout (max time for entire workflow)
    workflowExecutionTimeout: '24h',
    // Single run timeout (max time for single run, excluding retries)
    workflowRunTimeout: '12h',
  });

  logger.info(`Pentest pipeline started`, {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  });

  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  };
}

/**
 * Get workflow handle by ID
 */
export async function getWorkflowHandle(
  workflowId: string
): Promise<WorkflowHandle> {
  const temporalClient = await getTemporalClient();
  return temporalClient.workflow.getHandle(workflowId);
}

/**
 * Query workflow progress
 */
export async function getPipelineProgress(
  workflowId: string
): Promise<PipelineProgress> {
  const handle = await getWorkflowHandle(workflowId);
  return await handle.query<PipelineProgress>('getProgress');
}

/**
 * Query workflow summary
 */
export async function getPipelineSummary(
  workflowId: string
): Promise<PipelineSummary | null> {
  const handle = await getWorkflowHandle(workflowId);
  return await handle.query<PipelineSummary | null>('getSummary');
}

/**
 * Cancel a running workflow
 */
export async function cancelPipeline(workflowId: string): Promise<void> {
  const handle = await getWorkflowHandle(workflowId);

  logger.info(`Cancelling pentest pipeline`, { workflowId });

  await handle.cancel();

  logger.info(`Pentest pipeline cancelled`, { workflowId });
}

/**
 * Terminate a workflow (forceful)
 */
export async function terminatePipeline(
  workflowId: string,
  reason: string
): Promise<void> {
  const handle = await getWorkflowHandle(workflowId);

  logger.warn(`Terminating pentest pipeline`, { workflowId, reason });

  await handle.terminate(reason);

  logger.warn(`Pentest pipeline terminated`, { workflowId });
}

/**
 * Wait for workflow to complete and get result
 */
export async function awaitPipelineCompletion(
  workflowId: string
): Promise<PipelineSummary> {
  const handle = await getWorkflowHandle(workflowId);
  return await handle.result();
}

/**
 * Get workflow execution history (for debugging)
 */
export async function getWorkflowHistory(workflowId: string): Promise<unknown> {
  const handle = await getWorkflowHandle(workflowId);
  const description = await handle.describe();

  return {
    workflowId: description.workflowId,
    runId: description.runId,
    type: description.type,
    status: description.status.name,
    startTime: description.startTime,
    closeTime: description.closeTime,
    executionTime: description.executionTime,
    historyLength: description.historyLength,
    memo: description.memo,
    searchAttributes: description.searchAttributes,
  };
}

/**
 * List all pentest workflows for a user
 */
export async function listUserPipelines(
  userId: string,
  status?: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
): Promise<Array<{ workflowId: string; status: string; startTime: Date }>> {
  const temporalClient = await getTemporalClient();

  let query = `WorkflowType = 'pentestPipelineWorkflow'`;

  if (status) {
    const statusMap: Record<string, string> = {
      RUNNING: 'Running',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
      CANCELLED: 'Canceled',
    };
    query += ` AND ExecutionStatus = '${statusMap[status]}'`;
  }

  const workflows: Array<{ workflowId: string; status: string; startTime: Date }> = [];

  for await (const workflow of temporalClient.workflow.list({ query })) {
    workflows.push({
      workflowId: workflow.workflowId,
      status: workflow.status.name,
      startTime: workflow.startTime,
    });
  }

  return workflows;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check Temporal connection health
 */
export async function checkTemporalHealth(): Promise<boolean> {
  try {
    const temporalClient = await getTemporalClient();
    // Simple check - try to list workflows (limited to 1)
    const iterator = temporalClient.workflow.list({ pageSize: 1 });
    await iterator[Symbol.asyncIterator]().next();
    return true;
  } catch (error) {
    logger.error('Temporal health check failed', { error });
    return false;
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Close Temporal connection (for graceful shutdown)
 */
export async function closeTemporalConnection(): Promise<void> {
  if (connection) {
    await connection.close();
    connection = null;
    client = null;
    logger.info('Temporal connection closed');
  }
}

// ============================================================================
// Export Task Queue for Workers
// ============================================================================

export { TASK_QUEUE, NAMESPACE };
