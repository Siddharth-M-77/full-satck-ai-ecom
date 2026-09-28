'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Heart, Loader2, Minus, Plus, ShoppingBag, Star, X } from 'lucide-react';
import { discountPercent, FALLBACK_IMAGE, inr } from '../../lib/catalog';
import { useQuickViewStore, useShopActions } from './useShopActions';

export function QuickView() {
  const { product, close } = useQuickViewStore();
  const { addToCart, addingSku, toggleWishlist, isSaved } = useShopActions();
  const [variantIndex, setVariantIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    // Open on the first variant that can actually be bought.
    setVariantIndex(Math.max(0, product.variants.findIndex((variant) => variant.stock > 0)));
    setImageIndex(0);
    setQuantity(1);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [product, close]);

  if (!product) return null;
  const variant = product.variants[variantIndex] || product.variants[0];
  const images = variant?.images?.length ? variant.images.map((image) => image.url) : [FALLBACK_IMAGE];
  const price = variant?.price ?? product.basePrice;
  const compareAt = variant?.compareAtPrice ?? product.compareAtPrice;
  const discount = discountPercent(price, compareAt);
  const inStock = (variant?.stock ?? 0) > 0;

  const add = async () => {
    if (!variant) return;
    if (await addToCart(product, variant.sku, quantity)) close();
  };

  return <div className="fixed inset-0 z-[90] grid place-items-end bg-slate-950/50 backdrop-blur-sm sm:place-items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-label={product.title} className="sheet-in relative grid max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-4xl sm:grid-cols-2 sm:rounded-3xl">
      <button onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"><X className="size-4" /></button>
      <div className="bg-slate-50 p-3 sm:p-4">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
          <Image src={images[imageIndex] || images[0]} alt={product.title} fill sizes="(max-width: 640px) 100vw, 448px" className="object-cover" />
          {discount > 0 && <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">−{discount}%</span>}
        </div>
        {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">{images.map((url, index) => <button key={url + index} onClick={() => setImageIndex(index)} className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${index === imageIndex ? 'border-emerald-600' : 'border-transparent opacity-60 hover:opacity-100'}`}><Image src={url} alt="" fill sizes="64px" className="object-cover" /></button>)}</div>}
      </div>

      <div className="flex flex-col p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{product.brandId?.name || product.categoryId?.name}</p>
        <h2 className="mt-1 text-xl font-extrabold leading-tight text-slate-950 sm:text-2xl">{product.title}</h2>
        {product.rating?.count > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-slate-600"><Star className="size-3.5 fill-amber-400 text-amber-400" /><strong>{product.rating.average.toFixed(1)}</strong> · {product.rating.count} ratings</p>}
        <p className="mt-4 flex items-baseline gap-2"><span className="text-3xl font-extrabold text-slate-950">{inr(price)}</span>{discount > 0 && <><span className="text-sm text-slate-400 line-through">{inr(compareAt)}</span><span className="text-sm font-bold text-emerald-700">Save {inr((compareAt || 0) - price)}</span></>}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Plus GST · free delivery over ₹999</p>
        {product.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{product.description}</p>}

        {product.variants.length > 1 && <div className="mt-5">
          <p className="mb-2 text-xs font-bold text-slate-800">Choose an option</p>
          <div className="flex flex-wrap gap-2">{product.variants.map((option, index) => <button key={option.sku} type="button" onClick={() => { setVariantIndex(index); setImageIndex(0); setQuantity(1); }} disabled={option.stock === 0} className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:border-dashed disabled:text-slate-300 disabled:line-through ${index === variantIndex ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>{Object.values(option.attributes || {}).join(' / ') || option.sku}</button>)}</div>
        </div>}

        <p className={`mt-4 text-xs font-semibold ${!inStock ? 'text-rose-600' : (variant?.stock ?? 0) <= 5 ? 'text-amber-600' : 'text-emerald-700'}`}>{!inStock ? 'Out of stock' : (variant?.stock ?? 0) <= 5 ? `Hurry — only ${variant?.stock} left` : 'In stock, ready to ship'}</p>

        <div className="mt-auto flex items-center gap-2 pt-6">
          <div className="flex items-center rounded-xl border border-slate-200">
            <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid size-11 place-items-center text-slate-600 disabled:opacity-30"><Minus className="size-4" /></button>
            <span className="w-8 text-center text-sm font-bold tabular-nums">{quantity}</span>
            <button onClick={() => setQuantity((value) => Math.min(variant?.stock ?? 1, value + 1))} disabled={!inStock || quantity >= (variant?.stock ?? 0)} aria-label="Increase quantity" className="grid size-11 place-items-center text-slate-600 disabled:opacity-30"><Plus className="size-4" /></button>
          </div>
          <button onClick={() => void add()} disabled={!inStock || addingSku === variant?.sku} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
            {addingSku === variant?.sku ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}{inStock ? 'Add to cart' : 'Sold out'}
          </button>
          <button onClick={() => void toggleWishlist(product)} aria-pressed={isSaved(product._id)} aria-label="Save to wishlist" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:border-rose-300 hover:text-rose-600"><Heart className={`size-4 ${isSaved(product._id) ? 'fill-rose-500 text-rose-500' : ''}`} /></button>
        </div>
        <Link href={`/catalog/${product.slug}`} onClick={close} className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800">View full details <ArrowRight className="size-3.5" /></Link>
      </div>
    </section>
  </div>;
}
