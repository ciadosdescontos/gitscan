/**
 * Config Security Validation
 *
 * Security checks for pentest configuration files
 */

import { PentestConfig, ValidationError } from './types';

// ============================================================================
// Security Patterns
// ============================================================================

/**
 * Patterns that might indicate hardcoded sensitive data
 */
const SENSITIVE_PATTERNS = [
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/i, name: 'AWS Access Key' },
  { pattern: /aws[_-]?secret[_-]?access[_-]?key/i, name: 'AWS Secret Key reference' },

  // Private Keys
  { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i, name: 'Private Key' },

  // API Keys (generic patterns)
  { pattern: /sk[_-]live[_-][a-zA-Z0-9]{24,}/i, name: 'Stripe Secret Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/i, name: 'GitHub Personal Access Token' },
  { pattern: /ghr_[a-zA-Z0-9]{36}/i, name: 'GitHub Refresh Token' },

  // JWTs (might be test tokens, but flag them)
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/i, name: 'JWT Token' },

  // Generic API key patterns
  { pattern: /api[_-]?key[_-]?=\s*[a-zA-Z0-9]{20,}/i, name: 'Generic API Key' },
];

/**
 * Known test/placeholder values that are safe
 */
const KNOWN_PLACEHOLDERS = [
  'password',
  'password123',
  'test',
  'testuser',
  'testpassword',
  'admin',
  'user',
  'changeme',
  'secret',
  'example',
  'placeholder',
  '<your-token-here>',
  '${',  // Environment variable reference
  'process.env.',
];

/**
 * Dangerous path patterns to warn about
 */
const DANGEROUS_PATHS = [
  { pattern: /\/?(admin|administrator)/i, severity: 'warning', reason: 'Administrative paths may have destructive actions' },
  { pattern: /\/?(delete|remove|destroy|drop)/i, severity: 'warning', reason: 'Destructive action endpoints' },
  { pattern: /\/?(reset|wipe|clear)/i, severity: 'warning', reason: 'Data reset endpoints' },
  { pattern: /\/?(prod|production)/i, severity: 'error', reason: 'Production environment reference' },
];

// ============================================================================
// Security Checks
// ============================================================================

/**
 * Check for sensitive data in configuration
 */
