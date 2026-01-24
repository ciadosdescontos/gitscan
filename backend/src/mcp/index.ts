/**
 * MCP Module Exports
 *
 * Model Context Protocol integration for Playwright browser automation
 */

// Types
export type {
  McpServerName,
  McpServerConfig,
  McpServerStatus,
  McpToolCall,
  McpToolResult,
  BrowserContext,
  BrowserState,
} from './types';

export {
  AGENT_MCP_MAPPING,
  PROMPT_MCP_MAPPING,
} from './types';

// Configuration
export {
  MCP_SERVERS,
  MCP_TIMEOUTS,
  MCP_LIMITS,
  isDockerEnvironment,
  getDockerMcpHost,
  getMcpServerUrl,
  getClaudeMcpConfig,
  getAllMcpServersConfig,
} from './config';

// Server Manager
export {
  initializeServerManager,
  startServer,
  stopServer,
  startAllServers,
  stopAllServers,
  checkServerHealth,
  getAllServerStatus,
  getServerStatus,
  getServerForAgent,
  ensureServerForAgent,
  getServerUrlForAgent,
  clearBrowserData,
  clearAllBrowserData,
} from './server-manager';

// Shannon Helper Tools
export {
  generateTOTP,
  saveEvidence,
  loadEvidence,
  saveAuthState,
  getAuthState,
  clearAuthState,
  appendFinding,
  addToExploitQueue,
  logHttpExchange,
  generateFindingId,
  sanitizeForLog,
} from './shannon-helper';
