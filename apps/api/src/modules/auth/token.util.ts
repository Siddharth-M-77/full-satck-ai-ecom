import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { IUser } from '../users/user.model.js';
import { UserJwtPayload } from '@shopsense/shared';

export function generateAccessToken(user: IUser): string {
  const payload: UserJwtPayload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRATION as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): UserJwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as UserJwtPayload;
}

export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(40).toString('hex');
  const hash = hashToken(token);

  // 7 days expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return { token, hash, expiresAt };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
