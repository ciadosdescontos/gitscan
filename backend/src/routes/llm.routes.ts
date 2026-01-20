import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as llmController from '../controllers/llm.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all LLM providers and their models
router.get('/providers', llmController.getProviders);

// Get models for a specific provider
router.get('/models/:provider', llmController.getProviderModels);

// Get all models
router.get('/models', llmController.getAllModels);

export default router;
