import { z } from 'zod';
import {
  RegisterInputSchema,
  LoginInputSchema,
  AddressInputSchema,
} from '../schemas/index.js';

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type AddressInput = z.infer<typeof AddressInputSchema>;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
  };
}

export interface UserJwtPayload {
  userId: string;
  role: string;
  email: string;
}
