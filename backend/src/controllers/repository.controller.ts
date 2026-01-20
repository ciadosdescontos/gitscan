import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { createGitHubService } from '../services/github.service.js';
import { getUserAccessToken } from './auth.controller.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { ErrorCode } from '../types/index.js';

// Validation schemas
const addRepositorySchema = z.object({
  githubRepoId: z.string(),
  autoScanEnabled: z.boolean().optional().default(false),
  scanOnPush: z.boolean().optional().default(false),
});

const updateRepositorySchema = z.object({
  autoScanEnabled: z.boolean().optional(),
  scanOnPush: z.boolean().optional(),
});

// List user's GitHub repositories (from GitHub API)
export async function listGitHubRepositories(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = Math.min(parseInt(req.query.per_page as string) || 30, 100);

  const accessToken = await getUserAccessToken(req.user!.id);
  const githubService = createGitHubService(accessToken);

  const repositories = await githubService.getRepositories(page, perPage);

  res.json({
    success: true,
    data: repositories,
    meta: {
      page,
      limit: perPage,
    },
  });
}

// Add a repository to GitScan
export async function addRepository(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const validated = addRepositorySchema.parse(req.body);
  const userId = req.user!.id;

  // Get repository details from GitHub
  const accessToken = await getUserAccessToken(userId);
  const githubService = createGitHubService(accessToken);

  // First, get user's repos to find the one with matching ID
  const repos = await githubService.getRepositories(1, 100);
  const githubRepo = repos.find(
    (r) => String(r.id) === validated.githubRepoId
  );

  if (!githubRepo) {
    throw new NotFoundError('Repository');
  }

  // Create or update repository in database
  const repository = await prisma.repository.upsert({
    where: {
      userId_githubRepoId: {
        userId,
        githubRepoId: validated.githubRepoId,
      },
    },
    update: {
      name: githubRepo.name,
      fullName: githubRepo.full_name,
      description: githubRepo.description,
      defaultBranch: githubRepo.default_branch,
      language: githubRepo.language,
      isPrivate: githubRepo.private,
      htmlUrl: githubRepo.html_url,
      cloneUrl: githubRepo.clone_url,
      autoScanEnabled: validated.autoScanEnabled,
      scanOnPush: validated.scanOnPush,
    },
    create: {
      userId,
      githubRepoId: validated.githubRepoId,
      name: githubRepo.name,
      fullName: githubRepo.full_name,
      description: githubRepo.description,
      defaultBranch: githubRepo.default_branch,
      language: githubRepo.language,
      isPrivate: githubRepo.private,
      htmlUrl: githubRepo.html_url,
      cloneUrl: githubRepo.clone_url,
      autoScanEnabled: validated.autoScanEnabled,
      scanOnPush: validated.scanOnPush,
    },
  });

  res.status(201).json({
    success: true,
    data: repository,
  });
}

// List repositories added to GitScan
export async function listRepositories(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const [repositories, total] = await Promise.all([
    prisma.repository.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: {
          select: { scans: true },
        },
      },
    }),
    prisma.repository.count({
      where: { userId: req.user!.id },
    }),
  ]);

  res.json({
    success: true,
    data: repositories,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// Get repository details
export async function getRepository(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;

  const repository = await prisma.repository.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
    include: {
      scans: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          scanType: true,
          branch: true,
          criticalCount: true,
          highCount: true,
          mediumCount: true,
          lowCount: true,
          createdAt: true,
          completedAt: true,
        },
      },
      _count: {
        select: { scans: true },
      },
    },
  });

  if (!repository) {
    throw new NotFoundError('Repository', id);
  }

  res.json({
    success: true,
    data: repository,
  });
}

// Update repository settings
export async function updateRepository(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;
  const validated = updateRepositorySchema.parse(req.body);

  // Verify ownership
  const existing = await prisma.repository.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!existing) {
    throw new NotFoundError('Repository', id);
  }

  const repository = await prisma.repository.update({
    where: { id },
    data: validated,
  });

  res.json({
    success: true,
    data: repository,
  });
}

// Remove repository from GitScan
export async function removeRepository(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;

  // Verify ownership
  const existing = await prisma.repository.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!existing) {
    throw new NotFoundError('Repository', id);
  }

  await prisma.repository.delete({
    where: { id },
  });

  res.json({
    success: true,
    data: { message: 'Repository removed successfully' },
  });
}

// Get repository branches
export async function getRepositoryBranches(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;

  const repository = await prisma.repository.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!repository) {
    throw new NotFoundError('Repository', id);
  }

  const [owner, repo] = repository.fullName.split('/');
  const accessToken = await getUserAccessToken(req.user!.id);
  const githubService = createGitHubService(accessToken);

  const branches = await githubService.getBranches(owner, repo);

  res.json({
    success: true,
    data: branches,
  });
}