export function checkSensitiveData(config: PentestConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check authentication credentials
  if (config.authentication) {
    const authJson = JSON.stringify(config.authentication);

    for (const { pattern, name } of SENSITIVE_PATTERNS) {
      if (pattern.test(authJson)) {
        errors.push({
          path: '/authentication',
          message: `Potential ${name} detected. Consider using environment variables.`,
        });
      }
    }

    // Check if credentials look real (not placeholders)
    if ('credentials' in config.authentication && config.authentication.credentials) {
      const credentials = config.authentication.credentials as { username?: string; password?: string };
      const { username, password } = credentials;

      if (username && !isPlaceholder(username) && looksLikeRealEmail(username)) {
        errors.push({
          path: '/authentication/credentials/username',
          message: 'Username looks like a real email address. Ensure this is a test account.',
        });
      }

      if (password && !isPlaceholder(password) && looksLikeStrongPassword(password)) {
        errors.push({
          path: '/authentication/credentials/password',
          message: 'Password appears to be a real credential. Consider using environment variables.',
        });
      }
    }

    // Check bearer tokens
    if ('token' in config.authentication && config.authentication.login_type === 'bearer') {
      if (!isPlaceholder(config.authentication.token)) {
        for (const { pattern, name } of SENSITIVE_PATTERNS) {
          if (pattern.test(config.authentication.token)) {
            errors.push({
              path: '/authentication/token',
              message: `${name} detected. Use environment variables instead.`,
            });
            break;
          }
        }
      }
    }

    // Check OAuth2 secrets
    if (config.authentication.login_type === 'oauth2') {
      const oauth = config.authentication;
      if (!isPlaceholder(oauth.client_secret)) {
        errors.push({
          path: '/authentication/client_secret',
          message: 'OAuth2 client secret should use environment variables.',
        });
      }
    }

    // Check API keys
    if (config.authentication.login_type === 'api_key') {
      if (!isPlaceholder(config.authentication.key)) {
        errors.push({
          path: '/authentication/key',
          message: 'API key should use environment variables.',
        });
      }
    }
  }

  // Check variables for secrets
  if (config.variables) {
    for (const [key, value] of Object.entries(config.variables)) {
      if (typeof value === 'string' && !isPlaceholder(value)) {
        for (const { pattern, name } of SENSITIVE_PATTERNS) {
          if (pattern.test(value)) {
            errors.push({
              path: `/variables/${key}`,
              message: `Variable "${key}" contains ${name}. Use environment variables.`,
            });
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Check for dangerous path configurations
 */
export function checkDangerousPaths(config: PentestConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check focus paths for dangerous patterns
  if (config.rules?.focus) {
    for (const rule of config.rules.focus) {
      if (rule.type === 'path') {
        const path = (rule as { url_path: string }).url_path;
        for (const { pattern, severity, reason } of DANGEROUS_PATHS) {
          if (pattern.test(path)) {
            errors.push({
              path: '/rules/focus',
              message: `${severity === 'error' ? 'ERROR' : 'WARNING'}: Path "${path}" - ${reason}`,
            });
          }
        }
      }
    }
  }

  // Check target URL
  const targetUrl = config.target.url.toLowerCase();
  if (targetUrl.includes('prod') || targetUrl.includes('production')) {
    errors.push({
      path: '/target/url',
      message: 'Target URL contains "prod" or "production". Ensure this is a test environment.',
    });
  }

  // Check for localhost/internal targets (usually safe)
  const isLocalhost = targetUrl.includes('localhost') ||
    targetUrl.includes('127.0.0.1') ||
    targetUrl.includes('0.0.0.0');

  if (!isLocalhost) {
    errors.push({
      path: '/target/url',
      message: 'WARNING: Target is not localhost. Ensure you have authorization to test this target.',
    });
  }

  return errors;
}

/**
 * Check for scope issues
 */
export function checkScope(config: PentestConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Warn if no avoid rules are set
  if (!config.rules?.avoid || config.rules.avoid.length === 0) {
    errors.push({
      path: '/rules/avoid',
      message: 'WARNING: No "avoid" rules set. Consider excluding sensitive paths like /admin, /delete, etc.',
    });
  }

  // Warn about broad focus
  if (config.rules?.focus) {
    const hasWildcardAll = config.rules.focus.some(r =>
      r.type === 'path' && (r as { url_path: string }).url_path === '/**'
    );
    if (hasWildcardAll) {
      errors.push({
        path: '/rules/focus',
        message: 'WARNING: Focus includes "/**" which tests all paths. This may be dangerous.',
      });
    }
  }

  // Check for high rate limits
  if (config.rules?.rate_limit && config.rules.rate_limit > 100) {
    errors.push({
      path: '/rules/rate_limit',
      message: `WARNING: Rate limit of ${config.rules.rate_limit} req/s is high. This may cause DoS on the target.`,
    });
  }

  return errors;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a value is a known placeholder
 */
function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return KNOWN_PLACEHOLDERS.some(p => lower.includes(p)) ||
    value.startsWith('${') ||  // Shell variable
    value.includes('process.env.') ||  // Node env
    value.includes('<') && value.includes('>');  // <placeholder>
}

/**
 * Check if a string looks like a real email
 */
function looksLikeRealEmail(value: string): boolean {
  // Simple email pattern
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(value)) return false;

  // Check if it's a test/placeholder email
  const testDomains = ['test.com', 'example.com', 'localhost', 'test.local', 'mailinator.com'];
  const domain = value.split('@')[1].toLowerCase();

  return !testDomains.some(d => domain.includes(d));
}

/**
 * Check if a password looks like a real (strong) password
 */
function looksLikeStrongPassword(value: string): boolean {
  // Real passwords usually have:
  // - Mix of uppercase, lowercase, numbers, special chars
  // - Length > 8
  // - Not a common placeholder

  if (value.length < 8) return false;
  if (isPlaceholder(value)) return false;

  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

  // If it has 3+ character classes, it's probably real
  const classes = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  return classes >= 3;
}

// ============================================================================
// Combined Security Check
// ============================================================================

/**
 * Run all security checks on configuration
 */
export function runSecurityChecks(config: PentestConfig): {
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const allIssues = [
    ...checkSensitiveData(config),
    ...checkDangerousPaths(config),
    ...checkScope(config),
  ];

  // Separate errors from warnings
  const errors = allIssues.filter(e => !e.message.startsWith('WARNING'));
  const warnings = allIssues.filter(e => e.message.startsWith('WARNING'));

  return { errors, warnings };
}
