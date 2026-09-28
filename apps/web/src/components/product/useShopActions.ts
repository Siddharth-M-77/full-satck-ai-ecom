'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { useAuthStore } from '../../stores/auth.store';
import { useCartStore } from '../../stores/cart.store';
import { useWishlistStore } from '../../stores/wishlist.store';
import { errorMessage, toast } from '../../stores/toast.store';
import type { ProductSummary } from '../../lib/catalog';

/** The single quick-view dialog mounted in the layout reads the product from here. */
export const useQuickViewStore = create<{ product: ProductSummary | null; open: (product: ProductSummary) => void; close: () => void }>((set) => ({
  product: null,
  open: (product) => set({ product }),
  close: () => set({ product: null }),
}));

/** Cart and wishlist actions with consistent feedback, shared by every product surface. */
export function useShopActions() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const addItem = useCartStore((state) => state.addItem);
  const { ids, pending, load, toggle, reset } = useWishlistStore();
  const [addingSku, setAddingSku] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) void load(user.id || user.email);
    else reset();
  }, [isAuthenticated, user, load, reset]);

  const addToCart = async (product: Pick<ProductSummary, '_id' | 'title'>, sku: string, quantity = 1) => {
    setAddingSku(sku);
    try {
      await addItem(product._id, sku, quantity);
      toast.success('Added to cart', { description: product.title, action: { label: 'View cart', href: '/cart' } });
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add to cart'));
      return false;
    } finally {
      setAddingSku(null);
    }
  };

  const toggleWishlist = async (product: Pick<ProductSummary, '_id' | 'title'>) => {
    if (!isAuthenticated) {
      toast.info('Sign in to save items', { action: { label: 'Sign in', href: '/login' } });
      router.push('/login');
      return;
    }
    try {
      const saved = await toggle(product._id);
      toast.success(saved ? 'Saved to wishlist' : 'Removed from wishlist', saved ? { action: { label: 'View wishlist', href: '/wishlist' } } : {});
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update wishlist'));
    }
  };

  return {
    addToCart,
    addingSku,
    toggleWishlist,
    isSaved: (productId: string) => ids.includes(productId),
    wishlistPending: pending,
  };
}
