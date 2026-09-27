import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { rateLimit } from '../../middlewares/rate-limit.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  RegisterInputSchema,
  LoginInputSchema,
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
} from '@shopsense/shared';

const router = Router();

router.post(
  '/register',
  validate({ body: RegisterInputSchema }),
  AuthController.register
);

router.post(
  '/login',
  rateLimit({ windowSeconds: 60, maxRequests: 10, keyPrefix: 'login' }),
  validate({ body: LoginInputSchema }),
  AuthController.login
);

router.post('/refresh', AuthController.refresh);

router.post('/logout', AuthController.logout);

router.post(
  '/forgot-password',
  rateLimit({ windowSeconds: 300, maxRequests: 5, keyPrefix: 'forgot-password' }),
  validate({ body: ForgotPasswordInputSchema }),
  AuthController.forgotPassword
);

router.post(
  '/reset-password',
  rateLimit({ windowSeconds: 300, maxRequests: 5, keyPrefix: 'reset-password' }),
  validate({ body: ResetPasswordInputSchema }),
  AuthController.resetPassword
);

router.get('/me', authenticate, AuthController.getMe);

export const authRouter = router;
