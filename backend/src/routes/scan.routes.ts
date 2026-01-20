import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import * as scanController from '../controllers/scan.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Scan routes
router.post('/', asyncHandler(scanController.createScan));
router.get('/', asyncHandler(scanController.listScans));
router.get('/stats', asyncHandler(scanController.getScanStats));
router.get('/:id', asyncHandler(scanController.getScan));
router.get('/:id/progress', asyncHandler(scanController.getScanProgressEndpoint));
router.get('/:id/stream', scanController.streamScanProgress as any);
router.get('/:id/vulnerabilities', asyncHandler(scanController.getScanVulnerabilities));
router.post('/:id/cancel', asyncHandler(scanController.cancelScan));

export default router;
