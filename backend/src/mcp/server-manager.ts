/**
 * MCP Server Manager
 *
 * Manages lifecycle of Playwright MCP servers:
 * - Starting/stopping servers
 * - Health monitoring
 * - Server allocation for agents
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  McpServerName,
  McpServerConfig,
  McpServerStatus,
  AGENT_MCP_MAPPING,
} from './types';
import {
  MCP_SERVERS,
  MCP_TIMEOUTS,
  isDockerEnvironment,
  getMcpServerUrl,
} from './config';
import { AgentName } from '../temporal/types';
import { logger } from '../utils/logger';

// ============================================================================
// Server Process Management
// ============================================================================

interface ManagedServer {
  config: McpServerConfig;
  process: ChildProcess | null;
  status: McpServerStatus;
  startTime?: number;
}

const managedServers = new Map<McpServerName, ManagedServer>();

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize server manager
 */
export async function initializeServerManager(): Promise<void> {
  // Initialize all server entries
  for (const [name, config] of Object.entries(MCP_SERVERS)) {
    managedServers.set(name as McpServerName, {
      config,
      process: null,
      status: {
        name: name as McpServerName,
        running: false,
        healthy: false,
        port: config.port,
      },
    });
  }

  // Ensure user data directories exist
  for (const config of Object.values(MCP_SERVERS)) {
    await fs.ensureDir(config.userDataDir);
  }

  logger.info('MCP Server Manager initialized', {
    serverCount: managedServers.size,
    isDocker: isDockerEnvironment(),
  });
}

// ============================================================================
// Server Lifecycle
// ============================================================================

/**
 * Start an MCP server
 */
export async function startServer(serverName: McpServerName): Promise<boolean> {
  const server = managedServers.get(serverName);
  if (!server) {
    logger.error('Unknown MCP server', { serverName });
    return false;
  }

  if (server.status.running) {
    logger.debug('Server already running', { serverName });
    return true;
  }

  // In Docker, servers are managed by docker-compose
  if (isDockerEnvironment()) {
    logger.info('Assuming Docker-managed server is running', { serverName });
    server.status.running = true;
    return await checkServerHealth(serverName);
  }

  const { config } = server;

  logger.info('Starting MCP server', {
    serverName,
    command: config.command,
    args: config.args,
  });

  try {
    // Ensure user data directory exists
    await fs.ensureDir(config.userDataDir);

    // Spawn server process
    const proc = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    server.process = proc;
    server.startTime = Date.now();

    // Handle process events
    proc.on('error', (error) => {
      logger.error('MCP server process error', { serverName, error: error.message });
      server.status.running = false;
      server.status.healthy = false;
      server.status.error = error.message;
    });

    proc.on('exit', (code, signal) => {
      logger.warn('MCP server process exited', { serverName, code, signal });
      server.status.running = false;
      server.status.healthy = false;
      server.process = null;
    });

    // Capture stdout/stderr for debugging
    proc.stdout?.on('data', (data) => {
      logger.debug('MCP server stdout', { serverName, data: data.toString() });
    });

    proc.stderr?.on('data', (data) => {
      logger.debug('MCP server stderr', { serverName, data: data.toString() });
    });

    server.status.running = true;
    server.status.pid = proc.pid;

    // Wait for server to be healthy
    const healthy = await waitForHealth(serverName, MCP_TIMEOUTS.startupTimeoutMs);

    if (!healthy) {
      logger.error('MCP server failed health check after startup', { serverName });
      await stopServer(serverName);
      return false;
    }

    logger.info('MCP server started successfully', {
      serverName,
      pid: proc.pid,
      port: config.port,
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start MCP server', { serverName, error: message });
    server.status.error = message;
    return false;
  }
}

/**
 * Stop an MCP server
 */
export async function stopServer(serverName: McpServerName): Promise<void> {
  const server = managedServers.get(serverName);
  if (!server) return;

  if (server.process) {
    logger.info('Stopping MCP server', { serverName, pid: server.process.pid });

    // Try graceful shutdown first
    server.process.kill('SIGTERM');

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if still running
        if (server.process) {
          server.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      server.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    server.process = null;
  }

  server.status.running = false;
  server.status.healthy = false;
  server.status.pid = undefined;

  logger.info('MCP server stopped', { serverName });
}

/**
 * Start all MCP servers
 */
export async function startAllServers(): Promise<Record<McpServerName, boolean>> {
  const results: Record<string, boolean> = {};

  const startPromises = Object.keys(MCP_SERVERS).map(async (name) => {
    const serverName = name as McpServerName;
    results[serverName] = await startServer(serverName);
  });

  await Promise.all(startPromises);

  logger.info('All MCP servers start attempt completed', { results });

  return results as Record<McpServerName, boolean>;
}

/**
 * Stop all MCP servers
 */
export async function stopAllServers(): Promise<void> {
  const stopPromises = Array.from(managedServers.keys()).map(stopServer);
  await Promise.all(stopPromises);

  logger.info('All MCP servers stopped');
}

// ============================================================================
// Health Checking
// ============================================================================

/**
 * Check health of an MCP server
 */
export async function checkServerHealth(serverName: McpServerName): Promise<boolean> {
  const server = managedServers.get(serverName);
  if (!server) return false;

  try {
    const url = getMcpServerUrl(serverName);
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(MCP_TIMEOUTS.healthCheckTimeoutMs),
    });

    const healthy = response.ok;
    server.status.healthy = healthy;
    server.status.lastHealthCheck = new Date().toISOString();

    return healthy;
  } catch {
    server.status.healthy = false;
    server.status.lastHealthCheck = new Date().toISOString();
    return false;
  }
}

/**
 * Wait for server to become healthy
 */
async function waitForHealth(
  serverName: McpServerName,
  timeoutMs: number
): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 500;

  while (Date.now() - startTime < timeoutMs) {
    if (await checkServerHealth(serverName)) {
      return true;
    }
    await sleep(checkInterval);
  }

  return false;
}

