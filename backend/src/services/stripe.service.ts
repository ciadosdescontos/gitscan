import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { PlanType, SubscriptionStatus } from '@prisma/client';

// Lazy initialization of Stripe
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!config.stripe.secretKey) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(config.stripe.secretKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }
  return stripeInstance;
}

// Check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!config.stripe.secretKey;
}

// Plan configuration with limits
export const PLAN_LIMITS = {
  FREE: {
    repositories: 3,
    scansPerMonth: 10,
    fixesPerMonth: 5,
    prioritySupport: false,
    customScanners: false,
    apiAccess: false,
    price: 0,
    priceId: 'price_free',
  },
  PRO: {
    repositories: 20,
    scansPerMonth: 100,
    fixesPerMonth: 50,
    prioritySupport: true,
    customScanners: true,
    apiAccess: true,
    price: 4900, // R$ 49.00 in cents
    priceId: config.stripe.prices.pro,
  },
  ENTERPRISE: {
    repositories: -1, // Unlimited
    scansPerMonth: -1,
    fixesPerMonth: -1,
    prioritySupport: true,
    customScanners: true,
    apiAccess: true,
    price: 19900, // R$ 199.00 in cents
    priceId: config.stripe.prices.enterprise,
  },
} as const;

// Create or get Stripe customer
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, username: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Return existing customer ID
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await getStripe().customers.create({
    email: user.email || undefined,
    name: user.username,
    metadata: {
      userId: userId,
    },
  });

  // Update user with Stripe customer ID
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  logger.info('Created Stripe customer', { userId, customerId: customer.id });

  return customer.id;
}

// Create checkout session for subscription
export async function createCheckoutSession(
  userId: string,
  plan: 'PRO' | 'ENTERPRISE',
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  const customerId = await getOrCreateStripeCustomer(userId);
  const priceId = PLAN_LIMITS[plan].priceId;

  if (!priceId) {
    throw new Error(`Price ID not configured for plan: ${plan}`);
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId,
      plan: plan,
    },
    subscription_data: {
      metadata: {
        userId: userId,
        plan: plan,
      },
    },
    allow_promotion_codes: true,
  });

  logger.info('Created checkout session', { userId, plan, sessionId: session.id });

  return {
    sessionId: session.id,
    url: session.url || '',
  };
}

// Create customer portal session for managing subscription
export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found for user');
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// Handle subscription created/updated
export async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.userId;
  const plan = subscription.metadata.plan as PlanType;

  if (!userId) {
    logger.error('No userId in subscription metadata', { subscriptionId: subscription.id });
    return;
  }

  let subscriptionStatus: SubscriptionStatus;

  switch (subscription.status) {
    case 'active':
      subscriptionStatus = SubscriptionStatus.ACTIVE;
      break;
    case 'past_due':
      subscriptionStatus = SubscriptionStatus.PAST_DUE;
      break;
    case 'canceled':
      subscriptionStatus = SubscriptionStatus.CANCELLED;
      break;
    case 'trialing':
      subscriptionStatus = SubscriptionStatus.TRIALING;
      break;
    default:
      subscriptionStatus = SubscriptionStatus.FREE;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionId: subscription.id,
      subscriptionStatus,
      plan: plan || PlanType.PRO,
      planExpiresAt: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info('Updated user subscription', {
    userId,
    subscriptionId: subscription.id,
    status: subscriptionStatus,
    plan,
  });
}

// Handle subscription cancelled
export async function handleSubscriptionCancelled(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.userId;

  if (!userId) {
    logger.error('No userId in subscription metadata', { subscriptionId: subscription.id });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: SubscriptionStatus.CANCELLED,
      // Keep plan until expiration
      planExpiresAt: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info('User subscription cancelled', { userId, subscriptionId: subscription.id });
}

// Handle invoice paid - record in database
export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription || typeof invoice.subscription === 'string') {
    return;
  }

  const subscription = await getStripe().subscriptions.retrieve(invoice.subscription as string);
  const userId = subscription.metadata.userId;

  if (!userId) {
    return;
  }

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'PAID',
      description: invoice.description || `Subscription - ${subscription.metadata.plan}`,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      invoicePdf: invoice.invoice_pdf || undefined,
      hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
      paidAt: new Date(),
    },
    update: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  // Reset usage counters on new billing period
  await prisma.user.update({
    where: { id: userId },
    data: {
      scansUsedThisMonth: 0,
      reposUsedThisMonth: 0,
      fixesUsedThisMonth: 0,
      usageResetAt: new Date(),
    },
  });

  logger.info('Invoice paid and usage reset', { userId, invoiceId: invoice.id });
}

