import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { disconnectRedis } from './config/redis.js';
import { StockReservation } from './modules/orders/stock-reservation.model.js';
import { OrderService } from './modules/orders/order.service.js';

async function bootstrap() {
  try {
    // Attempt connections (non-fatal in dev mode if external services haven't started yet)
    try {
      await connectDB();
      await StockReservation.syncIndexes();
    } catch (err) {
      logger.warn('Initial MongoDB connection failed. Will retry on demand in development.');
    }

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 ShopSense API Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    const reservationSweep = setInterval(() => {
      OrderService.releaseExpiredReservations().catch((error) => {
        logger.error({ error }, 'Failed to release expired stock reservations');
      });
    }, 30_000);

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      clearInterval(reservationSweep);

      server.close(async () => {
        logger.info('Closed HTTP server.');
        await disconnectDB();
        await disconnectRedis();
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Fatal error during server startup');
    process.exit(1);
  }
}

bootstrap();
