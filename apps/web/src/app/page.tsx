'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BadgePercent, ChevronRight, Flame, History, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { discountPercent, readRecentlyViewed, type ProductSummary, type RecentProduct } from '../lib/catalog';
import { ProductCard, ProductCardSkeleton } from '../components/product/ProductCard';
import { Rail, RecentCard } from '../components/product/ProductRail';
import { OfferTicket, useOffers } from '../components/common/OffersStrip';
import { SearchBox } from '../components/common/SearchBox';

interface CategoryItem { _id: string; name: string; slug: string; description?: string; image?: { url: string } }
type ProductsResponse = { data: { products: ProductSummary[] } };

const departmentImages: Record<string, string> = {
  electronics: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=720&q=85',
  'mens-apparel': 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=720&q=85',
  'womens-collection': 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=720&q=85',
  footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=720&q=85',
  accessories: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=720&q=85',
  'home-workspace': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=720&q=85',
};
const fallbackDepartmentImage = departmentImages.electronics;

function SectionHeader({ eyebrow, title, href, linkLabel, icon }: { eyebrow: string; title: string; href?: string; linkLabel?: string; icon?: React.ReactNode }) {
  return <div className="mb-5 flex items-end justify-between gap-4">
    <div><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">{icon}{eyebrow}</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h2></div>
    {href && <Link href={href} className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:border-slate-900">{linkLabel}<ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" /></Link>}
  </div>;
}

