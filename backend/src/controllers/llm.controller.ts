import { Response } from 'express';
import axios from 'axios';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

const SCANNER_URL = process.env.SCANNER_SERVICE_URL || 'http://scanner:5000';

// LLM Models configuration (mirrors scanner-service)
const LLM_PROVIDERS = {
  OPENAI: {
    name: 'OPENAI',
    display_name: 'OpenAI',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable model, best for complex security analysis',
        context_window: 128000,
        max_output: 16384,
        is_default: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and efficient, good for simpler fixes',
        context_window: 128000,
        max_output: 16384,
        is_default: false,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Previous generation, still very capable',
        context_window: 128000,
        max_output: 4096,
        is_default: false,
      },
      {
        id: 'o1',
        name: 'o1',
        description: 'Advanced reasoning model for complex problems',
        context_window: 200000,
        max_output: 100000,
        is_default: false,
      },
      {
        id: 'o1-mini',
        name: 'o1 Mini',
        description: 'Faster reasoning model, cost-effective',
        context_window: 128000,
        max_output: 65536,
        is_default: false,
      },
      {
        id: 'o3-mini',
        name: 'o3 Mini',
        description: 'Latest reasoning model, highly efficient',
        context_window: 200000,
        max_output: 100000,
        is_default: false,
      },
    ],
  },
  ANTHROPIC: {
    name: 'ANTHROPIC',
    display_name: 'Anthropic',
    models: [
      {
        id: 'claude-sonnet-4-5-20250514',
        name: 'Claude 4.5 Sonnet',
        description: 'Latest and most capable Claude model',
        context_window: 200000,
        max_output: 64000,
        is_default: true,
      },
      {
        id: 'claude-opus-4-5-20250514',
        name: 'Claude 4.5 Opus',
        description: 'Most powerful Claude model for complex tasks',
        context_window: 200000,
        max_output: 32000,
        is_default: false,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Excellent balance of speed and capability',
        context_window: 200000,
        max_output: 8192,
        is_default: false,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fast and efficient for quick fixes',
        context_window: 200000,
        max_output: 8192,
        is_default: false,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Previous generation, still very capable',
        context_window: 200000,
        max_output: 4096,
        is_default: false,
      },
    ],
  },
  GOOGLE: {
    name: 'GOOGLE',
    display_name: 'Google Gemini',
    models: [
      // Gemini 3 Series (Latest)
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        description: 'Most intelligent model with advanced reasoning and agentic capabilities',
        context_window: 1048576,
        max_output: 65536,
        is_default: false,
      },
      {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        description: 'Pro-level intelligence at Flash speed and pricing',
        context_window: 1048576,
        max_output: 65536,
        is_default: true,
      },
      // Gemini 2.5 Series (Production-Ready)
      {
        id: 'gemini-2.5-pro-preview-05-06',
        name: 'Gemini 2.5 Pro',
        description: 'Production-ready with enhanced reasoning',
        context_window: 1048576,
        max_output: 65536,
        is_default: false,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Stable model for production apps',
        context_window: 1048576,
        max_output: 65536,
        is_default: false,
      },
      // Gemini 2.0 Series
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Fast multimodal model (retiring March 2026)',
        context_window: 1048576,
        max_output: 8192,
        is_default: false,
      },
      {
        id: 'gemini-2.0-flash-lite',
        name: 'Gemini 2.0 Flash Lite',
        description: 'Lightweight version for simple tasks',
        context_window: 1048576,
        max_output: 8192,
        is_default: false,
      },
    ],
  },
};

// Get all providers with their models
export async function getProviders(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    // Try to get from scanner service first
    try {
      const response = await axios.get(`${SCANNER_URL}/api/llm/providers`, {
        timeout: 5000,
      });

      if (response.data.success) {
        res.json({
          success: true,
          data: response.data.data,
        });
        return;
      }
    } catch (error) {
      logger.warn('Could not fetch providers from scanner service, using fallback');
    }

    // Fallback to local configuration
    res.json({
      success: true,
      data: LLM_PROVIDERS,
    });
  } catch (error: any) {
    logger.error('Error fetching providers', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch providers',
      },
    });
  }
}

// Get models for a specific provider
export async function getProviderModels(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { provider } = req.params;
  const providerUpper = provider.toUpperCase();

  try {
    // Try to get from scanner service first
    try {
      const response = await axios.get(`${SCANNER_URL}/api/llm/models/${provider}`, {
        timeout: 5000,
      });

      if (response.data.success) {
        res.json({
          success: true,
          data: response.data.data,
        });
        return;
      }
    } catch (error) {
      logger.warn('Could not fetch models from scanner service, using fallback');
    }

    // Fallback to local configuration
    const providerConfig = LLM_PROVIDERS[providerUpper as keyof typeof LLM_PROVIDERS];

    if (!providerConfig) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Unknown provider: ${provider}`,
        },
      });
      return;
    }

    const defaultModel = providerConfig.models.find((m) => m.is_default)?.id || providerConfig.models[0]?.id;

    res.json({
      success: true,
      data: {
        provider: providerUpper,
        default_model: defaultModel,
        models: providerConfig.models,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching provider models', { provider, error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch provider models',
      },
    });
  }
}

// Get all models
export async function getAllModels(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    // Try to get from scanner service first
    try {
      const response = await axios.get(`${SCANNER_URL}/api/llm/models`, {
        timeout: 5000,
      });

      if (response.data.success) {
        res.json({
          success: true,
          data: response.data.data,
        });
        return;
      }
    } catch (error) {
      logger.warn('Could not fetch models from scanner service, using fallback');
    }

    // Fallback to local configuration
    res.json({
      success: true,
      data: {
        providers: LLM_PROVIDERS,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching all models', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch models',
      },
    });
  }
}
