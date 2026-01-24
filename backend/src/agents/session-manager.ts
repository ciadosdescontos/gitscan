/**
 * Session Manager for Pentest Pipeline
 *
 * Manages the lifecycle of a pentest session:
 * - Repository cloning
 * - Deliverables directory setup
 * - Session state tracking
 * - Cleanup
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import {
  PipelineInput,
  AgentName,
  SessionMetadata,
} from '../temporal/types';
import { logger } from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const PENTEST_BASE_DIR = process.env.PENTEST_BASE_DIR || '/tmp/pentest';
const MAX_CLONE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Session State
// ============================================================================

interface SessionState {
  sessionId: string;
  repoPath: string;
  webUrl: string;
  branch: string;
  startTime: Date;
  currentAgent: AgentName | null;
  completedAgents: AgentName[];
  checkpoints: Map<AgentName, string>;
}

// In-memory session store (TODO: persist to Redis for production)
const sessions = new Map<string, SessionState>();

// ============================================================================
// Session Lifecycle
// ============================================================================

/**
 * Initialize a new pentest session
 */
export async function initializeSession(
  input: PipelineInput
): Promise<SessionState> {
  const sessionId = uuidv4();
  const sessionDir = path.join(PENTEST_BASE_DIR, sessionId);

  logger.info(`Initializing pentest session`, {
    sessionId,
    webUrl: input.webUrl,
    repoPath: input.repoPath,
  });

  // Create session directory
  await fs.ensureDir(sessionDir);

  // Create deliverables directory
  const deliverablesDir = path.join(sessionDir, 'deliverables');
  await fs.ensureDir(deliverablesDir);

  // Clone or copy repository
  const repoDir = path.join(sessionDir, 'repo');

  if (input.repoPath.startsWith('http') || input.repoPath.startsWith('git@')) {
    // Clone from remote
    await cloneRepository(input.repoPath, repoDir, input.branch);
  } else {
    // Copy from local path
    await fs.copy(input.repoPath, repoDir);
  }

  // Initialize git in repo dir if not already
  const git = simpleGit(repoDir);
  const isGitRepo = await git.checkIsRepo();

  if (!isGitRepo) {
    await git.init();
    await git.add('.');
    await git.commit('Initial commit for pentest session');
  }

  // Create session state
  const state: SessionState = {
    sessionId,
    repoPath: repoDir,
    webUrl: input.webUrl,
    branch: input.branch || 'main',
    startTime: new Date(),
    currentAgent: null,
    completedAgents: [],
    checkpoints: new Map(),
  };

  sessions.set(sessionId, state);

  logger.info(`Session initialized`, {
    sessionId,
    repoPath: repoDir,
    deliverablesDir,
  });

  return state;
}

/**
 * Clone repository from remote
 */
async function cloneRepository(
  repoUrl: string,
  targetDir: string,
  branch?: string
): Promise<void> {
  logger.info(`Cloning repository`, { repoUrl, targetDir, branch });

  const git = simpleGit();

  const cloneOptions: string[] = ['--depth', '1'];
  if (branch) {
    cloneOptions.push('--branch', branch);
  }

  await git.clone(repoUrl, targetDir, cloneOptions);

  logger.info(`Repository cloned`, { targetDir });
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

/**
 * Get session metadata for audit
 */
export function getSessionMetadata(sessionId: string): SessionMetadata | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  return {
    sessionId: session.sessionId,
    startTime: session.startTime.toISOString(),
    webUrl: session.webUrl,
    repoPath: session.repoPath,
  };
}

// ============================================================================
// Agent Tracking
// ============================================================================

/**
 * Mark agent as started
 */
export function startAgent(sessionId: string, agent: AgentName): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.currentAgent = agent;
    logger.info(`Agent started`, { sessionId, agent });
  }
}

/**
 * Mark agent as completed
 */
export function completeAgent(sessionId: string, agent: AgentName): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.completedAgents.push(agent);
    session.currentAgent = null;
    logger.info(`Agent completed`, { sessionId, agent });
  }
}

