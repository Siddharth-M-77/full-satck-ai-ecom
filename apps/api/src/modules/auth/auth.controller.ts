import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'shopsense_refresh_token';

function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: expiresAt,
    path: '/api/v1/auth',
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/v1/auth',
  });
}

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const device = req.headers['user-agent'];
      const result = await AuthService.register(req.body, device);

      setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const device = req.headers['user-agent'];
      const result = await AuthService.login(req.body, device);

      setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token =
        req.cookies[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      const device = req.headers['user-agent'];

      const result = await AuthService.refresh(token, device);

      setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

      res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      await AuthService.logout(token, req.user?._id?.toString());

      clearRefreshTokenCookie(res);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await AuthService.forgotPassword(req.body.email);

      res.status(200).json({
        success: true,
        message:
          'If an account with that email exists, a password reset link has been dispatched.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await AuthService.resetPassword(req.body.token, req.body.newPassword);

      res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. Please log in.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            permissions: req.user.permissions,
            isEmailVerified: req.user.isEmailVerified,
            createdAt: req.user.createdAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
