import { Router, Request, Response } from 'express';
import express from 'express';
import { logger } from '../utils/logger.js';
import * as stripeService from '../services/stripe.service.js';
import Stripe from 'stripe';

const router = Router();

// Stripe webhook endpoint - needs raw body
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      logger.warn('Webhook received without signature');
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripeService.verifyWebhookSignature(req.body, signature);
    } catch (error: any) {
      logger.error('Webhook signature verification failed', { error: error.message });
      res.status(400).json({ error: `Webhook Error: ${error.message}` });
      return;
    }

    logger.info('Stripe webhook received', { type: event.type, id: event.id });

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await stripeService.handleSubscriptionUpdate(
            event.data.object as Stripe.Subscription
          );
          break;

        case 'customer.subscription.deleted':
          await stripeService.handleSubscriptionCancelled(
            event.data.object as Stripe.Subscription
          );
          break;

        case 'invoice.paid':
          await stripeService.handleInvoicePaid(
            event.data.object as Stripe.Invoice
          );
          break;

        case 'invoice.payment_failed':
          logger.warn('Invoice payment failed', {
            invoiceId: (event.data.object as Stripe.Invoice).id,
          });
          break;

        case 'checkout.session.completed':
          logger.info('Checkout session completed', {
            sessionId: (event.data.object as Stripe.Checkout.Session).id,
          });
          break;

        default:
          logger.debug('Unhandled webhook event type', { type: event.type });
      }

      res.json({ received: true });
    } catch (error: any) {
      logger.error('Error processing webhook', { error: error.message, type: event.type });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

export default router;