// Check if user can perform action based on plan limits
export async function checkPlanLimits(
  userId: string,
  action: 'scan' | 'repository' | 'fix'
): Promise<{ allowed: boolean; reason?: string; limit?: number; used?: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      scansUsedThisMonth: true,
      reposUsedThisMonth: true,
      fixesUsedThisMonth: true,
      usageResetAt: true,
      _count: {
        select: { repositories: true },
      },
    },
  });

  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  const limits = PLAN_LIMITS[user.plan];

  // Check if usage needs reset (monthly)
  const now = new Date();
  const resetDate = new Date(user.usageResetAt);
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    // Reset usage counters
    await prisma.user.update({
      where: { id: userId },
      data: {
        scansUsedThisMonth: 0,
        reposUsedThisMonth: 0,
        fixesUsedThisMonth: 0,
        usageResetAt: now,
      },
    });
  }

  switch (action) {
    case 'scan':
      if (limits.scansPerMonth === -1) {
        return { allowed: true };
      }
      if (user.scansUsedThisMonth >= limits.scansPerMonth) {
        return {
          allowed: false,
          reason: `Monthly scan limit reached (${limits.scansPerMonth} scans)`,
          limit: limits.scansPerMonth,
          used: user.scansUsedThisMonth,
        };
      }
      return { allowed: true, limit: limits.scansPerMonth, used: user.scansUsedThisMonth };

    case 'repository':
      if (limits.repositories === -1) {
        return { allowed: true };
      }
      if (user._count.repositories >= limits.repositories) {
        return {
          allowed: false,
          reason: `Repository limit reached (${limits.repositories} repositories)`,
          limit: limits.repositories,
          used: user._count.repositories,
        };
      }
      return { allowed: true, limit: limits.repositories, used: user._count.repositories };

    case 'fix':
      if (limits.fixesPerMonth === -1) {
        return { allowed: true };
      }
      if (user.fixesUsedThisMonth >= limits.fixesPerMonth) {
        return {
          allowed: false,
          reason: `Monthly AI fix limit reached (${limits.fixesPerMonth} fixes)`,
          limit: limits.fixesPerMonth,
          used: user.fixesUsedThisMonth,
        };
      }
      return { allowed: true, limit: limits.fixesPerMonth, used: user.fixesUsedThisMonth };

    default:
      return { allowed: true };
  }
}

// Increment usage counter
export async function incrementUsage(
  userId: string,
  action: 'scan' | 'fix'
): Promise<void> {
  const updateData = action === 'scan'
    ? { scansUsedThisMonth: { increment: 1 } }
    : { fixesUsedThisMonth: { increment: 1 } };

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

// Get user's subscription and usage info
export async function getSubscriptionInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionId: true,
      planExpiresAt: true,
      scansUsedThisMonth: true,
      reposUsedThisMonth: true,
      fixesUsedThisMonth: true,
      usageResetAt: true,
      _count: {
        select: { repositories: true },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limits = PLAN_LIMITS[user.plan];

  return {
    plan: user.plan,
    status: user.subscriptionStatus,
    expiresAt: user.planExpiresAt,
    usage: {
      scans: {
        used: user.scansUsedThisMonth,
        limit: limits.scansPerMonth,
        unlimited: limits.scansPerMonth === -1,
      },
      repositories: {
        used: user._count.repositories,
        limit: limits.repositories,
        unlimited: limits.repositories === -1,
      },
      fixes: {
        used: user.fixesUsedThisMonth,
        limit: limits.fixesPerMonth,
        unlimited: limits.fixesPerMonth === -1,
      },
    },
    features: {
      prioritySupport: limits.prioritySupport,
      customScanners: limits.customScanners,
      apiAccess: limits.apiAccess,
    },
    usageResetAt: user.usageResetAt,
  };
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    config.stripe.webhookSecret
  );
}

export { getStripe };
