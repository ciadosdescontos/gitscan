import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { ApiResponse, ErrorCode } from '../types/index.js';

// Error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known error types
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: config.isDevelopment ? err.details : undefined,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 500;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'Database error';

    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        code = ErrorCode.ALREADY_EXISTS;
        message = 'Resource already exists';
        break;
      case 'P2025':
        statusCode = 404;
        code = ErrorCode.NOT_FOUND;
        message = 'Resource not found';
        break;
      case 'P2003':
        statusCode = 400;
        code = ErrorCode.VALIDATION_ERROR;
        message = 'Invalid reference';
        break;
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        details: config.isDevelopment ? { prismaCode: err.code } : undefined,
      },
    });
    return;
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid data provided',
        details: config.isDevelopment ? err.message : undefined,
      },
    });
    return;
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: config.isDevelopment ? err.message : 'Internal server error',
    },
  });
}

// 404 handler
export function notFoundHandler(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  res.status(404).json({
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

// Async handler wrapper to catch errors
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
