'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Heart, ShoppingBag } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { totalStock, type ProductSummary } from '../../lib/catalog';
import { useAuthStore } from '../../stores/auth.store';
import { useWishlistStore } from '../../stores/wishlist.store';
import { errorMessage, toast } from '../../stores/toast.store';
import { ProductCard, ProductCardSkeleton } from '../../components/product/ProductCard';
import { useShopActions } from '../../components/product/useShopActions';

export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const savedIds = useWishlistStore((state) => state.ids);
  const idsReady = useWishlistStore((state) => state.ready);
  const { addToCart } = useShopActions();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingAll, setMovingAll] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    apiFetch<{ data: { productIds: ProductSummary[] } }>('/cart/wishlist')
      .then((res) => setProducts(res.data.productIds))
      .catch((err) => toast.error(errorMessage(err, 'Could not load your wishlist')))
      .finally(() => setLoading(false));
  }, [isAuthenticated, router]);

  // Hearts un-saved from a card drop out of this list straight away.
  const visible = idsReady ? products.filter((product) => savedIds.includes(product._id)) : products;
  const buyable = visible.filter((product) => product.variants.length === 1 && totalStock(product) > 0);

  const addAllToCart = async () => {
    setMovingAll(true);
    for (const product of buyable) await addToCart(product, product.variants[0].sku);
    setMovingAll(false);
  };

  if (!isAuthenticated) return null;

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600"><Heart className="size-4 fill-rose-500 text-rose-500" />Saved for later</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Your wishlist</h1>
        <p className="mt-1 text-sm text-slate-500">{loading ? 'Loading…' : `${visible.length} saved item${visible.length === 1 ? '' : 's'}`}</p>
      </div>
      {buyable.length > 1 && <button onClick={() => void addAllToCart()} disabled={movingAll} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><ShoppingBag className="size-4" />{movingAll ? 'Adding…' : `Add ${buyable.length} to cart`}</button>}
    </header>

    {loading
      ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)}</div>
      : visible.length === 0
        ? <section className="mx-auto max-w-md py-16 text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-rose-50"><Heart className="size-9 text-rose-400" /></div>
            <h2 className="mt-5 text-xl font-extrabold text-slate-900">Nothing saved yet</h2>
            <p className="mt-1 text-sm text-slate-500">Tap the heart on any product to keep it here for later.</p>
            <Link href="/catalog" className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700">Browse products <ArrowRight className="size-4" /></Link>
          </section>
        : <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{visible.map((product) => <ProductCard key={product._id} product={product} />)}</div>}
  </main>;
}
