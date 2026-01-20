import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticatedRequest, UserPayload, ErrorCode } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import { prisma } from '../config/database.js';

// JWT verification middleware
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, ErrorCode.UNAUTHORIZED);
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as UserPayload;

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, githubId: true, username: true, email: true },
    });

    if (!user) {
      throw new AppError('User not found', 401, ErrorCode.UNAUTHORIZED);
    }

    // Attach user to request
    req.user = {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      email: user.email ?? undefined,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401, ErrorCode.TOKEN_EXPIRED));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401, ErrorCode.INVALID_TOKEN));
    } else {
      next(error);
    }
  }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as UserPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, githubId: true, username: true, email: true },
    });

    if (user) {
      req.user = {
        id: user.id,
        githubId: user.githubId,
        username: user.username,
        email: user.email ?? undefined,
      };
    }

    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
}

// Generate JWT token
export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

// Verify and decode token without middleware
export function verifyToken(token: string): UserPayload {
  return jwt.verify(token, config.jwt.secret) as UserPayload;
}