/**
 * Get status of all servers
 */
export function getAllServerStatus(): Record<McpServerName, McpServerStatus> {
  const status: Record<string, McpServerStatus> = {};

  for (const [name, server] of managedServers) {
    status[name] = { ...server.status };
  }

  return status as Record<McpServerName, McpServerStatus>;
}

/**
 * Get status of a single server
 */
export function getServerStatus(serverName: McpServerName): McpServerStatus | null {
  const server = managedServers.get(serverName);
  return server ? { ...server.status } : null;
}

// ============================================================================
// Agent Server Allocation
// ============================================================================

/**
 * Get the MCP server assigned to an agent
 */
export function getServerForAgent(agentName: AgentName): McpServerName {
  return AGENT_MCP_MAPPING[agentName];
}

/**
 * Ensure server is ready for an agent
 * Starts the server if not running and waits for health
 */
export async function ensureServerForAgent(agentName: AgentName): Promise<boolean> {
  const serverName = getServerForAgent(agentName);

  const server = managedServers.get(serverName);
  if (!server) {
    logger.error('No server configured for agent', { agentName, serverName });
    return false;
  }

  // Check if already healthy
  if (server.status.running && server.status.healthy) {
    return true;
  }

  // Try to start/restart
  return await startServer(serverName);
}

/**
 * Get server URL for an agent
 */
export function getServerUrlForAgent(agentName: AgentName): string {
  const serverName = getServerForAgent(agentName);
  return getMcpServerUrl(serverName);
}

// ============================================================================
// Browser Session Management
// ============================================================================

/**
 * Clear browser data for a server
 * Useful for starting fresh between pentest sessions
 */
export async function clearBrowserData(serverName: McpServerName): Promise<void> {
  const server = managedServers.get(serverName);
  if (!server) return;

  const { userDataDir } = server.config;

  // Stop server if running
  const wasRunning = server.status.running;
  if (wasRunning) {
    await stopServer(serverName);
  }

  // Clear user data
  if (await fs.pathExists(userDataDir)) {
    await fs.remove(userDataDir);
    await fs.ensureDir(userDataDir);
  }

  logger.info('Browser data cleared', { serverName, userDataDir });

  // Restart if it was running
  if (wasRunning) {
    await startServer(serverName);
  }
}

/**
 * Clear all browser data
 */
export async function clearAllBrowserData(): Promise<void> {
  for (const serverName of managedServers.keys()) {
    await clearBrowserData(serverName);
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Cleanup on Exit
// ============================================================================

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, stopping MCP servers');
  await stopAllServers();
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, stopping MCP servers');
  await stopAllServers();
});
