'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Heart, LoaderCircle, ShoppingBag, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useCartStore } from '../../stores/cart.store';

interface WishlistProduct {
  _id: string;
  title: string;
  slug: string;
  basePrice: number;
  compareAtPrice?: number;
  variants: Array<{
    sku: string;
    stock: number;
    images?: Array<{ url: string }>;
  }>;
}

interface WishlistResponse {
  data: { productIds: WishlistProduct[] };
}

export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { addItem } = useCartStore();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    apiFetch<WishlistResponse>('/cart/wishlist')
      .then((res) => setProducts(res.data.productIds))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load your saved items.');
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, router]);

  const removeProduct = async (productId: string) => {
    setPendingId(productId);
    setError('');
    try {
      await apiFetch(`/cart/wishlist/${productId}`, { method: 'DELETE' });
      setProducts((current) => current.filter((product) => product._id !== productId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to remove this item.');
    } finally {
      setPendingId(null);
    }
  };

  const addToCart = async (product: WishlistProduct) => {
    const variant = product.variants.find((item) => item.stock > 0);
    if (!variant) return;

    setPendingId(product._id);
    setError('');
    try {
      await addItem(product._id, variant.sku, 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to add this item to your cart.');
    } finally {
      setPendingId(null);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase text-rose-600">
            <Heart className="size-4 fill-rose-500" /> Saved for later
          </p>
          <h1 className="text-3xl font-extrabold text-slate-950">Your wishlist</h1>
          <p className="mt-1 text-sm text-slate-500">{products.length} saved {products.length === 1 ? 'item' : 'items'}</p>
        </div>
        <Link href="/catalog" className="hidden items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 sm:inline-flex">
          Continue shopping <ArrowRight className="size-4" />
        </Link>
      </header>

      {error && <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-slate-500" role="status">
          <LoaderCircle className="mr-2 size-5 animate-spin" /> Loading saved items
        </div>
      ) : products.length === 0 ? (
        <section className="flex min-h-72 flex-col items-center justify-center border-y border-slate-200 py-12 text-center">
          <Heart className="mb-4 size-9 text-slate-300" />
          <h2 className="text-lg font-bold text-slate-900">Nothing saved yet</h2>
          <p className="mt-1 text-sm text-slate-500">Save products while browsing to keep them close.</p>
          <Link href="/catalog" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Browse catalog <ArrowRight className="size-4" />
          </Link>
        </section>
      ) : (
        <ul className="divide-y divide-slate-200">
          {products.map((product) => {
            const image = product.variants[0]?.images?.[0]?.url;
            const inStock = product.variants.some((variant) => variant.stock > 0);

            return (
              <li key={product._id} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <Link href={`/catalog/${product.slug}`} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                  {image ? <Image src={image} alt={product.title} fill sizes="112px" className="object-cover" /> : <div className="grid h-full place-items-center text-slate-300"><ShoppingBag className="size-7" /></div>}
                </Link>
                <div className="min-w-0">
                  <Link href={`/catalog/${product.slug}`} className="line-clamp-2 font-semibold text-slate-900 hover:text-emerald-700">{product.title}</Link>
                  <p className="mt-1 text-sm font-bold text-slate-800">₹{product.basePrice.toLocaleString('en-IN')}</p>
                  <p className={`mt-1 text-xs font-medium ${inStock ? 'text-emerald-700' : 'text-slate-500'}`}>{inStock ? 'In stock' : 'Out of stock'}</p>
                </div>
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <button type="button" onClick={() => addToCart(product)} disabled={!inStock || pendingId === product._id} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45">
                    <ShoppingBag className="size-4" /> Add to cart
                  </button>
                  <button type="button" onClick={() => removeProduct(product._id)} disabled={pendingId === product._id} aria-label={`Remove ${product.title} from wishlist`} title="Remove from wishlist" className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}