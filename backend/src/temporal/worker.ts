/**
 * Temporal Worker for Pentest Pipeline
 *
 * Runs activities that execute the 13 pentest agents.
 * Each activity runs a Claude prompt with retry and validation.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { TASK_QUEUE, NAMESPACE } from './client';
import { logger } from '../utils/logger';
import * as activities from './activities';

// ============================================================================
// Configuration
// ============================================================================

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

// Worker configuration
const WORKER_CONFIG = {
  // Max concurrent activities
  maxConcurrentActivityTaskExecutions: 5,
  // Max concurrent workflows
  maxConcurrentWorkflowTaskExecutions: 10,
  // Activity heartbeat timeout
  defaultHeartbeatTimeout: '30s',
  // Enable sticky execution for better performance
  enableSDKTracing: process.env.NODE_ENV !== 'production',
};

// ============================================================================
// Worker Creation
// ============================================================================

/**
 * Create and configure the Temporal worker
 */
async function createWorker(): Promise<Worker> {
  logger.info(`Connecting worker to Temporal at ${TEMPORAL_ADDRESS}`);

  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  logger.info('Worker connection established');

  const worker = await Worker.create({
    connection,
    namespace: NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities,
    ...WORKER_CONFIG,
  });

  logger.info(`Worker created`, {
    taskQueue: TASK_QUEUE,
    namespace: NAMESPACE,
    maxConcurrentActivities: WORKER_CONFIG.maxConcurrentActivityTaskExecutions,
  });

  return worker;
}

// ============================================================================
// Worker Lifecycle
// ============================================================================

let worker: Worker | null = null;
let isShuttingDown = false;

/**
 * Start the worker
 */
async function startWorker(): Promise<void> {
  if (worker) {
    logger.warn('Worker already running');
    return;
  }

  worker = await createWorker();

  // Handle shutdown signals
  const shutdownHandler = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, shutting down worker gracefully...`);

    if (worker) {
      // Graceful shutdown - wait for current activities to complete
      worker.shutdown();
      await worker.run().catch(() => {});
      logger.info('Worker shut down successfully');
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

  logger.info('Starting worker...');

  try {
    await worker.run();
  } catch (error) {
    if (!isShuttingDown) {
      logger.error('Worker crashed', { error });
      throw error;
    }
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return worker !== null && !isShuttingDown;
}

// ============================================================================
// Main Entry Point
// ============================================================================

// Only run if this is the main module
if (require.main === module) {
  startWorker().catch((error) => {
    logger.error('Failed to start worker', { error });
    process.exit(1);
  });
}

export { startWorker, createWorker };
