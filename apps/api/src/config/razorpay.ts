import Razorpay from 'razorpay';
import { env } from './env.js';
import { AppError } from '../utils/app-error.js';

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!razorpayInstance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw AppError.serviceUnavailable('Razorpay credentials are not configured');
    }

    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}
