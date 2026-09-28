import Razorpay from 'razorpay';
import { env } from './env.js';

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      key_secret: env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
    });
  }
  return razorpayInstance;
}
