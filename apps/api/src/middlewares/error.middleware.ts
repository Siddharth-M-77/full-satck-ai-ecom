import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof AppError) {
    logger.warn({
      requestId,
      statusCode: err.statusCode,
      message: err.message,
      details: err.details,
    });

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: `ERR_${err.statusCode}`,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof ZodError || err.name === 'ZodError') {
    const zodErr = err as ZodError;
    logger.warn({
      requestId,
      statusCode: 400,
      validationErrors: zodErr.errors,
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: zodErr.errors?.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })) || [],
      },
    });
    return;
  }

  logger.error({
    requestId,
    err,
    stack: err.stack,
  }, 'Unhandled server error');

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      ...(env.NODE_ENV === 'development' ? { details: err.message } : {}),
    },
  });
}
