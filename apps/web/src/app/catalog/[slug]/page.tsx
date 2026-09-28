'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronRight, Heart, Loader2, Minus, PackageCheck, Plus, RotateCcw, Share2, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, Zap } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { discountPercent, FALLBACK_IMAGE, FREE_SHIPPING_THRESHOLD, inr, readRecentlyViewed, rememberViewed, type ProductSummary, type RecentProduct } from '../../../lib/catalog';
import { useShopActions } from '../../../components/product/useShopActions';
import { ProductCard } from '../../../components/product/ProductCard';
import { Rail, RecentCard } from '../../../components/product/ProductRail';
import { OfferTicket, useOffers } from '../../../components/common/OffersStrip';
import { toast } from '../../../stores/toast.store';

interface ProductDetail extends ProductSummary {
  bulletPoints: string[];
  brandId?: { _id: string; name: string; slug: string; logo?: { url: string } } | null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { addToCart, addingSku, toggleWishlist, isSaved, wishlistPending } = useShopActions();
  const offers = useOffers();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [variantIndex, setVariantIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<'details' | 'shipping'>('details');
  const [related, setRelated] = useState<ProductSummary[]>([]);
  const [recent, setRecent] = useState<RecentProduct[]>([]);

  const fetchProduct = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ data: ProductDetail }>(`/catalog/products/${slug}`);
      setProduct(res.data);
      setVariantIndex(Math.max(0, res.data.variants.findIndex((variant) => variant.stock > 0)));
      setImageIndex(0);
      setQuantity(1);
      // Read the list before adding this product so it does not recommend itself.
      setRecent(readRecentlyViewed().filter((item) => item._id !== res.data._id));
      rememberViewed(res.data);
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void fetchProduct(); }, [fetchProduct]);

  useEffect(() => {
    if (!product?.categoryId?.slug) return;
    apiFetch<{ data: { products: ProductSummary[] } }>(`/catalog/products?category=${product.categoryId.slug}&limit=9&sort=popular`)
      .then((res) => setRelated(res.data.products.filter((item) => item._id !== product._id).slice(0, 8)))
      .catch(() => setRelated([]));
  }, [product]);

  if (loading) return <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
    <div className="aspect-square animate-pulse rounded-3xl bg-slate-100" />
    <div className="space-y-4 pt-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-100" /><div className="h-10 w-3/4 animate-pulse rounded bg-slate-100" /><div className="h-8 w-40 animate-pulse rounded bg-slate-100" /><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-12 animate-pulse rounded-2xl bg-slate-100" /></div>
  </div>;

  if (!product) return <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
    <h2 className="text-2xl font-extrabold text-slate-900">Product not found</h2>
    <p className="mb-6 mt-2 text-sm text-slate-500">It may have been moved or is no longer available.</p>
    <Link href="/catalog" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700">Browse the catalog</Link>
  </div>;

  const variant = product.variants[variantIndex] || product.variants[0];
  const images = variant?.images?.length ? variant.images.map((image) => image.url) : [FALLBACK_IMAGE];
  const price = variant?.price ?? product.basePrice;
  const compareAt = variant?.compareAtPrice ?? product.compareAtPrice;
  const discount = discountPercent(price, compareAt);
  const stock = variant?.stock ?? 0;
  const saved = isSaved(product._id);
  const adding = addingSku === variant?.sku;
  const lineTotal = price * quantity;
  const deliveryDate = new Date(Date.now() + 4 * 86400000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const handleAdd = async () => {
    if (!variant) return;
    if (await addToCart(product, variant.sku, quantity)) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2000);
    }
  };
  const handleBuyNow = async () => {
    if (variant && await addToCart(product, variant.sku, quantity)) router.push('/checkout');
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.title, url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied', { description: 'Share it with anyone.' }); }
    } catch { /* The shopper closed the share sheet. */ }
  };

  const buyButtons = (compact = false) => <>
    <button onClick={() => void handleAdd()} disabled={!stock || adding} className={`flex flex-1 items-center justify-center gap-2 rounded-2xl font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none ${compact ? 'h-12 text-sm' : 'h-14 text-base'} ${added ? 'bg-emerald-700' : 'bg-emerald-600 shadow-emerald-600/25 hover:bg-emerald-700'}`}>
      {adding ? <Loader2 className="size-5 animate-spin" /> : added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}{!stock ? 'Sold out' : added ? 'Added' : 'Add to cart'}
    </button>
    <button onClick={() => void handleBuyNow()} disabled={!stock || adding} className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 ${compact ? 'h-12 text-sm' : 'h-14 text-base'}`}><Zap className="size-5 text-emerald-400" />Buy now</button>
  </>;

  return <div className="pb-24 lg:pb-0">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <nav className="mb-6 flex items-center gap-1.5 overflow-hidden text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="shrink-0 hover:text-emerald-700">Home</Link><ChevronRight className="size-3 shrink-0" />
        {product.categoryId && <><Link href={`/catalog?category=${product.categoryId.slug}`} className="shrink-0 hover:text-emerald-700">{product.categoryId.name}</Link><ChevronRight className="size-3 shrink-0" /></>}
        <span className="truncate font-medium text-slate-900">{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {images.length > 1 && <div className="no-scrollbar flex gap-2 overflow-x-auto sm:max-h-[560px] sm:flex-col sm:overflow-y-auto">{images.map((url, index) => <button key={url + index} onClick={() => setImageIndex(index)} aria-label={`Image ${index + 1}`} className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-slate-100 transition sm:size-20 ${index === imageIndex ? 'border-emerald-600' : 'border-transparent opacity-60 hover:opacity-100'}`}><Image src={url} alt="" fill sizes="80px" className="object-cover" /></button>)}</div>}
            <div className="group relative aspect-square flex-1 overflow-hidden rounded-3xl bg-slate-100">
              <Image src={images[imageIndex] || images[0]} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-110" />
              {discount > 0 && <span className="absolute left-4 top-4 rounded-full bg-rose-600 px-3 py-1 text-sm font-bold text-white shadow">−{discount}%</span>}
              <div className="absolute right-4 top-4 flex flex-col gap-2">
                <button onClick={() => void toggleWishlist(product)} disabled={wishlistPending === product._id} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'} className="grid size-11 place-items-center rounded-full bg-white/95 shadow-md transition hover:scale-110"><Heart className={`size-5 ${saved ? 'fill-rose-500 text-rose-500' : 'text-slate-700'}`} /></button>
                <button onClick={() => void share()} aria-label="Share" className="grid size-11 place-items-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:scale-110"><Share2 className="size-5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase panel */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {product.brandId && <Link href={`/catalog?brand=${product.brandId.slug}`} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700">{product.brandId.name}</Link>}
            {product.categoryId && <Link href={`/catalog?category=${product.categoryId.slug}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100">{product.categoryId.name}</Link>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl">{product.title}</h1>
          {product.rating?.count > 0 && <p className="mt-3 flex items-center gap-2 text-sm"><span className="flex">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`size-4 ${index < Math.round(product.rating.average) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</span><strong>{product.rating.average.toFixed(1)}</strong><span className="text-slate-500">({product.rating.count} ratings)</span></p>}

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-4xl font-extrabold tracking-tight text-slate-950">{inr(price)}</span>{discount > 0 && <><span className="text-lg text-slate-400 line-through">{inr(compareAt)}</span><span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold text-emerald-800">You save {inr((compareAt || 0) - price)}</span></>}</p>
            <p className="mt-1 text-xs text-slate-500">GST added at checkout · {price >= FREE_SHIPPING_THRESHOLD ? 'Free delivery' : `Free delivery over ${inr(FREE_SHIPPING_THRESHOLD)}`}</p>

            {product.variants.length > 1 && <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-slate-900">Option: <span className="font-normal text-slate-600">{Object.values(variant?.attributes || {}).join(' / ') || variant?.sku}</span></p>
              <div className="flex flex-wrap gap-2">{product.variants.map((option, index) => <button key={option.sku} onClick={() => { setVariantIndex(index); setImageIndex(0); setQuantity(1); }} disabled={option.stock === 0} className={`relative rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-dashed disabled:text-slate-300 ${index === variantIndex ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>{Object.values(option.attributes || {}).join(' / ') || option.sku}{option.stock === 0 && <span className="ml-1.5 text-[10px] font-bold">sold out</span>}</button>)}</div>
            </div>}

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50">
                <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid size-12 place-items-center text-slate-600 disabled:opacity-30"><Minus className="size-4" /></button>
                <span className="w-10 text-center text-base font-bold tabular-nums">{quantity}</span>
                <button onClick={() => setQuantity((value) => Math.min(stock, value + 1))} disabled={!stock || quantity >= stock} aria-label="Increase quantity" className="grid size-12 place-items-center text-slate-600 disabled:opacity-30"><Plus className="size-4" /></button>
              </div>
              <div>
                {!stock ? <p className="text-sm font-bold text-rose-600">Out of stock</p>
                  : stock <= 5 ? <p className="text-sm font-bold text-amber-600">Hurry — only {stock} left</p>
                    : <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700"><PackageCheck className="size-4" />In stock</p>}
                {quantity > 1 && <p className="text-xs text-slate-500">Total {inr(lineTotal)}</p>}
              </div>
            </div>

            <div className="mt-5 hidden gap-3 sm:flex">{buyButtons()}</div>

            {stock > 0 && <p className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600"><Truck className="size-4 shrink-0 text-emerald-600" />Order today — estimated delivery by <strong className="text-slate-900">{deliveryDate}</strong></p>}
          </div>

          {offers.length > 0 && <div className="mt-5 space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Sparkles className="size-4 text-emerald-600" />Available offers</p>
            {offers.slice(0, 2).map((offer) => <OfferTicket key={offer._id} offer={offer} />)}
          </div>}

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[{ icon: Truck, title: 'Fast delivery', text: 'Across India' }, { icon: ShieldCheck, title: 'Secure payment', text: 'Razorpay protected' }, { icon: RotateCcw, title: 'Easy returns', text: 'From your orders' }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-3"><Icon className="mx-auto size-5 text-emerald-600" /><p className="mt-1 text-xs font-bold text-slate-900">{title}</p><p className="text-[10px] text-slate-500">{text}</p></div>)}
          </div>

          <div className="mt-8">
            <div className="flex gap-1 border-b border-slate-200" role="tablist">
              {([['details', 'Details'], ['shipping', 'Shipping & returns']] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold transition ${tab === value ? 'border-slate-900 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
            </div>
            {tab === 'details'
              ? <div className="space-y-5 py-5">
                  {product.bulletPoints?.length > 0 && <ul className="space-y-2">{product.bulletPoints.map((point) => <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{point}</li>)}</ul>}
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{product.description}</p>
                  {variant && <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-slate-50 p-4 text-sm">{Object.entries(variant.attributes || {}).map(([key, value]) => <div key={key} className="contents"><dt className="capitalize text-slate-500">{key}</dt><dd className="font-semibold text-slate-900">{value}</dd></div>)}<dt className="text-slate-500">SKU</dt><dd className="font-mono text-xs font-semibold text-slate-900">{variant.sku}</dd></dl>}
                </div>
              : <div className="space-y-3 py-5 text-sm leading-6 text-slate-600">
                  <p><strong className="text-slate-900">Delivery:</strong> Free on orders over {inr(FREE_SHIPPING_THRESHOLD)}; otherwise ₹99. Most orders arrive in 3–5 working days, and you get a tracking number once it ships.</p>
                  <p><strong className="text-slate-900">Returns:</strong> Raise a return or refund request from <Link href="/account/orders" className="font-semibold text-emerald-700 hover:underline">My orders</Link> after delivery.</p>
                  <p><strong className="text-slate-900">Payment:</strong> UPI, cards, netbanking and wallets through Razorpay, or cash on delivery where available.</p>
                </div>}
          </div>
        </div>
      </div>
    </div>

    {related.length > 0 && <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8"><Rail eyebrow="More like this" title={`More in ${product.categoryId?.name || 'this category'}`}>{related.map((item) => <div key={item._id}><ProductCard product={item} /></div>)}</Rail></section>}
    {recent.length > 0 && <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8"><Rail eyebrow="Your history" title="Recently viewed">{recent.map((item) => <div key={item._id}><RecentCard item={item} /></div>)}</Rail></section>}

    {/* Sticky buy bar on phones so the main action is always within reach. */}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
      <div className="mb-2 flex items-center justify-between text-sm"><span className="truncate pr-3 font-semibold text-slate-700">{product.title}</span><span className="shrink-0 font-extrabold">{inr(lineTotal)}</span></div>
      <div className="flex gap-2">{buyButtons(true)}</div>
    </div>
  </div>;
}
