import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import * as stripeService from '../services/stripe.service.js';
import { config } from '../config/index.js';

// Get subscription info and usage
export async function getSubscriptionInfo(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    const userId = req.user!.id;
    const info = await stripeService.getSubscriptionInfo(userId);

    res.json({
      success: true,
      data: info,
    });
  } catch (error: any) {
    logger.error('Error getting subscription info', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get subscription info',
      },
    });
  }
}

// Get available plans
export async function getPlans(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    const plans = [
      {
        id: 'FREE',
        name: 'Gratuito',
        description: 'Perfeito para projetos pessoais',
        price: 0,
        currency: 'BRL',
        interval: 'month',
        features: [
          '3 repositorios',
          '10 scans por mes',
          '5 correcoes IA por mes',
          'Scanners basicos',
          'Suporte por email',
        ],
        limits: stripeService.PLAN_LIMITS.FREE,
        popular: false,
      },
      {
        id: 'PRO',
        name: 'Pro',
        description: 'Para desenvolvedores e pequenas equipes',
        price: 49.00,
        currency: 'BRL',
        interval: 'month',
        features: [
          '20 repositorios',
          '100 scans por mes',
          '50 correcoes IA por mes',
          'Todos os scanners',
          'Scanners customizados',
          'Suporte prioritario',
          'Acesso a API',
        ],
        limits: stripeService.PLAN_LIMITS.PRO,
        popular: true,
      },
      {
        id: 'ENTERPRISE',
        name: 'Enterprise',
        description: 'Para empresas e grandes equipes',
        price: 199.00,
        currency: 'BRL',
        interval: 'month',
        features: [
          'Repositorios ilimitados',
          'Scans ilimitados',
          'Correcoes IA ilimitadas',
          'Todos os scanners',
          'Scanners customizados',
          'Suporte 24/7 dedicado',
          'Acesso completo a API',
          'SLA garantido',
          'Onboarding personalizado',
        ],
        limits: stripeService.PLAN_LIMITS.ENTERPRISE,
        popular: false,
      },
    ];

    res.json({
      success: true,
      data: { plans },
    });
  } catch (error: any) {
    logger.error('Error getting plans', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get plans',
      },
    });
  }
}

// Create checkout session
export async function createCheckoutSession(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { plan } = req.body;

    if (!plan || !['PRO', 'ENTERPRISE'].includes(plan)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAN',
          message: 'Invalid plan selected',
        },
      });
      return;
    }

    const successUrl = `${config.frontendUrl}/settings?subscription=success`;
    const cancelUrl = `${config.frontendUrl}/pricing?subscription=cancelled`;

    const session = await stripeService.createCheckoutSession(
      userId,
      plan as 'PRO' | 'ENTERPRISE',
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    logger.error('Error creating checkout session', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'CHECKOUT_ERROR',
        message: error.message || 'Failed to create checkout session',
      },
    });
  }
}

// Create portal session for managing subscription
export async function createPortalSession(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    const userId = req.user!.id;
    const returnUrl = `${config.frontendUrl}/settings`;

    const session = await stripeService.createPortalSession(userId, returnUrl);

    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    logger.error('Error creating portal session', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'PORTAL_ERROR',
        message: error.message || 'Failed to create portal session',
      },
    });
  }
}

// Check plan limits for an action
export async function checkLimits(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { action } = req.params;

    if (!['scan', 'repository', 'fix'].includes(action)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'Invalid action type',
        },
      });
      return;
    }

    const result = await stripeService.checkPlanLimits(
      userId,
      action as 'scan' | 'repository' | 'fix'
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error checking limits', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check limits',
      },
    });
  }
}

// Get Stripe publishable key for frontend
export async function getPublishableKey(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  res.json({
    success: true,
    data: {
      publishableKey: config.stripe.publishableKey,
    },
  });
}
