import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import * as apikeyController from '../controllers/apikey.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// API Key routes
router.get('/', asyncHandler(apikeyController.listApiKeys));
router.post('/', asyncHandler(apikeyController.saveApiKey));
router.delete('/:provider', asyncHandler(apikeyController.deleteApiKey));
router.get('/:provider/verify', asyncHandler(apikeyController.verifyApiKey));
router.get('/settings', asyncHandler(apikeyController.getLlmSettings));

export default router;
