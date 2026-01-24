/**
 * MCP Server Configuration
 *
 * Configuration for Playwright MCP servers
 */

import * as path from 'path';
import { McpServerConfig, McpServerName } from './types';

// ============================================================================
// Environment Detection
// ============================================================================

export function isDockerEnvironment(): boolean {
  return process.env.DOCKER_ENV === 'true' || process.env.CONTAINER === 'true';
}

// ============================================================================
// Base Paths
// ============================================================================

const USER_DATA_BASE = process.env.PLAYWRIGHT_USER_DATA_DIR || '/tmp/playwright-data';
const MCP_SERVER_COMMAND = process.env.MCP_PLAYWRIGHT_COMMAND || 'npx';
const MCP_SERVER_PACKAGE = '@anthropic/mcp-server-playwright';

// ============================================================================
// Server Configurations
// ============================================================================

/**
 * Generate server configuration for a Playwright agent
 */
function createServerConfig(
  name: McpServerName,
  port: number
): McpServerConfig {
  const userDataDir = path.join(USER_DATA_BASE, name);

  return {
    name,
    command: MCP_SERVER_COMMAND,
    args: [
      '-y',
      MCP_SERVER_PACKAGE,
      '--user-data-dir', userDataDir,
      '--headless',
    ],
    env: {
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright',
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
    userDataDir,
    port,
    healthEndpoint: `http://localhost:${port}/health`,
  };
}

/**
 * All MCP server configurations
 */
export const MCP_SERVERS: Record<McpServerName, McpServerConfig> = {
  'playwright-agent1': createServerConfig('playwright-agent1', 9001),
  'playwright-agent2': createServerConfig('playwright-agent2', 9002),
  'playwright-agent3': createServerConfig('playwright-agent3', 9003),
  'playwright-agent4': createServerConfig('playwright-agent4', 9004),
  'playwright-agent5': createServerConfig('playwright-agent5', 9005),
};

// ============================================================================
// Docker Compose Configuration
// ============================================================================

/**
 * Get Docker host for MCP server (when running in Docker)
 */
export function getDockerMcpHost(serverName: McpServerName): string {
  if (isDockerEnvironment()) {
    // In Docker, use container name as host
    return serverName;
  }
  return 'localhost';
}

/**
 * Get full MCP server URL
 */
export function getMcpServerUrl(serverName: McpServerName): string {
  const config = MCP_SERVERS[serverName];
  const host = getDockerMcpHost(serverName);
  return `http://${host}:${config.port}`;
}

// ============================================================================
// Claude SDK MCP Configuration
// ============================================================================

/**
 * Get MCP server config for Claude SDK
 * Format compatible with Anthropic SDK's MCP integration
 */
export function getClaudeMcpConfig(
  serverName: McpServerName,
  isDocker: boolean = isDockerEnvironment()
): Record<string, unknown> {
  const config = MCP_SERVERS[serverName];

  if (isDocker) {
    // Use stdio transport in Docker
    return {
      [serverName]: {
        command: 'docker',
        args: [
          'exec',
          '-i',
          serverName,
          'node',
          '/app/server.js',
        ],
      },
    };
  }

  // Use local npx for development
  return {
    [serverName]: {
      command: config.command,
      args: config.args,
      env: config.env,
    },
  };
}

/**
 * Get all MCP servers config for Claude SDK
 */
export function getAllMcpServersConfig(
  isDocker: boolean = isDockerEnvironment()
): Record<string, unknown> {
  const configs: Record<string, unknown> = {};

  for (const serverName of Object.keys(MCP_SERVERS) as McpServerName[]) {
    const serverConfig = getClaudeMcpConfig(serverName, isDocker);
    Object.assign(configs, serverConfig);
  }

  return configs;
}

// ============================================================================
// Timeouts and Limits
// ============================================================================

export const MCP_TIMEOUTS = {
  /** Timeout for starting MCP server */
  startupTimeoutMs: 30000,

  /** Timeout for health check */
  healthCheckTimeoutMs: 5000,

  /** Timeout for tool execution */
  toolExecutionTimeoutMs: 60000,

  /** Timeout for page navigation */
  navigationTimeoutMs: 30000,

  /** Interval between health checks */
  healthCheckIntervalMs: 10000,
};

export const MCP_LIMITS = {
  /** Maximum concurrent pages per server */
  maxPagesPerServer: 5,

  /** Maximum screenshot size in bytes */
  maxScreenshotSize: 5 * 1024 * 1024, // 5MB

  /** Maximum console log entries to capture */
  maxConsoleEntries: 100,

  /** Maximum retries for tool execution */
  maxToolRetries: 3,
};
