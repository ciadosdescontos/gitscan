import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // GitHub OAuth
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/github/callback',
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // LLM Providers
  llm: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
    },
  },

  // Scanner Service
  scanner: {
    serviceUrl: process.env.SCANNER_SERVICE_URL || 'http://localhost:5000',
    timeoutMs: parseInt(process.env.SCANNER_TIMEOUT_MS || '300000', 10),
  },

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    prices: {
      free: 'price_free',
      pro: process.env.STRIPE_PRICE_PRO || '',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
    },
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // Helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
} as const;

// Validate required configuration
export function validateConfig(): void {
  const required = [
    'databaseUrl',
    'jwt.secret',
  ];

  const missing: string[] = [];

  for (const key of required) {
    const value = key.split('.').reduce((obj: any, k) => obj?.[k], config);
    if (!value || value === 'default-secret-change-me') {
      missing.push(key);
    }
  }

  if (missing.length > 0 && config.isProduction) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

export default config;
