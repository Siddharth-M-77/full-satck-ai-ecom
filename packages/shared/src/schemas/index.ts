import { z } from 'zod';
import { USER_ROLES, ORDER_STATUS, PAYMENT_METHODS, PRODUCT_STATUS } from '../constants/index.js';

export const UserRoleSchema = z.enum([USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.ADMIN]);
export const OrderStatusSchema = z.enum([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.PAID,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUND_REQUESTED,
  ORDER_STATUS.REFUNDED,
]);
export const PaymentMethodSchema = z.enum([PAYMENT_METHODS.RAZORPAY, PAYMENT_METHODS.COD]);
export const ProductStatusSchema = z.enum([PRODUCT_STATUS.DRAFT, PRODUCT_STATUS.PUBLISHED, PRODUCT_STATUS.ARCHIVED]);

export const RegisterInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const AddressInputSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  addressLine1: z.string().min(5, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(4, 'Postal code is required'),
  country: z.string().default('IN'),
  isDefault: z.boolean().default(false),
  type: z.enum(['shipping', 'billing', 'both']).default('shipping'),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const UpdateProfileInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().min(10, 'Valid phone number is required').optional(),
});