/**
 * Get completed agents for session
 */
export function getCompletedAgents(sessionId: string): AgentName[] {
  const session = sessions.get(sessionId);
  return session?.completedAgents || [];
}

// ============================================================================
// Git Checkpoints
// ============================================================================

/**
 * Create git checkpoint before agent execution
 */
export async function createCheckpoint(
  sessionId: string,
  agent: AgentName
): Promise<string> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const git = simpleGit(session.repoPath);

  // Stash any uncommitted changes
  await git.stash();

  // Get current commit hash
  const log = await git.log({ maxCount: 1 });
  const checkpoint = log.latest?.hash || 'HEAD';

  session.checkpoints.set(agent, checkpoint);

  logger.info(`Checkpoint created`, { sessionId, agent, checkpoint });

  return checkpoint;
}

/**
 * Commit changes after successful agent execution
 */
export async function commitChanges(
  sessionId: string,
  agent: AgentName,
  attemptNumber: number
): Promise<string> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const git = simpleGit(session.repoPath);

  // Add all changes
  await git.add('.');

  // Commit with agent info
  const message = `Agent: ${agent} - Attempt ${attemptNumber}`;
  await git.commit(message);

  // Get commit hash
  const log = await git.log({ maxCount: 1 });
  const commitHash = log.latest?.hash || '';

  logger.info(`Changes committed`, { sessionId, agent, commitHash });

  return commitHash;
}

/**
 * Rollback to checkpoint after failed agent execution
 */
export async function rollbackToCheckpoint(
  sessionId: string,
  agent: AgentName
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const checkpoint = session.checkpoints.get(agent);
  if (!checkpoint) {
    logger.warn(`No checkpoint found for agent`, { sessionId, agent });
    return;
  }

  const git = simpleGit(session.repoPath);

  // Hard reset to checkpoint
  await git.reset(['--hard', checkpoint]);

  // Clean untracked files
  await git.clean('f', ['-d']);

  logger.info(`Rolled back to checkpoint`, { sessionId, agent, checkpoint });
}

// ============================================================================
// Deliverables
// ============================================================================

/**
 * Get deliverables directory for session
 */
export function getDeliverablesDir(sessionId: string): string {
  return path.join(PENTEST_BASE_DIR, sessionId, 'deliverables');
}

/**
 * Get repository directory for session
 */
export function getRepoDir(sessionId: string): string {
  const session = sessions.get(sessionId);
  return session?.repoPath || path.join(PENTEST_BASE_DIR, sessionId, 'repo');
}

/**
 * Check if deliverable exists
 */
export async function deliverableExists(
  sessionId: string,
  filename: string
): Promise<boolean> {
  const filePath = path.join(getDeliverablesDir(sessionId), filename);
  return fs.pathExists(filePath);
}

/**
 * Read deliverable content
 */
export async function readDeliverable(
  sessionId: string,
  filename: string
): Promise<string | null> {
  const filePath = path.join(getDeliverablesDir(sessionId), filename);

  if (!(await fs.pathExists(filePath))) {
    return null;
  }

  return fs.readFile(filePath, 'utf8');
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up session resources
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  const sessionDir = path.join(PENTEST_BASE_DIR, sessionId);

  logger.info(`Cleaning up session`, { sessionId, sessionDir });

  // Remove session directory
  await fs.remove(sessionDir);

  // Remove from memory
  sessions.delete(sessionId);

  logger.info(`Session cleaned up`, { sessionId });
}

/**
 * Clean up old sessions (older than maxAge)
 */
export async function cleanupOldSessions(maxAgeMs: number): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of sessions) {
    const age = now - session.startTime.getTime();
    if (age > maxAgeMs) {
      await cleanupSession(sessionId);
      cleaned++;
    }
  }

  return cleaned;
}

// ============================================================================
// Export session base dir for external use
// ============================================================================

export { PENTEST_BASE_DIR };
