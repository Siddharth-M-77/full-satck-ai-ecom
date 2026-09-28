import { create } from 'zustand';
import { apiFetch } from '../lib/api';

interface WishlistState {
  ids: string[];
  /** True once the saved ids have come back from the server. */
  ready: boolean;
  loadedFor: string | null;
  pending: string | null;
  load: (userKey: string) => Promise<void>;
  toggle: (productId: string) => Promise<boolean>;
  reset: () => void;
}

/** One shared copy of the saved product ids, so every heart on the page agrees. */
export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: [],
  ready: false,
  loadedFor: null,
  pending: null,
  load: async (userKey) => {
    if (get().loadedFor === userKey) return;
    set({ loadedFor: userKey });
    try {
      const res = await apiFetch<{ data: { productIds: Array<{ _id: string }> } }>('/cart/wishlist');
      set({ ids: res.data.productIds.map((product) => product._id), ready: true });
    } catch {
      set({ loadedFor: null });
    }
  },
  toggle: async (productId) => {
    const saved = get().ids.includes(productId);
    set({ pending: productId, ids: saved ? get().ids.filter((id) => id !== productId) : [...get().ids, productId] });
    try {
      await apiFetch(`/cart/wishlist/${productId}`, { method: saved ? 'DELETE' : 'POST' });
      return !saved;
    } catch (err) {
      // Roll back the optimistic change so the heart reflects the server.
      set({ ids: saved ? [...get().ids, productId] : get().ids.filter((id) => id !== productId) });
      throw err;
    } finally {
      set({ pending: null });
    }
  },
  reset: () => set({ ids: [], ready: false, loadedFor: null }),
}));
