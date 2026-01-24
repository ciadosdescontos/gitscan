/**
 * Shannon Helper MCP Tools
 *
 * Custom helper tools for Shannon pentest operations:
 * - Authentication flow helpers
 * - Evidence capture
 * - Deliverable management
 * - TOTP generation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { McpToolResult } from './types';
import { logger } from '../utils/logger';

// ============================================================================
// TOTP Generation
// ============================================================================

/**
 * Generate TOTP code from secret
 * Implements RFC 6238 TOTP algorithm
 */
export function generateTOTP(secret: string, period: number = 30): string {
  // Decode base32 secret
  const key = base32Decode(secret.replace(/\s/g, '').toUpperCase());

  // Get current time step
  const time = Math.floor(Date.now() / 1000 / period);

  // Generate HMAC-SHA1
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(time));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(timeBuffer);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  // Generate 6-digit code
  const otp = (binary % 1000000).toString().padStart(6, '0');

  return otp;
}

/**
 * Decode base32 string
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (const char of encoded) {
    if (char === '=') break;
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

// ============================================================================
// Evidence Capture
// ============================================================================

interface EvidenceCapture {
  timestamp: string;
  type: 'screenshot' | 'request' | 'response' | 'console' | 'network' | 'custom';
  description: string;
  data: string | Record<string, unknown>;
  vulnerability?: string;
  severity?: string;
}

/**
 * Save evidence to deliverables directory
 */
