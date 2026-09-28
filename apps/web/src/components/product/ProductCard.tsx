'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Eye, Heart, Loader2, ShoppingBag, Star } from 'lucide-react';
import { discountPercent, inr, productImages, FALLBACK_IMAGE, totalStock, type ProductSummary } from '../../lib/catalog';
import { useQuickViewStore, useShopActions } from './useShopActions';

type Props = { product: ProductSummary; priority?: boolean; layout?: 'grid' | 'list' };

export function ProductCard({ product, priority = false, layout = 'grid' }: Props) {
  const { addToCart, addingSku, toggleWishlist, isSaved, wishlistPending } = useShopActions();
  const openQuickView = useQuickViewStore((state) => state.open);
  const images = productImages(product);
  const [first, second] = [images[0] || FALLBACK_IMAGE, images[1]];
  const buyable = product.variants.find((variant) => variant.stock > 0);
  const stock = totalStock(product);
  const discount = discountPercent(product.basePrice, product.compareAtPrice);
  const saved = isSaved(product._id);
  const hasOptions = product.variants.length > 1;
  const adding = Boolean(buyable && addingSku === buyable.sku);

  const quickAdd = () => {
    if (!buyable) return;
    // With several options the shopper must pick one, so show the quick view instead of guessing.
    if (hasOptions) openQuickView(product);
    else void addToCart(product, buyable.sku);
  };

  const badges = <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
    {discount > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">−{discount}%</span>}
    {!buyable ? <span className="rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-bold text-white">Sold out</span>
      : stock <= 5 ? <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">Only {stock} left</span>
        : product.isFeatured ? <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shadow-sm">Editor&apos;s pick</span> : null}
  </div>;

  const media = <div className={`group/media relative overflow-hidden bg-slate-100 ${layout === 'list' ? 'aspect-square w-32 shrink-0 rounded-xl sm:w-44' : 'aspect-[4/5] rounded-2xl'}`}>
    <Link href={`/catalog/${product.slug}`} aria-label={product.title} className="absolute inset-0">
      <Image src={first} alt={product.title} fill priority={priority} sizes={layout === 'list' ? '176px' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'} className={`object-cover transition duration-700 group-hover/media:scale-105 ${second ? 'group-hover/media:opacity-0' : ''} ${!buyable ? 'grayscale-[40%]' : ''}`} />
      {second && <Image src={second} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover opacity-0 transition duration-700 group-hover/media:scale-105 group-hover/media:opacity-100" />}
    </Link>
    {badges}
    <button type="button" onClick={() => void toggleWishlist(product)} disabled={wishlistPending === product._id} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'} className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:scale-110 hover:text-rose-600 disabled:opacity-60">
      <Heart className={`size-4 transition ${saved ? 'fill-rose-500 text-rose-500' : ''}`} />
    </button>
    {layout === 'grid' && <button type="button" onClick={() => openQuickView(product)} className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-2 items-center justify-center gap-1.5 rounded-xl bg-white/95 py-2 text-xs font-bold text-slate-900 opacity-0 shadow-lg backdrop-blur transition group-hover/media:translate-y-0 group-hover/media:opacity-100 sm:flex">
      <Eye className="size-3.5" />Quick view
    </button>}
  </div>;

  const details = <div className={`min-w-0 ${layout === 'list' ? 'flex flex-1 flex-col py-1' : 'pt-3'}`}>
    <div className="flex min-h-5 items-center justify-between gap-2">
      <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{product.brandId?.name || product.categoryId?.name || 'ShopSense'}</span>
      {product.rating?.count > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-slate-700"><Star className="size-3 fill-amber-400 text-amber-400" />{product.rating.average.toFixed(1)}<span className="font-normal text-slate-400">({product.rating.count})</span></span>}
    </div>
    <Link href={`/catalog/${product.slug}`} className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900 transition hover:text-emerald-700">{product.title}</Link>
    {layout === 'list' && product.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>}
    <div className={`flex items-end justify-between gap-2 ${layout === 'list' ? 'mt-auto pt-3' : 'mt-2'}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-1.5"><span className="text-base font-extrabold text-slate-950">{hasOptions ? 'From ' : ''}{inr(product.basePrice)}</span>{discount > 0 && <span className="text-xs text-slate-400 line-through">{inr(product.compareAtPrice)}</span>}</p>
        {hasOptions && <p className="text-[11px] text-slate-500">{product.variants.length} options</p>}
      </div>
      <button type="button" onClick={quickAdd} disabled={!buyable || adding} aria-label={buyable ? `Add ${product.title} to cart` : 'Sold out'} title={!buyable ? 'Sold out' : hasOptions ? 'Choose an option' : 'Add to cart'} className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-900 text-white shadow-sm transition hover:scale-105 hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
        {adding ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
      </button>
    </div>
  </div>;

  return <article className={`group min-w-0 ${layout === 'list' ? 'flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-3 transition hover:shadow-lg hover:shadow-slate-900/5' : ''}`}>
    {media}
    {details}
  </article>;
}

export function ProductCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'list' }) {
  if (layout === 'list') return <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-3"><div className="aspect-square w-32 animate-pulse rounded-xl bg-slate-100 sm:w-44" /><div className="flex-1 space-y-2 py-2"><div className="h-3 w-20 animate-pulse rounded bg-slate-100" /><div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" /><div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" /></div></div>;
  return <div><div className="aspect-[4/5] animate-pulse rounded-2xl bg-slate-100" /><div className="mt-3 h-3 w-16 animate-pulse rounded bg-slate-100" /><div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-slate-100" /><div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" /></div>;
}
