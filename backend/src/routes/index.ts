import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes.js';
import repositoryRoutes from './repository.routes.js';
import scanRoutes from './scan.routes.js';
import vulnerabilityRoutes from './vulnerability.routes.js';
import apikeyRoutes from './apikey.routes.js';
import { checkDatabaseHealth } from '../config/database.js';

const router = Router();

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
    },
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/repositories', repositoryRoutes);
router.use('/scans', scanRoutes);
router.use('/vulnerabilities', vulnerabilityRoutes);
router.use('/api-keys', apikeyRoutes);

export default router;