export async function saveEvidence(
  sessionDir: string,
  agentName: string,
  evidence: EvidenceCapture
): Promise<McpToolResult> {
  try {
    const evidenceDir = path.join(sessionDir, 'deliverables', 'evidence', agentName);
    await fs.ensureDir(evidenceDir);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${evidence.type}_${timestamp}.json`;
    const filepath = path.join(evidenceDir, filename);

    // Save evidence
    await fs.writeJson(filepath, evidence, { spaces: 2 });

    // If screenshot, also save as PNG
    if (evidence.type === 'screenshot' && typeof evidence.data === 'string') {
      const screenshotPath = filepath.replace('.json', '.png');
      const buffer = Buffer.from(evidence.data, 'base64');
      await fs.writeFile(screenshotPath, buffer);
    }

    logger.debug('Evidence saved', {
      agentName,
      type: evidence.type,
      filepath,
    });

    return {
      success: true,
      output: { filepath, type: evidence.type },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to save evidence', { agentName, error: message });
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Load all evidence for an agent
 */
export async function loadEvidence(
  sessionDir: string,
  agentName: string
): Promise<EvidenceCapture[]> {
  const evidenceDir = path.join(sessionDir, 'deliverables', 'evidence', agentName);

  if (!(await fs.pathExists(evidenceDir))) {
    return [];
  }

  const files = await fs.readdir(evidenceDir);
  const evidence: EvidenceCapture[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await fs.readJson(path.join(evidenceDir, file));
        evidence.push(content);
      } catch {
        // Skip invalid files
      }
    }
  }

  return evidence.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// ============================================================================
// Authentication State Management
// ============================================================================

interface AuthState {
  authenticated: boolean;
  method: string;
  timestamp: string;
  cookies?: Record<string, string>;
  tokens?: Record<string, string>;
  sessionInfo?: Record<string, unknown>;
}

const authStates = new Map<string, AuthState>();

/**
 * Save authentication state after successful login
 */
export function saveAuthState(
  sessionId: string,
  state: Omit<AuthState, 'timestamp'>
): void {
  authStates.set(sessionId, {
    ...state,
    timestamp: new Date().toISOString(),
  });

  logger.info('Auth state saved', {
    sessionId,
    method: state.method,
    authenticated: state.authenticated,
  });
}

/**
 * Get authentication state
 */
export function getAuthState(sessionId: string): AuthState | null {
  return authStates.get(sessionId) || null;
}

/**
 * Clear authentication state
 */
export function clearAuthState(sessionId: string): void {
  authStates.delete(sessionId);
}

// ============================================================================
// Deliverable Helpers
// ============================================================================

/**
 * Append finding to vulnerability report
 */
export async function appendFinding(
  sessionDir: string,
  reportFile: string,
  finding: {
    title: string;
    severity: string;
    description: string;
    location: string;
    evidence?: string;
    recommendation?: string;
    cwe?: string;
  }
): Promise<McpToolResult> {
  try {
    const reportPath = path.join(sessionDir, 'deliverables', reportFile);

    // Create or append to report
    let content = '';
    if (await fs.pathExists(reportPath)) {
      content = await fs.readFile(reportPath, 'utf-8');
    } else {
      // Initialize report with header
      const vulnType = reportFile.replace('_vulnerability_report.md', '');
      content = `# ${vulnType.toUpperCase()} Vulnerability Report\n\n`;
      content += `Generated: ${new Date().toISOString()}\n\n`;
      content += `---\n\n`;
    }

    // Append finding
    content += `## ${finding.title}\n\n`;
    content += `**Severity:** ${finding.severity}\n\n`;
    content += `**Location:** ${finding.location}\n\n`;
    content += `### Description\n\n${finding.description}\n\n`;

    if (finding.evidence) {
      content += `### Evidence\n\n\`\`\`\n${finding.evidence}\n\`\`\`\n\n`;
    }

    if (finding.recommendation) {
      content += `### Recommendation\n\n${finding.recommendation}\n\n`;
    }

    if (finding.cwe) {
      content += `**CWE:** ${finding.cwe}\n\n`;
    }

    content += `---\n\n`;

    await fs.writeFile(reportPath, content);

    return {
      success: true,
      output: { reportPath, findingTitle: finding.title },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Add item to exploitation queue
 */
export async function addToExploitQueue(
  sessionDir: string,
  vulnType: string,
  item: {
    id: string;
    severity: string;
    endpoint: string;
    parameter?: string;
    description: string;
    exploitStrategy?: string;
  }
): Promise<McpToolResult> {
  try {
    const queueFile = path.join(
      sessionDir,
      'deliverables',
      `${vulnType}_exploitation_queue.json`
    );

    // Load existing queue or create new
    let queue = {
      vulnType,
      createdAt: new Date().toISOString(),
      items: [] as typeof item[],
    };

    if (await fs.pathExists(queueFile)) {
      queue = await fs.readJson(queueFile);
    }

    // Check for duplicates
    const exists = queue.items.some(
      (existing) =>
        existing.endpoint === item.endpoint &&
        existing.parameter === item.parameter
    );

    if (!exists) {
      queue.items.push({
        ...item,
        priority: getSeverityPriority(item.severity),
      } as any);

      // Sort by priority
      queue.items.sort((a: any, b: any) => b.priority - a.priority);

      await fs.writeJson(queueFile, queue, { spaces: 2 });
    }

    return {
      success: true,
      output: { queueFile, itemCount: queue.items.length },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: message,
    };
  }
}

function getSeverityPriority(severity: string): number {
  const priorities: Record<string, number> = {
    critical: 100,
    high: 80,
    medium: 60,
    low: 40,
    info: 20,
  };
  return priorities[severity.toLowerCase()] || 0;
}

// ============================================================================
// Request/Response Logging
// ============================================================================

interface HttpExchange {
  timestamp: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body?: string;
  };
  duration?: number;
}

/**
 * Log HTTP exchange for audit trail
 */
export async function logHttpExchange(
  sessionDir: string,
  agentName: string,
  exchange: Omit<HttpExchange, 'timestamp'>
): Promise<void> {
  const logDir = path.join(sessionDir, 'deliverables', 'http-logs', agentName);
  await fs.ensureDir(logDir);

  const logFile = path.join(logDir, 'exchanges.jsonl');

  const entry: HttpExchange = {
    timestamp: new Date().toISOString(),
    ...exchange,
  };

  await fs.appendFile(logFile, JSON.stringify(entry) + '\n');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique ID for findings
 */
export function generateFindingId(vulnType: string, endpoint: string): string {
  const hash = crypto
    .createHash('md5')
    .update(`${vulnType}:${endpoint}:${Date.now()}`)
    .digest('hex')
    .substring(0, 8);

  return `${vulnType.toUpperCase()}-${hash}`;
}

/**
 * Sanitize user input for safe logging
 */
export function sanitizeForLog(input: string, maxLength: number = 1000): string {
  // Remove potential secrets
  let sanitized = input
    .replace(/password[=:]\s*[^\s&]+/gi, 'password=***')
    .replace(/token[=:]\s*[^\s&]+/gi, 'token=***')
    .replace(/api[_-]?key[=:]\s*[^\s&]+/gi, 'api_key=***')
    .replace(/bearer\s+[^\s]+/gi, 'Bearer ***');

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
  }

  return sanitized;
}
