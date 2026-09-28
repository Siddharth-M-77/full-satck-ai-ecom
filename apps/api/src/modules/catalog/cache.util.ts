import { getRedisClient } from '../../config/redis.js';
import { logger } from '../../config/logger.js';

const CATALOG_CACHE_TTL = 300; // 5 minutes

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    }
  } catch (err) {
    logger.warn({ err, key }, 'Redis cache get failed, bypassing');
  }
  return null;
}

export async function setCached(key: string, data: unknown, ttl = CATALOG_CACHE_TTL): Promise<void> {
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
    }
  } catch (err) {
    logger.warn({ err, key }, 'Redis cache set failed, bypassing');
  }
}

export async function invalidateCatalogCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      const keys = await redis.keys('catalog:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info({ count: keys.length }, 'Invalidated catalog cache');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Redis cache invalidation failed');
  }
}
