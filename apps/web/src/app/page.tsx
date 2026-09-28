'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '../lib/api';
import { useCartStore } from '../stores/cart.store';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';

interface ProductItem {
  _id: string;
  title: string;
  slug: string;
  basePrice: number;
  compareAtPrice?: number;
  rating: { average: number; count: number };
  categoryId?: { name: string; slug: string };
  variants: Array<{
    sku: string;
    stock: number;
    images: Array<{ url: string }>;
  }>;
}

interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image?: { url: string };
}

const fallbackDepartments = [
  { name: 'Electronics & Audio', slug: 'electronics', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=720&q=85' },
  { name: "Men's Apparel", slug: 'mens-apparel', image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=720&q=85' },
  { name: "Women's Collection", slug: 'womens-collection', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=720&q=85' },
  { name: 'Sneakers & Footwear', slug: 'footwear', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=720&q=85' },
  { name: 'Watches & Accessories', slug: 'accessories', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=720&q=85' },
  { name: 'Home & Workspace', slug: 'home-workspace', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=720&q=85' },
];

export default function Home() {
  const { addItem } = useCartStore();
  const [featuredProducts, setFeaturedProducts] = useState<ProductItem[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [addingSku, setAddingSku] = useState<string | null>(null);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [featuredRes, trendingRes, catRes] = await Promise.all([
          apiFetch<{ success: boolean; data: { products: ProductItem[] } }>(
            '/catalog/products?featured=true&limit=8'
          ),
          apiFetch<{ success: boolean; data: { products: ProductItem[] } }>(
            '/catalog/products?sort=popular&limit=8'
          ),
          apiFetch<{ success: boolean; data: CategoryItem[] }>(
            '/catalog/categories'
          ),
        ]);
        setFeaturedProducts(featuredRes.data.products);
        setTrendingProducts(trendingRes.data.products);
        setCategories(catRes.data);
      } catch {
        setCatalogUnavailable(true);
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadData();
  }, []);

  const handleQuickAdd = async (product: ProductItem) => {
    const primary = product.variants?.[0];
    if (!primary || primary.stock < 1) return;

    setAddingSku(primary.sku);
    try {
      await addItem(product._id, primary.sku, 1);
      setTimeout(() => setAddingSku(null), 1200);
    } catch {
      setAddingSku(null);
    }
  };

  const departmentLinks = categories.length > 0
    ? categories.map((category) => ({
        name: category.name,
        slug: category.slug,
        image: category.image?.url || fallbackDepartments.find((item) => item.slug === category.slug)?.image || fallbackDepartments[0].image,
      }))
    : fallbackDepartments;

  const renderProductGrid = (products: ProductItem[]) => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
      {products.map((product) => {
        const primary = product.variants?.[0];
        const imageUrl = primary?.images?.[0]?.url || fallbackDepartments[0].image;
        const isAdding = addingSku === primary?.sku;
        const discount = product.compareAtPrice && product.compareAtPrice > product.basePrice
          ? Math.round((1 - product.basePrice / product.compareAtPrice) * 100)
          : 0;

        return (
          <article key={product._id} className="group min-w-0">
            <Link href={`/catalog/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-md bg-slate-100">
              <Image src={imageUrl} alt={product.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" />
              {discount > 0 && <span className="absolute left-2 top-2 rounded-sm bg-white px-2 py-1 text-[10px] font-bold text-rose-700">-{discount}%</span>}
            </Link>
            <div className="pt-3">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <span className="truncate text-[10px] font-semibold uppercase text-slate-500">{product.categoryId?.name || 'ShopSense pick'}</span>
                {product.rating?.average > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-slate-700"><Star className="size-3 fill-amber-400 text-amber-500" />{product.rating.average.toFixed(1)}</span>}
              </div>
              <Link href={`/catalog/${product.slug}`} className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-900 hover:text-emerald-700">{product.title}</Link>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-extrabold text-slate-950">₹{product.basePrice.toLocaleString('en-IN')}</span>
                  {product.compareAtPrice && <span className="text-xs text-slate-400 line-through">₹{product.compareAtPrice.toLocaleString('en-IN')}</span>}
                </div>
                <button onClick={() => handleQuickAdd(product)} disabled={!primary || primary.stock < 1 || isAdding} aria-label={`Add ${product.title} to cart`} title={primary?.stock ? 'Add to cart' : 'Out of stock'} className="grid size-9 shrink-0 place-items-center rounded-full border border-slate-300 text-slate-800 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white disabled:opacity-45">
                  {isAdding ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8 pb-16 sm:space-y-12 sm:pb-20">
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <div className="relative isolate flex min-h-[280px] items-end overflow-hidden rounded-lg bg-slate-900 sm:min-h-[420px]">
          <Image
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2200&q=90"
            alt="A bright, modern clothing and lifestyle store"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-slate-950/35" />
          <div className="max-w-2xl px-6 pb-8 pt-28 text-white sm:px-10 sm:pb-12 lg:px-14">
            <p className="mb-3 text-xs font-bold uppercase text-white/85">The ShopSense edit</p>
            <h1 className="max-w-xl font-serif text-4xl font-bold leading-tight sm:text-5xl">Good finds for every day.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/85 sm:text-base">
              Fresh picks across style, tech and home, with the details you need to choose well.
            </p>
            <Link href="/catalog" className="mt-7 inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-50">
              Shop all products <ArrowRight className="size-4" />
            </Link>
          </div>
          <span className="absolute bottom-5 right-6 hidden text-xs font-medium text-white/80 sm:block">New-season essentials, picked for you</span>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
          <div><p className="text-xs font-bold uppercase text-emerald-700">Chosen by our editors</p><h2 className="mt-1 font-serif text-2xl font-bold text-slate-950 sm:text-3xl">Featured products</h2></div>
          <Link href="/catalog" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-emerald-700">Shop all <ChevronRight className="size-4" /></Link>
        </div>
        {featuredProducts.length > 0 ? renderProductGrid(featuredProducts) : loadingCatalog ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="aspect-[4/5] animate-pulse rounded-md bg-slate-100" />)}</div>
        ) : <p className="border-y border-slate-200 py-6 text-sm text-slate-600">{catalogUnavailable ? 'Products will appear when the shop catalog reconnects.' : 'New featured products are on their way.'}</p>}
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-slate-200 border-b border-slate-200 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 py-4 sm:justify-center"><Truck className="size-5 text-emerald-700" /><div><p className="text-xs font-bold text-slate-900">Free delivery over ₹999</p><p className="text-[11px] text-slate-500">Clear shipping at checkout</p></div></div>
        <div className="flex items-center gap-3 py-4 sm:justify-center sm:px-3"><ShieldCheck className="size-5 text-emerald-700" /><div><p className="text-xs font-bold text-slate-900">Secure checkout</p><p className="text-[11px] text-slate-500">Protected payments with Razorpay</p></div></div>
        <div className="flex items-center gap-3 py-4 sm:justify-center"><ShoppingBag className="size-5 text-emerald-700" /><div><p className="text-xs font-bold text-slate-900">Thoughtful selection</p><p className="text-[11px] text-slate-500">Useful things, across every category</p></div></div>
      </section>

      <section id="shop-collections" className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase text-emerald-700">Find your corner</p><h2 className="mt-1 font-serif text-2xl font-bold text-slate-950 sm:text-3xl">Shop by category</h2></div>
          <Link href="/catalog" className="hidden items-center gap-1 text-sm font-semibold text-slate-700 hover:text-emerald-700 sm:inline-flex">All departments <ChevronRight className="size-4" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {departmentLinks.map((category) => (
            <Link key={category.slug} href={`/catalog?category=${category.slug}`} className="group relative aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
              <Image src={category.image || fallbackDepartments[0].image} alt={category.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw" className="object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-slate-950/25 transition group-hover:bg-slate-950/40" />
              <span className="absolute inset-x-3 bottom-3 text-sm font-bold text-white drop-shadow">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div><p className="text-xs font-bold uppercase text-rose-700">Most-loved right now</p><h2 className="mt-1 font-serif text-2xl font-bold text-slate-950 sm:text-3xl">Trending this week</h2></div>
          <Link href="/catalog?sort=popular" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-rose-700">See popular picks <ChevronRight className="size-4" /></Link>
        </div>
        {trendingProducts.length > 0 ? renderProductGrid(trendingProducts) : loadingCatalog ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="aspect-[4/5] animate-pulse rounded-md bg-slate-100" />)}</div>
        ) : <p className="border-y border-slate-200 py-6 text-sm text-slate-600">{catalogUnavailable ? 'Popular picks will load with the live catalog.' : 'Popular picks will appear as customers shop.'}</p>}
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        <div className="relative isolate flex min-h-[260px] items-center overflow-hidden rounded-lg bg-slate-950">
          <Image src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1600&q=90" alt="Red running sneaker from the footwear collection" fill sizes="100vw" className="-z-20 object-cover object-center" />
          <div className="absolute inset-0 -z-10 bg-slate-950/35" />
          <div className="max-w-lg px-6 py-10 text-white sm:px-10">
            <p className="text-xs font-bold uppercase text-white/80">Step into something new</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">The sneaker rotation</h2>
            <p className="mt-2 text-sm text-white/85">Everyday pairs, performance favourites and the details that matter.</p>
            <Link href="/catalog?category=footwear" className="mt-5 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-rose-50">Explore footwear <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 rounded-lg bg-emerald-950 px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
          <div><p className="text-xs font-bold uppercase text-emerald-300">Looking for something?</p><h2 className="mt-1 font-serif text-2xl font-bold">Search across the whole shop.</h2></div>
          <form action="/catalog" className="flex w-full max-w-md items-center rounded-md bg-white p-1 sm:w-auto">
            <Search className="ml-3 size-4 shrink-0 text-slate-400" />
            <input name="search" type="search" placeholder="Headphones, sneakers, home..." className="min-w-0 flex-1 px-3 py-2 text-sm text-slate-900 outline-none" />
            <button type="submit" className="rounded bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">Search</button>
          </form>
        </div>
      </section>
    </div>
  );
}
