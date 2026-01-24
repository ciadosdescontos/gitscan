/**
 * Agent Definitions
 *
 * Defines all 13 pentest agents with their properties,
 * prerequisites, and deliverables.
 */

import {
  AgentDefinition,
  AgentName,
  PhaseName,
  PromptName,
} from '../temporal/types';

// ============================================================================
// Agent Definitions
// ============================================================================

export const AGENTS: Record<AgentName, AgentDefinition> = {
  // ========================================================================
  // Phase 1: Pre-Reconnaissance
  // ========================================================================
  'pre-recon': {
    name: 'pre-recon',
    displayName: 'Pre-Reconnaissance',
    description: 'Static code analysis and external tool scanning. Integrates with Python scanner-service for comprehensive static analysis.',
    phase: 'pre-recon',
    prerequisites: [],
    promptName: 'pre-recon-code',
    mcpServer: 'playwright-agent1',
    validator: 'pre-recon',
    deliverables: [
      'deliverables/code_analysis_deliverable.md',
    ],
  },

  // ========================================================================
  // Phase 2: Reconnaissance
  // ========================================================================
  'recon': {
    name: 'recon',
    displayName: 'Reconnaissance',
    description: 'Attack surface mapping. Identifies endpoints, parameters, authentication flows, and potential entry points.',
    phase: 'recon',
    prerequisites: ['pre-recon'],
    promptName: 'recon',
    mcpServer: 'playwright-agent2',
    validator: 'recon',
    deliverables: [
      'deliverables/recon_deliverable.md',
    ],
  },

  // ========================================================================
  // Phase 3: Vulnerability Analysis
  // ========================================================================
  'injection-vuln': {
    name: 'injection-vuln',
    displayName: 'Injection Vulnerability Analysis',
    description: 'Detects SQL Injection, Command Injection, LDAP Injection, XPath Injection, and other injection vulnerabilities.',
    phase: 'vulnerability-analysis',
    prerequisites: ['recon'],
    promptName: 'vuln-injection',
    mcpServer: 'playwright-agent1',
    validator: 'injection-vuln',
    deliverables: [
      'deliverables/injection_analysis_deliverable.md',
      'deliverables/injection_exploitation_queue.json',
    ],
  },

  'xss-vuln': {
    name: 'xss-vuln',
    displayName: 'XSS Vulnerability Analysis',
    description: 'Detects Reflected XSS, Stored XSS, DOM-based XSS, and other Cross-Site Scripting vulnerabilities.',
    phase: 'vulnerability-analysis',
    prerequisites: ['recon'],
    promptName: 'vuln-xss',
    mcpServer: 'playwright-agent2',
    validator: 'xss-vuln',
    deliverables: [
      'deliverables/xss_analysis_deliverable.md',
      'deliverables/xss_exploitation_queue.json',
    ],
  },

  'auth-vuln': {
    name: 'auth-vuln',
    displayName: 'Authentication Vulnerability Analysis',
    description: 'Detects weak passwords, session management issues, MFA bypass, credential stuffing vulnerabilities.',
    phase: 'vulnerability-analysis',
    prerequisites: ['recon'],
    promptName: 'vuln-auth',
    mcpServer: 'playwright-agent3',
    validator: 'auth-vuln',
    deliverables: [
      'deliverables/auth_analysis_deliverable.md',
      'deliverables/auth_exploitation_queue.json',
    ],
  },

  'ssrf-vuln': {
    name: 'ssrf-vuln',
    displayName: 'SSRF Vulnerability Analysis',
    description: 'Detects Server-Side Request Forgery vulnerabilities including blind SSRF and DNS rebinding.',
    phase: 'vulnerability-analysis',
    prerequisites: ['recon'],
    promptName: 'vuln-ssrf',
    mcpServer: 'playwright-agent4',
    validator: 'ssrf-vuln',
    deliverables: [
      'deliverables/ssrf_analysis_deliverable.md',
      'deliverables/ssrf_exploitation_queue.json',
    ],
  },

  'authz-vuln': {
    name: 'authz-vuln',
    displayName: 'Authorization Vulnerability Analysis',
    description: 'Detects IDOR, privilege escalation, broken access control, and authorization bypass vulnerabilities.',
    phase: 'vulnerability-analysis',
    prerequisites: ['recon'],
    promptName: 'vuln-authz',
    mcpServer: 'playwright-agent5',
    validator: 'authz-vuln',
    deliverables: [
      'deliverables/authz_analysis_deliverable.md',
      'deliverables/authz_exploitation_queue.json',
    ],
  },

  // ========================================================================
  // Phase 4: Exploitation
  // ========================================================================
  'injection-exploit': {
    name: 'injection-exploit',
    displayName: 'Injection Exploitation',
    description: 'Attempts to exploit confirmed injection vulnerabilities with proof-of-concept payloads.',
    phase: 'exploitation',
    prerequisites: ['injection-vuln'],
    promptName: 'exploit-injection',
    mcpServer: 'playwright-agent1',
    validator: 'injection-exploit',
    deliverables: [
      'deliverables/injection_evidence.md',
    ],
  },

  'xss-exploit': {
    name: 'xss-exploit',
    displayName: 'XSS Exploitation',
    description: 'Attempts to exploit confirmed XSS vulnerabilities with proof-of-concept payloads.',
    phase: 'exploitation',
    prerequisites: ['xss-vuln'],
    promptName: 'exploit-xss',
    mcpServer: 'playwright-agent2',
    validator: 'xss-exploit',
    deliverables: [
      'deliverables/xss_evidence.md',
    ],
  },

  'auth-exploit': {
    name: 'auth-exploit',
    displayName: 'Authentication Exploitation',
    description: 'Attempts to exploit confirmed authentication vulnerabilities.',
    phase: 'exploitation',
    prerequisites: ['auth-vuln'],
    promptName: 'exploit-auth',
    mcpServer: 'playwright-agent3',
    validator: 'auth-exploit',
    deliverables: [
      'deliverables/auth_evidence.md',
    ],
  },

  'ssrf-exploit': {
    name: 'ssrf-exploit',
    displayName: 'SSRF Exploitation',
    description: 'Attempts to exploit confirmed SSRF vulnerabilities.',
    phase: 'exploitation',
    prerequisites: ['ssrf-vuln'],
    promptName: 'exploit-ssrf',
    mcpServer: 'playwright-agent4',
    validator: 'ssrf-exploit',
    deliverables: [
      'deliverables/ssrf_evidence.md',
    ],
  },

  'authz-exploit': {
    name: 'authz-exploit',
    displayName: 'Authorization Exploitation',
    description: 'Attempts to exploit confirmed authorization vulnerabilities.',
    phase: 'exploitation',
    prerequisites: ['authz-vuln'],
    promptName: 'exploit-authz',
    mcpServer: 'playwright-agent5',
    validator: 'authz-exploit',
    deliverables: [
      'deliverables/authz_evidence.md',
    ],
  },

  // ========================================================================
  // Phase 5: Reporting
  // ========================================================================
  'report': {
    name: 'report',
    displayName: 'Security Assessment Report',
    description: 'Generates comprehensive executive security assessment report aggregating all findings and evidence.',
    phase: 'reporting',
    prerequisites: [
      'injection-exploit',
      'xss-exploit',
      'auth-exploit',
      'ssrf-exploit',
      'authz-exploit',
    ],
    promptName: 'report-executive',
    mcpServer: 'playwright-agent3',
    validator: 'report',
    deliverables: [
      'deliverables/comprehensive_security_assessment_report.md',
    ],
  },
} as const;

