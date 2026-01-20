import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, ApiResponse, LlmProviderType } from '../types/index.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { ErrorCode } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Validation schemas
const saveApiKeySchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE']),
  apiKey: z.string().min(10, 'API key is too short'),
});

const updateModelSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE']),
  model: z.string().min(1),
});

// Simple encryption for API keys (in production, use proper encryption)
function encryptApiKey(key: string): string {
  // In production, use a proper encryption library like node-forge or crypto
  return Buffer.from(key).toString('base64');
}

function decryptApiKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// Save or update API key
export async function saveApiKey(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { provider, apiKey } = saveApiKeySchema.parse(req.body);
  const userId = req.user!.id;

  const encryptedKey = encryptApiKey(apiKey);

  const savedKey = await prisma.userApiKey.upsert({
    where: {
      userId_provider: {
        userId,
        provider: provider as LlmProviderType,
      },
    },
    update: {
      apiKey: encryptedKey,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      userId,
      provider: provider as LlmProviderType,
      apiKey: encryptedKey,
      isActive: true,
    },
    select: {
      id: true,
      provider: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info('API key saved', { userId, provider });

  res.json({
    success: true,
    data: savedKey,
  });
}

// List user's API keys (without exposing the actual keys)
export async function listApiKeys(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const userId = req.user!.id;

  const apiKeys = await prisma.userApiKey.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Return only metadata, not the actual keys
  const keysWithMasked = apiKeys.map((key) => ({
    ...key,
    hasKey: true,
    keyPreview: '••••••••••••',
  }));

  res.json({
    success: true,
    data: keysWithMasked,
  });
}

// Delete API key
export async function deleteApiKey(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { provider } = req.params;
  const userId = req.user!.id;

  await prisma.userApiKey.deleteMany({
    where: {
      userId,
      provider: provider.toUpperCase() as LlmProviderType,
    },
  });

  logger.info('API key deleted', { userId, provider });

  res.json({
    success: true,
    data: { message: 'API key deleted successfully' },
  });
}

// Verify API key is valid (test connection)
export async function verifyApiKey(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { provider } = req.params;
  const userId = req.user!.id;

  const apiKey = await prisma.userApiKey.findFirst({
    where: {
      userId,
      provider: provider.toUpperCase() as LlmProviderType,
      isActive: true,
    },
  });

  if (!apiKey) {
    throw new NotFoundError('API Key', provider);
  }

  // TODO: Actually verify the key by making a test API call
  // For now, just return success if key exists

  res.json({
    success: true,
    data: {
      provider,
      valid: true,
      message: 'API key is configured',
    },
  });
}

// Get decrypted API key (internal use only)
export async function getDecryptedApiKey(
  userId: string,
  provider: LlmProviderType
): Promise<string | null> {
  const apiKey = await prisma.userApiKey.findFirst({
    where: {
      userId,
      provider,
      isActive: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  return decryptApiKey(apiKey.apiKey);
}

// Get user's LLM settings
export async function getLlmSettings(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      defaultLlmProvider: true,
      apiKeys: {
        select: {
          provider: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  // Get configured providers
  const configuredProviders = user.apiKeys
    .filter((k) => k.isActive)
    .map((k) => k.provider);

  res.json({
    success: true,
    data: {
      defaultProvider: user.defaultLlmProvider,
      configuredProviders,
      availableProviders: ['OPENAI', 'ANTHROPIC', 'GOOGLE'],
    },
  });
}
