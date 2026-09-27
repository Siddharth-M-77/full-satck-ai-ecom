import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI);
    logger.info(' Connected to MongoDB');
  } catch (error) {
    logger.error({ error }, '❌ MongoDB connection error');
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info(' Disconnected from MongoDB');
  } catch (error) {
    logger.error({ error }, '❌ Error disconnecting from MongoDB');
  }
}
