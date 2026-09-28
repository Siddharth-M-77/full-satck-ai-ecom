import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '../lib/api';

export interface CartItem {
  _id: string;
  productId: string;
  title: string;
  slug: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  subtotal: number;
  image: string;
  stock: number;
}

export interface CartPricing {
  itemsTotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
}

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

type CartPayload = { items: CartItem[]; pricing: CartPricing; appliedCoupon?: AppliedCoupon | null; couponError?: string };

interface CartState {
  items: CartItem[];
  pricing: CartPricing;
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
  sessionId: string;
  loading: boolean;
  itemCount: number;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, sku: string, quantity?: number) => Promise<void>;
  updateQuantity: (sku: string, quantity: number) => Promise<void>;
  removeItem: (sku: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  mergeGuestCart: () => Promise<void>;
}

const emptyPricing: CartPricing = { itemsTotal: 0, discountTotal: 0, shippingFee: 0, taxTotal: 0, grandTotal: 0 };

function getOrGenerateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('shopsense_session_id');
  if (!sid) {
    sid = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('shopsense_session_id', sid);
  }
  return sid;
}

const fromPayload = (data: CartPayload) => ({
  items: data.items,
  pricing: data.pricing,
  appliedCoupon: data.appliedCoupon ?? null,
  couponError: data.couponError ?? null,
  itemCount: data.items.reduce((sum, item) => sum + item.quantity, 0),
});

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      /** Sends a cart request with the guest session header and stores the returned cart. */
      const send = async (endpoint: string, init: RequestInit = {}, { rethrow = true } = {}) => {
        const sid = get().sessionId || getOrGenerateSessionId();
        set({ sessionId: sid, loading: true });
        try {
          const res = await apiFetch<{ data: CartPayload }>(endpoint, {
            ...init,
            headers: { 'x-session-id': sid, ...(init.headers as Record<string, string>) },
          });
          set({ ...fromPayload(res.data), loading: false });
        } catch (err) {
          set({ loading: false });
          if (rethrow) throw err;
        }
      };

      return {
        items: [],
        pricing: emptyPricing,
        appliedCoupon: null,
        couponError: null,
        sessionId: '',
        loading: false,
        itemCount: 0,

        fetchCart: () => send('/cart', {}, { rethrow: false }),
        addItem: (productId, sku, quantity = 1) =>
          send('/cart/items', { method: 'POST', body: JSON.stringify({ productId, sku, quantity }) }),
        updateQuantity: (sku, quantity) =>
          send(`/cart/items/${encodeURIComponent(sku)}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
        removeItem: (sku) => send(`/cart/items/${encodeURIComponent(sku)}`, { method: 'DELETE' }),
        applyCoupon: (code) => send('/cart/coupon', { method: 'POST', body: JSON.stringify({ code }) }),
        removeCoupon: () => send('/cart/coupon', { method: 'DELETE' }),

        mergeGuestCart: async () => {
          const sid = get().sessionId;
          if (!sid) return;
          try {
            const res = await apiFetch<{ data: CartPayload }>('/cart/merge', {
              method: 'POST',
              body: JSON.stringify({ guestSessionId: sid }),
            });
            set(fromPayload(res.data));
          } catch {
            // A failed merge leaves the guest cart intact; the next fetch recovers.
          }
        },
      };
    },
    {
      name: 'shopsense_cart_client',
      partialize: (state) => ({ sessionId: state.sessionId }),
    }
  )
);
