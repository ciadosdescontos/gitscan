import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import * as repositoryController from '../controllers/repository.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GitHub repositories (from GitHub API)
router.get('/github', asyncHandler(repositoryController.listGitHubRepositories));

// GitScan repositories
router.get('/', asyncHandler(repositoryController.listRepositories));
router.post('/', asyncHandler(repositoryController.addRepository));
router.get('/:id', asyncHandler(repositoryController.getRepository));
router.patch('/:id', asyncHandler(repositoryController.updateRepository));
router.delete('/:id', asyncHandler(repositoryController.removeRepository));
router.get('/:id/branches', asyncHandler(repositoryController.getRepositoryBranches));

export default router;
