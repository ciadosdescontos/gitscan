import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// GitHub OAuth routes
router.get('/github', authController.initiateGitHubAuth);
router.get('/github/callback', asyncHandler(authController.handleGitHubCallback));

// Personal Access Token login
router.post('/token', asyncHandler(authController.loginWithToken));

// Protected routes
router.get('/me', authenticate, asyncHandler(authController.getCurrentUser));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.patch(
  '/preferences',
  authenticate,
  asyncHandler(authController.updateUserPreferences)
);

export default router;
