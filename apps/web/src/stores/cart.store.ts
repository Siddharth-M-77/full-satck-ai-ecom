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

interface CartState {
  items: CartItem[];
  pricing: CartPricing;
  sessionId: string;
  loading: boolean;
  itemCount: number;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, sku: string, quantity?: number) => Promise<void>;
  updateQuantity: (sku: string, quantity: number) => Promise<void>;
  removeItem: (sku: string) => Promise<void>;
  mergeGuestCart: () => Promise<void>;
}

function getOrGenerateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('shopsense_session_id');
  if (!sid) {
    sid = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('shopsense_session_id', sid);
  }
  return sid;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      pricing: {
        itemsTotal: 0,
        discountTotal: 0,
        shippingFee: 0,
        taxTotal: 0,
        grandTotal: 0,
      },
      sessionId: '',
      loading: false,
      itemCount: 0,

      fetchCart: async () => {
        const sid = get().sessionId || getOrGenerateSessionId();
        set({ sessionId: sid, loading: true });

        try {
          const res = await apiFetch<{
            success: boolean;
            data: {
              items: CartItem[];
              pricing: CartPricing;
            };
          }>('/cart', {
            headers: {
              'x-session-id': sid,
            },
          });

          const totalCount = res.data.items.reduce((acc, i) => acc + i.quantity, 0);

          set({
            items: res.data.items,
            pricing: res.data.pricing,
            itemCount: totalCount,
            loading: false,
          });
        } catch {
          set({ loading: false });
        }
      },

      addItem: async (productId: string, sku: string, quantity = 1) => {
        const sid = get().sessionId || getOrGenerateSessionId();
        set({ sessionId: sid, loading: true });

        try {
          const res = await apiFetch<{
            success: boolean;
            data: {
              items: CartItem[];
              pricing: CartPricing;
            };
          }>('/cart/items', {
            method: 'POST',
            headers: { 'x-session-id': sid },
            body: JSON.stringify({ productId, sku, quantity }),
          });

          const totalCount = res.data.items.reduce((acc, i) => acc + i.quantity, 0);

          set({
            items: res.data.items,
            pricing: res.data.pricing,
            itemCount: totalCount,
            loading: false,
          });
        } catch (err: unknown) {
          set({ loading: false });
          throw err;
        }
      },

      updateQuantity: async (sku: string, quantity: number) => {
        const sid = get().sessionId || getOrGenerateSessionId();
        set({ loading: true });

        try {
          const res = await apiFetch<{
            success: boolean;
            data: {
              items: CartItem[];
              pricing: CartPricing;
            };
          }>(`/cart/items/${sku}`, {
            method: 'PATCH',
            headers: { 'x-session-id': sid },
            body: JSON.stringify({ quantity }),
          });

          const totalCount = res.data.items.reduce((acc, i) => acc + i.quantity, 0);

          set({
            items: res.data.items,
            pricing: res.data.pricing,
            itemCount: totalCount,
            loading: false,
          });
        } catch (err: unknown) {
          set({ loading: false });
          throw err;
        }
      },

      removeItem: async (sku: string) => {
        const sid = get().sessionId || getOrGenerateSessionId();
        set({ loading: true });

        try {
          const res = await apiFetch<{
            success: boolean;
            data: {
              items: CartItem[];
              pricing: CartPricing;
            };
          }>(`/cart/items/${sku}`, {
            method: 'DELETE',
            headers: { 'x-session-id': sid },
          });

          const totalCount = res.data.items.reduce((acc, i) => acc + i.quantity, 0);

          set({
            items: res.data.items,
            pricing: res.data.pricing,
            itemCount: totalCount,
            loading: false,
          });
        } catch (err: unknown) {
          set({ loading: false });
          throw err;
        }
      },

      mergeGuestCart: async () => {
        const sid = get().sessionId;
        if (!sid) return;

        try {
          const res = await apiFetch<{
            success: boolean;
            data: {
              items: CartItem[];
              pricing: CartPricing;
            };
          }>('/cart/merge', {
            method: 'POST',
            body: JSON.stringify({ guestSessionId: sid }),
          });

          const totalCount = res.data.items.reduce((acc, i) => acc + i.quantity, 0);

          set({
            items: res.data.items,
            pricing: res.data.pricing,
            itemCount: totalCount,
          });
        } catch {
          // Handled silently
        }
      },
    }),
    {
      name: 'shopsense_cart_client',
      partialize: (state) => ({ sessionId: state.sessionId }),
    }
  )
);
