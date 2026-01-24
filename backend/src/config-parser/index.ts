/**
 * Config Parser Module Exports
 *
 * YAML configuration parsing and validation for pentest workflows
 */

// Main parser functions
export {
  loadConfigFile,
  parseConfigString,
  parseYaml,
  interpolateEnvVars,
  findUnresolvedEnvVars,
  getDefaultConfig,
  mergeWithDefaults,
  generateSampleConfig,
} from './parser';

// Validation functions
export {
  validateConfig,
  validateAgainstSchema,
  validateSemantics,
} from './validator';

// Security checks
export {
  runSecurityChecks,
  checkSensitiveData,
  checkDangerousPaths,
  checkScope,
} from './security';

// Types
export type {
  // Rule types
  RuleType,
  Rule,
  PathRule,
  ParameterRule,
  DomainRule,
  MethodRule,
  ContentTypeRule,
  RulesConfig,

  // Authentication types
  LoginType,
  AuthenticationConfig,
  FormLoginConfig,
  BasicAuthConfig,
  BearerAuthConfig,
  OAuth2Config,
  ApiKeyConfig,
  CustomAuthConfig,

  // Configuration types
  TargetConfig,
  AgentConfig,
  OutputConfig,
  PentestConfig,

  // Validation types
  ValidationError,
  ValidationResult,
  ParseResult,
} from './types';
