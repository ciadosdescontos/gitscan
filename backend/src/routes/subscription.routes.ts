import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get subscription info and usage
router.get('/info', subscriptionController.getSubscriptionInfo);

// Get available plans
router.get('/plans', subscriptionController.getPlans);

// Get Stripe publishable key
router.get('/stripe-key', subscriptionController.getPublishableKey);

// Create checkout session for subscription
router.post('/checkout', subscriptionController.createCheckoutSession);

// Create portal session for managing subscription
router.post('/portal', subscriptionController.createPortalSession);

// Check limits for an action
router.get('/limits/:action', subscriptionController.checkLimits);

export default router;
