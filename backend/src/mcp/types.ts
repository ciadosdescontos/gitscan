/**
 * MCP (Model Context Protocol) Types
 *
 * Types for MCP server management and Playwright integration
 */

import { PromptName, AgentName } from '../temporal/types';

// ============================================================================
// Server Types
// ============================================================================

export type McpServerName =
  | 'playwright-agent1'
  | 'playwright-agent2'
  | 'playwright-agent3'
  | 'playwright-agent4'
  | 'playwright-agent5';

export interface McpServerConfig {
  name: McpServerName;
  command: string;
  args: string[];
  env?: Record<string, string>;
  userDataDir: string;
  port: number;
  healthEndpoint?: string;
}

export interface McpServerStatus {
  name: McpServerName;
  running: boolean;
  healthy: boolean;
  port: number;
  pid?: number;
  lastHealthCheck?: string;
  error?: string;
}

// ============================================================================
// Agent to Server Mapping
// ============================================================================

/**
 * Maps agents to their dedicated Playwright MCP server
 * Each server maintains its own browser context/session
 */
export const AGENT_MCP_MAPPING: Record<AgentName, McpServerName> = {
  'pre-recon': 'playwright-agent1',
  'recon': 'playwright-agent2',
  'injection-vuln': 'playwright-agent1',
  'xss-vuln': 'playwright-agent2',
  'auth-vuln': 'playwright-agent3',
  'ssrf-vuln': 'playwright-agent4',
  'authz-vuln': 'playwright-agent5',
  'injection-exploit': 'playwright-agent1',
  'xss-exploit': 'playwright-agent2',
  'auth-exploit': 'playwright-agent3',
  'ssrf-exploit': 'playwright-agent4',
  'authz-exploit': 'playwright-agent5',
  'report': 'playwright-agent3',
};

/**
 * Maps prompt names to MCP servers
 */
export const PROMPT_MCP_MAPPING: Record<PromptName, McpServerName> = {
  'pre-recon-code': 'playwright-agent1',
  'recon': 'playwright-agent2',
  'vuln-injection': 'playwright-agent1',
  'vuln-xss': 'playwright-agent2',
  'vuln-auth': 'playwright-agent3',
  'vuln-ssrf': 'playwright-agent4',
  'vuln-authz': 'playwright-agent5',
  'exploit-injection': 'playwright-agent1',
  'exploit-xss': 'playwright-agent2',
  'exploit-auth': 'playwright-agent3',
  'exploit-ssrf': 'playwright-agent4',
  'exploit-authz': 'playwright-agent5',
  'report-executive': 'playwright-agent3',
};

// ============================================================================
// MCP Tool Types
// ============================================================================

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  screenshot?: string; // Base64 encoded
  console?: string[];
}

// ============================================================================
// Browser Context Types
// ============================================================================

export interface BrowserContext {
  serverId: McpServerName;
  sessionId: string;
  cookies?: Record<string, string>;
  localStorage?: Record<string, string>;
  authenticated: boolean;
}

export interface BrowserState {
  url: string;
  title: string;
  cookies: Record<string, string>;
  localStorage: Record<string, string>;
}