// ============================================================================
// Agent Order (Execution Sequence)
// ============================================================================

export const AGENT_ORDER: AgentName[] = [
  'pre-recon',
  'recon',
  'injection-vuln',
  'xss-vuln',
  'auth-vuln',
  'ssrf-vuln',
  'authz-vuln',
  'injection-exploit',
  'xss-exploit',
  'auth-exploit',
  'ssrf-exploit',
  'authz-exploit',
  'report',
];

// ============================================================================
// Parallel Groups
// ============================================================================

export const PARALLEL_GROUPS = {
  vuln: [
    'injection-vuln',
    'xss-vuln',
    'auth-vuln',
    'ssrf-vuln',
    'authz-vuln',
  ] as AgentName[],
  exploit: [
    'injection-exploit',
    'xss-exploit',
    'auth-exploit',
    'ssrf-exploit',
    'authz-exploit',
  ] as AgentName[],
};

// ============================================================================
// Phase Definitions
// ============================================================================

export const PHASES: Record<PhaseName, { displayName: string; agents: AgentName[] }> = {
  'pre-recon': {
    displayName: 'Pre-Reconnaissance',
    agents: ['pre-recon'],
  },
  'recon': {
    displayName: 'Reconnaissance',
    agents: ['recon'],
  },
  'vulnerability-analysis': {
    displayName: 'Vulnerability Analysis',
    agents: PARALLEL_GROUPS.vuln,
  },
  'exploitation': {
    displayName: 'Exploitation',
    agents: PARALLEL_GROUPS.exploit,
  },
  'reporting': {
    displayName: 'Reporting',
    agents: ['report'],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get agent definition by name
 */
export function getAgent(name: AgentName): AgentDefinition {
  return AGENTS[name];
}

/**
 * Get all agents for a phase
 */
export function getAgentsForPhase(phase: PhaseName): AgentDefinition[] {
  return PHASES[phase].agents.map(name => AGENTS[name]);
}

/**
 * Get agents that can run in parallel
 */
export function getParallelAgents(phase: PhaseName): AgentName[][] {
  if (phase === 'vulnerability-analysis') {
    return [PARALLEL_GROUPS.vuln];
  }
  if (phase === 'exploitation') {
    return [PARALLEL_GROUPS.exploit];
  }
  return [PHASES[phase].agents];
}

/**
 * Check if agent prerequisites are met
 */
export function arePrerequisitesMet(
  agent: AgentName,
  completedAgents: AgentName[]
): boolean {
  const def = AGENTS[agent];
  return def.prerequisites.every(prereq => completedAgents.includes(prereq));
}

/**
 * Get next agents that can run based on completed agents
 */
export function getNextRunnableAgents(completedAgents: AgentName[]): AgentName[] {
  return AGENT_ORDER.filter(agent => {
    if (completedAgents.includes(agent)) return false;
    return arePrerequisitesMet(agent, completedAgents);
  });
}

// Freeze objects to prevent modifications
Object.freeze(AGENTS);
Object.freeze(AGENT_ORDER);
Object.freeze(PARALLEL_GROUPS);
Object.freeze(PHASES);
