import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/token.util.js';
import { User, IUser } from '../modules/users/user.model.js';
import { AppError } from '../utils/app-error.js';
import { UserRole, USER_ROLES } from '@shopsense/shared';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Authentication token missing or invalid'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.userId);
    if (!user) {
      return next(AppError.unauthorized('User associated with token no longer exists'));
    }

    if (user.isBlocked) {
      return next(AppError.forbidden('User account has been suspended'));
    }

    req.user = user;
    next();
  } catch {
    return next(AppError.unauthorized('Invalid or expired authentication token'));
  }
}

export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId);
    if (user && !user.isBlocked) {
      req.user = user;
    }
  } catch {
    // Ignore invalid token for optional auth
  }

  next();
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden('Access denied: insufficient role privileges')
      );
    }

    next();
  };
}

export function requirePermissions(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // Admins implicitly have all permissions
    if (req.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasAll = requiredPermissions.every((p) => userPerms.includes(p));

    if (!hasAll) {
      return next(
        AppError.forbidden('Access denied: missing required permissions')
      );
    }

    next();
  };
}
