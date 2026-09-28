import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { getRedisClient } from './config/redis.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { authenticate, requireRoles } from './middlewares/auth.middleware.js';
import { AppError } from './utils/app-error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { USER_ROLES } from '@shopsense/shared';

export function createApp(): Express {
  const app: Express = express();

  // Basic security and parsing
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(','),
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Tracing & Logging
  app.use(requestIdMiddleware);
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        customProps: (req: Request) => ({
          requestId: req.headers['x-request-id'],
        }),
      })
    );
  }

  // Liveness check (checks that HTTP server is up and responsive)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'ShopSense API',
    });
  });

  // Readiness check (checks MongoDB and Redis dependencies)
  app.get('/ready', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const isMongoReady = mongoose.connection.readyState === 1;
      let isRedisReady = false;

      try {
        const redis = getRedisClient();
        const pingResult = await redis.ping();
        isRedisReady = pingResult === 'PONG';
      } catch {
        isRedisReady = false;
      }

      const isHealthy = isMongoReady && isRedisReady;

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'READY' : 'DEGRADED',
        checks: {
          database: isMongoReady ? 'CONNECTED' : 'DISCONNECTED',
          redis: isRedisReady ? 'CONNECTED' : 'DISCONNECTED',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Root welcome route
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'ShopSense AI API',
      version: '1.0.0',
      status: 'active',
      documentation: '/api/docs',
    });
  });

  // API v1 Routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/catalog', catalogRouter);
  app.use('/api/v1/cart', cartRouter);
  app.use('/api/v1', orderRouter);
  app.use('/api/v1/admin', adminRouter);

  // RBAC Demonstration & Verification endpoint
  app.get(
    '/api/v1/admin/rbac-check',
    authenticate,
    requireRoles(USER_ROLES.ADMIN),
    (_req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'RBAC verification passed. User has administrator privileges.',
      });
    }
  );

  // 404 handler
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(AppError.notFound('Endpoint not found'));
  });

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}
