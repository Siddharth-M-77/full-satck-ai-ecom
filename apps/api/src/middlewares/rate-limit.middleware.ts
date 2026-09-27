import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../config/logger.js';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
}

// In-memory fallback map for environments where Redis is temporarily not available
const memoryFallbackMap = new Map<string, { count: number; expiresAt: number }>();

export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${options.keyPrefix}:${ip}`;

    try {
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, options.windowSeconds);
        }

        if (current > options.maxRequests) {
          logger.warn({ ip, key }, 'Rate limit exceeded');
          return next(
            new AppError('Too many requests, please try again later.', 429)
          );
        }
        return next();
      }
    } catch {
      // Fall through to in-memory fallback
    }

    // In-memory fallback
    const now = Date.now();
    const entry = memoryFallbackMap.get(key);

    if (!entry || entry.expiresAt <= now) {
      memoryFallbackMap.set(key, {
        count: 1,
        expiresAt: now + options.windowSeconds * 1000,
      });
      return next();
    }

    entry.count += 1;
    if (entry.count > options.maxRequests) {
      return next(
        new AppError('Too many requests, please try again later.', 429)
      );
    }

    next();
  };
}
