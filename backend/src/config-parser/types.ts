/**
 * Config Parser Types
 *
 * Type definitions for pentest configuration YAML files
 */

// ============================================================================
// Rule Types
// ============================================================================

export type RuleType = 'path' | 'parameter' | 'domain' | 'method' | 'content-type';

export interface BaseRule {
  type: RuleType;
  description?: string;
}

export interface PathRule extends BaseRule {
  type: 'path';
  url_path: string;  // Glob pattern like /admin/* or /api/v1/**
}

export interface ParameterRule extends BaseRule {
  type: 'parameter';
  parameter: string;  // Parameter name to match
  value?: string;     // Optional value to match
}

export interface DomainRule extends BaseRule {
  type: 'domain';
  domain: string;  // Domain pattern like *.internal.com
}

export interface MethodRule extends BaseRule {
  type: 'method';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
}

export interface ContentTypeRule extends BaseRule {
  type: 'content-type';
  content_type: string;  // MIME type pattern
}

export type Rule = PathRule | ParameterRule | DomainRule | MethodRule | ContentTypeRule;

// ============================================================================
// Rules Configuration
// ============================================================================

export interface RulesConfig {
  /**
   * Paths/patterns to avoid during testing
   * These will be excluded from all scanning/exploitation
   */
  avoid?: Rule[];

  /**
   * Paths/patterns to focus on during testing
   * If specified, only these will be tested
   */
  focus?: Rule[];

  /**
   * Maximum depth for crawling/exploration
   */
  max_depth?: number;

  /**
   * Rate limiting (requests per second)
   */
  rate_limit?: number;
}

// ============================================================================
// Authentication Configuration
// ============================================================================

export type LoginType = 'form' | 'basic' | 'bearer' | 'oauth2' | 'api_key' | 'custom';

export interface FormLoginConfig {
  login_type: 'form';
  login_url: string;
  credentials: {
    username: string;
    password: string;
  };
  /**
   * Natural language instructions for login flow
   * e.g., ["Type username into email field", "Type password", "Click login button"]
   */
  login_flow?: string[];
  /**
   * CSS selectors for form fields (alternative to natural language)
   */
  selectors?: {
    username?: string;
    password?: string;
    submit?: string;
  };
  /**
   * URL or element to verify successful login
   */
  success_indicator?: string;
}

export interface BasicAuthConfig {
  login_type: 'basic';
  credentials: {
    username: string;
    password: string;
  };
}

export interface BearerAuthConfig {
  login_type: 'bearer';
  token: string;
  header_name?: string;  // Default: Authorization
}

export interface OAuth2Config {
  login_type: 'oauth2';
  client_id: string;
  client_secret: string;
  token_url: string;
  scope?: string;
  grant_type?: 'client_credentials' | 'password' | 'authorization_code';
  credentials?: {
    username: string;
    password: string;
  };
}

export interface ApiKeyConfig {
  login_type: 'api_key';
  key: string;
  header_name?: string;  // Default: X-API-Key
  query_param?: string;  // Alternative: pass as query parameter
}

export interface CustomAuthConfig {
  login_type: 'custom';
  /**
   * Natural language instructions for custom auth flow
   */
  instructions: string[];
  /**
   * Headers to set for authentication
   */
  headers?: Record<string, string>;
  /**
   * Cookies to set for authentication
   */
  cookies?: Record<string, string>;
}

export type AuthenticationConfig =
  | FormLoginConfig
  | BasicAuthConfig
  | BearerAuthConfig
  | OAuth2Config
  | ApiKeyConfig
  | CustomAuthConfig;

// ============================================================================
// Target Configuration
// ============================================================================

export interface TargetConfig {
  /**
   * Base URL of the target application
   */
  url: string;

  /**
   * Name for identification in reports
   */
  name?: string;

  /**
   * Technology stack hints (helps agents focus)
   */
  tech_stack?: string[];

  /**
   * Additional URLs to include in scope
   */
  additional_urls?: string[];

  /**
   * Known API endpoints to test
   */
  api_endpoints?: string[];
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  /**
   * Agents to skip
   */
  skip?: string[];

  /**
   * Agents to run exclusively (if set, only these run)
   */
  only?: string[];

  /**
   * Per-agent configuration overrides
   */
  overrides?: Record<string, {
    max_attempts?: number;
    timeout_ms?: number;
    model?: string;
  }>;
}

// ============================================================================
// Output Configuration
// ============================================================================

export interface OutputConfig {
  /**
   * Output directory for deliverables
   */
  output_dir?: string;

  /**
   * Report formats to generate
   */
  report_formats?: ('markdown' | 'html' | 'pdf' | 'json')[];

  /**
   * Include detailed turn-by-turn logs in output
   */
  include_logs?: boolean;

  /**
   * Verbosity level
   */
  verbosity?: 'quiet' | 'normal' | 'verbose' | 'debug';
}

// ============================================================================
// Full Configuration
// ============================================================================

export interface PentestConfig {
  /**
   * Configuration version (for future compatibility)
   */
  version?: string;

  /**
   * Target application configuration
   */
  target: TargetConfig;

  /**
   * Authentication configuration
   */
  authentication?: AuthenticationConfig;

  /**
   * Rules for what to test/avoid
   */
  rules?: RulesConfig;

  /**
   * Agent-specific configuration
   */
  agents?: AgentConfig;

  /**
   * Output configuration
   */
  output?: OutputConfig;

  /**
   * Custom variables for prompt interpolation
   */
  variables?: Record<string, string>;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ParseResult {
  success: boolean;
  config?: PentestConfig;
  validation: ValidationResult;
  rawYaml?: string;
}
