/**
 * Temporal Module Exports
 *
 * Re-exports all temporal-related functionality
 */

// Types
export * from './types';

// Client functions
export {
  getTemporalClient,
  startPentestPipeline,
  getWorkflowHandle,
  getPipelineProgress,
  getPipelineSummary,
  cancelPipeline,
  terminatePipeline,
  awaitPipelineCompletion,
  getWorkflowHistory,
  listUserPipelines,
  checkTemporalHealth,
  closeTemporalConnection,
  TASK_QUEUE,
  NAMESPACE,
} from './client';

// Worker (for separate process)
export { startWorker, createWorker, isWorkerRunning } from './worker';
