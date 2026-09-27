import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User, IUser } from '../users/user.model.js';
import { generateAccessToken, generateRefreshToken, hashToken } from './token.util.js';
import { AppError } from '../../utils/app-error.js';
import { RegisterInput, LoginInput } from '@shopsense/shared';
import { logger } from '../../config/logger.js';

export class AuthService {
  static async register(input: RegisterInput, device?: string) {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw AppError.conflict('An account with this email address already exists');
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const { token: refreshToken, hash: tokenHash, expiresAt } = generateRefreshToken();

    const user = new User({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      refreshTokens: [{ tokenHash, device, expiresAt }],
    });

    await user.save();

    const accessToken = generateAccessToken(user);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  static async login(input: LoginInput, device?: string) {
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (user.isBlocked) {
      throw AppError.forbidden('Your account has been suspended. Please contact support.');
    }

    const isMatch = await user.comparePassword(input.password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const { token: refreshToken, hash: tokenHash, expiresAt } = generateRefreshToken();

    // Refresh token rotation & cleanup: keep at most 5 active sessions
    user.refreshTokens = user.refreshTokens
      .filter((t) => t.expiresAt > new Date())
      .slice(-4);

    user.refreshTokens.push({ tokenHash, device, expiresAt, createdAt: new Date() });
    await user.save();

    const accessToken = generateAccessToken(user);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  static async refresh(refreshToken: string, device?: string) {
    if (!refreshToken) {
      throw AppError.unauthorized('Refresh token is required');
    }

    const tokenHash = hashToken(refreshToken);

    const user = await User.findOne({
      'refreshTokens.tokenHash': tokenHash,
      'refreshTokens.expiresAt': { $gt: new Date() },
    });

    if (!user) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    if (user.isBlocked) {
      throw AppError.forbidden('Account is suspended');
    }

    // Token rotation: invalidate used token, issue fresh pair
    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);

    const { token: newRefreshToken, hash: newTokenHash, expiresAt } = generateRefreshToken();
    user.refreshTokens.push({ tokenHash: newTokenHash, device, expiresAt, createdAt: new Date() });
    await user.save();

    const accessToken = generateAccessToken(user);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  static async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await User.updateOne(
        { 'refreshTokens.tokenHash': tokenHash },
        { $pull: { refreshTokens: { tokenHash } } }
      );
    } else if (userId) {
      await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
    }
  }

  static async forgotPassword(email: string): Promise<{ resetToken?: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return gracefully to prevent email enumeration
      return {};
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = hashToken(rawToken);
    const resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpiresAt = resetPasswordExpiresAt;
    await user.save();

    logger.info({ email, resetToken: rawToken }, 'Password reset requested');

    return { resetToken: rawToken };
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw AppError.badRequest('Invalid or expired password reset token');
    }

    const saltRounds = 12;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    // Revoke all existing sessions for security
    user.refreshTokens = [];

    await user.save();
  }
}