export default function Home() {
  const offers = useOffers();
  const [featured, setFeatured] = useState<ProductSummary[]>([]);
  const [trending, setTrending] = useState<ProductSummary[]>([]);
  const [deals, setDeals] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [recent, setRecent] = useState<RecentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setRecent(readRecentlyViewed());
    Promise.all([
      apiFetch<ProductsResponse>('/catalog/products?featured=true&limit=8'),
      apiFetch<ProductsResponse>('/catalog/products?sort=popular&limit=8'),
      apiFetch<ProductsResponse>('/catalog/products?sort=newest&limit=40&inStock=true'),
      apiFetch<{ data: CategoryItem[] }>('/catalog/categories'),
    ])
      .then(([featuredRes, trendingRes, latestRes, categoryRes]) => {
        setFeatured(featuredRes.data.products);
        setTrending(trendingRes.data.products);
        // Deals are real markdowns: products whose price sits below their compare-at price.
        setDeals(latestRes.data.products
          .filter((product) => discountPercent(product.basePrice, product.compareAtPrice) > 0)
          .sort((a, b) => discountPercent(b.basePrice, b.compareAtPrice) - discountPercent(a.basePrice, a.compareAtPrice))
          .slice(0, 10));
        setCategories(categoryRes.data);
      })
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, []);

  const grid = (products: ProductSummary[], emptyText: string) => products.length
    ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{products.map((product, index) => <ProductCard key={product._id} product={product} priority={index < 4} />)}</div>
    : loading
      ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)}</div>
      : <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{unavailable ? 'The shop is reconnecting — products will appear shortly.' : emptyText}</p>;

  const heroTiles = (featured.length ? featured : trending).slice(0, 2);

  return <div className="space-y-16 pb-8 sm:space-y-20">
    {/* Hero */}
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 size-[30rem] rounded-full bg-teal-400/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div className="fade-up">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-white/15"><Sparkles className="size-3.5" />New season, fresh picks</p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Shop smarter.<br /><span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">Live better.</span></h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/80">Style, tech and home essentials — honest prices, secure checkout and delivery across India.</p>
          <SearchBox className="mt-7 max-w-lg [&_form]:border-white/20 [&_form]:bg-white [&_form]:py-1 [&_form]:shadow-xl" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/catalog" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-emerald-50">Start shopping <ArrowRight className="size-4" /></Link>
            {deals.length > 0 && <a href="#deals" className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/10"><BadgePercent className="size-4" />See today&apos;s deals</a>}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-emerald-100/70">
            <span className="inline-flex items-center gap-1.5"><Truck className="size-4 text-emerald-300" />Free delivery over ₹999</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-300" />Secure Razorpay checkout</span>
          </div>
        </div>
        <div className="relative hidden h-[420px] lg:block">
          <div className="absolute right-0 top-0 h-[340px] w-[64%] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10"><Image src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=85" alt="A bright, modern store" fill priority sizes="30vw" className="object-cover" /></div>
          {heroTiles.map((product, index) => <Link key={product._id} href={`/catalog/${product.slug}`} className={`absolute flex w-56 items-center gap-3 rounded-2xl bg-white/95 p-2.5 text-slate-900 shadow-2xl backdrop-blur transition hover:-translate-y-1 ${index === 0 ? 'bottom-6 left-0' : 'left-10 top-10'}`}>
            <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100"><Image src={product.variants[0]?.images?.[0]?.url || fallbackDepartmentImage} alt="" fill sizes="56px" className="object-cover" /></span>
            <span className="min-w-0"><span className="block truncate text-xs font-bold">{product.title}</span><span className="text-sm font-extrabold text-emerald-700">₹{product.basePrice.toLocaleString('en-IN')}</span></span>
          </Link>)}
        </div>
      </div>
    </section>

    {/* Offers */}
    {offers.length > 0 && <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader eyebrow="Save more" title="Offers for you" icon={<BadgePercent className="size-3.5" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{offers.slice(0, 6).map((offer) => <OfferTicket key={offer._id} offer={offer} />)}</div>
    </section>}

    {/* Categories */}
    {categories.length > 0 && <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader eyebrow="Find your corner" title="Shop by category" href="/catalog" linkLabel="All products" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.slice(0, 6).map((category) => <Link key={category._id} href={`/catalog?category=${category.slug}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-200">
          <Image src={category.image?.url || departmentImages[category.slug] || fallbackDepartmentImage} alt={category.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw" className="object-cover transition duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
          <span className="absolute inset-x-3 bottom-3 flex items-center justify-between text-sm font-bold text-white">{category.name}<span className="grid size-7 place-items-center rounded-full bg-white/20 backdrop-blur transition group-hover:bg-white group-hover:text-slate-900"><ArrowRight className="size-3.5" /></span></span>
        </Link>)}
      </div>
    </section>}

    {/* Featured */}
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader eyebrow="Chosen by our editors" title="Featured products" href="/catalog" linkLabel="Shop all" icon={<Sparkles className="size-3.5" />} />
      {grid(featured, 'New featured products are on their way.')}
    </section>

    {/* Deals */}
    {deals.length > 0 && <section id="deals" className="scroll-mt-24 bg-gradient-to-b from-rose-50/70 to-transparent py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Rail eyebrow="Marked down" title="Deals worth grabbing">{deals.map((product) => <div key={product._id}><ProductCard product={product} /></div>)}</Rail>
      </div>
    </section>}

    {/* Trending */}
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeader eyebrow="Most-loved right now" title="Trending this week" href="/catalog?sort=popular" linkLabel="Best sellers" icon={<Flame className="size-3.5" />} />
      {grid(trending, 'Popular picks will appear as customers shop.')}
    </section>

    {/* Recently viewed */}
    {recent.length > 0 && <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Rail eyebrow="Pick up where you left off" title="Recently viewed" action={<History className="hidden size-4 text-slate-400 sm:block" />}>{recent.map((item) => <div key={item._id}><RecentCard item={item} /></div>)}</Rail>
    </section>}

    {/* Promo */}
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="relative isolate flex min-h-[280px] items-center overflow-hidden rounded-3xl bg-slate-950">
        <Image src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1600&q=90" alt="Red running sneaker" fill sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-transparent" />
        <div className="max-w-lg px-6 py-12 text-white sm:px-12">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-300">Step into something new</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">The sneaker rotation</h2>
          <p className="mt-2 text-sm text-white/80">Everyday pairs, performance favourites and the details that matter.</p>
          <Link href="/catalog?category=footwear" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-rose-50">Explore footwear <ArrowRight className="size-4" /></Link>
        </div>
      </div>
    </section>
  </div>;
}
