import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { createGitHubService } from '../services/github.service.js';
import { getUserAccessToken } from './auth.controller.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { ErrorCode } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { startScan, getScanProgress, getScanLogs, createScanProgressStream } from '../services/scanner.service.js';

// Validation schemas
const createScanSchema = z.object({
  repositoryId: z.string().uuid(),
  branch: z.string().optional(),
  scanType: z.enum(['FULL', 'QUICK', 'CUSTOM']).optional().default('FULL'),
  scanners: z.array(z.string()).optional(),
});

const listScansSchema = z.object({
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(100).optional().default(20),
  status: z.enum(['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  repositoryId: z.string().uuid().optional(),
});

// Create a new scan
export async function createScan(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const validated = createScanSchema.parse(req.body);
  const userId = req.user!.id;

  // Verify repository ownership
  const repository = await prisma.repository.findFirst({
    where: {
      id: validated.repositoryId,
      userId,
    },
  });

  if (!repository) {
    throw new NotFoundError('Repository', validated.repositoryId);
  }

  // Get branch or use default
  const branch = validated.branch || repository.defaultBranch;

  // Get commit hash from GitHub
  const accessToken = await getUserAccessToken(userId);
  const githubService = createGitHubService(accessToken);
  const [owner, repo] = repository.fullName.split('/');

  let commitHash: string | null = null;
  try {
    commitHash = await githubService.getCommitSha(owner, repo, branch);
  } catch (error) {
    logger.warn('Failed to get commit hash', { error });
  }

  // Create scan record
  const scan = await prisma.scan.create({
    data: {
      userId,
      repositoryId: validated.repositoryId,
      branch,
      commitHash,
      scanType: validated.scanType,
      status: 'PENDING',
    },
    include: {
      repository: {
        select: {
          id: true,
          name: true,
          fullName: true,
          cloneUrl: true,
        },
      },
    },
  });

  logger.info('Scan created', { scanId: scan.id, repository: repository.fullName });

  // Start scan asynchronously (don't await)
  startScan(
    scan.id,
    repository.fullName,
    branch,
    accessToken,
    repository.cloneUrl,
    validated.scanType,
    validated.scanners
  ).catch((error) => {
    logger.error('Scan failed asynchronously', { scanId: scan.id, error: error.message });
  });

  res.status(201).json({
    success: true,
    data: scan,
  });
}

// List scans
export async function listScans(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { page, limit, status, repositoryId } = listScansSchema.parse(req.query);
  const skip = (page - 1) * limit;

  const where = {
    userId: req.user!.id,
    ...(status && { status }),
    ...(repositoryId && { repositoryId }),
  };

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
          },
        },
        _count: {
          select: { vulnerabilities: true },
        },
      },
    }),
    prisma.scan.count({ where }),
  ]);

  res.json({
    success: true,
    data: scans,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// Get scan details
export async function getScan(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;

  const scan = await prisma.scan.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
    include: {
      repository: {
        select: {
          id: true,
          name: true,
          fullName: true,
          language: true,
        },
      },
      _count: {
        select: { vulnerabilities: true, reports: true },
      },
    },
  });

  if (!scan) {
    throw new NotFoundError('Scan', id);
  }

  res.json({
    success: true,
    data: scan,
  });
}

// Get scan vulnerabilities
export async function getScanVulnerabilities(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const severity = req.query.severity as string;
  const category = req.query.category as string;
  const skip = (page - 1) * limit;

  // Verify scan ownership
  const scan = await prisma.scan.findFirst({
    where: { id, userId: req.user!.id },
    select: { id: true },
  });

  if (!scan) {
    throw new NotFoundError('Scan', id);
  }

  const where = {
    scanId: id,
    ...(severity && { severity: severity as any }),
    ...(category && { category: category as any }),
  };

  const [vulnerabilities, total] = await Promise.all([
    prisma.vulnerability.findMany({
      where,
      orderBy: [
        { severity: 'asc' }, // CRITICAL first
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
      include: {
        _count: {
          select: { fixes: true },
        },
      },
    }),
    prisma.vulnerability.count({ where }),
  ]);

  res.json({
    success: true,
    data: vulnerabilities,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// Cancel a running scan
export async function cancelScan(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;

  const scan = await prisma.scan.findFirst({
    where: {
      id,
      userId: req.user!.id,
      status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
    },
  });

  if (!scan) {
    throw new NotFoundError('Scan', id);
  }

  const updatedScan = await prisma.scan.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
    },
  });

  // TODO: Send cancel signal to scanner service

  res.json({
    success: true,
    data: updatedScan,
  });
}

// Get scan progress (for polling)
export async function getScanProgressEndpoint(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { id } = req.params;

  // Verify scan ownership
  const scan = await prisma.scan.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
    select: {
      id: true,
      status: true,
      progress: true,
      totalFiles: true,
      filesScanned: true,
    },
  });

  if (!scan) {
    throw new NotFoundError('Scan', id);
  }

  const progress = getScanProgress(id);
  const logs = getScanLogs(id);

  res.json({
    success: true,
    data: {
      ...scan,
      realTimeProgress: progress,
      logs,
    },
  });
}

// SSE endpoint for real-time progress
export async function streamScanProgress(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;

  // Verify scan ownership
  const scan = await prisma.scan.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
    select: { id: true },
  });

  if (!scan) {
    res.status(404).json({ error: 'Scan not found' });
    return;
  }

  // Use the SSE stream
  const streamHandler = createScanProgressStream(id);
  streamHandler(req, res);
}

// Get scan statistics for dashboard
export async function getScanStats(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const userId = req.user!.id;

  const [totalScans, recentScans, vulnerabilityStats] = await Promise.all([
    prisma.scan.count({ where: { userId } }),
    prisma.scan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        criticalCount: true,
        highCount: true,
        mediumCount: true,
        lowCount: true,
        createdAt: true,
        repository: {
          select: { name: true },
        },
      },
    }),
    prisma.scan.aggregate({
      where: { userId, status: 'COMPLETED' },
      _sum: {
        criticalCount: true,
        highCount: true,
        mediumCount: true,
        lowCount: true,
        infoCount: true,
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalScans,
      recentScans,
      vulnerabilitySummary: {
        critical: vulnerabilityStats._sum.criticalCount || 0,
        high: vulnerabilityStats._sum.highCount || 0,
        medium: vulnerabilityStats._sum.mediumCount || 0,
        low: vulnerabilityStats._sum.lowCount || 0,
        info: vulnerabilityStats._sum.infoCount || 0,
      },
    },
  });
}
