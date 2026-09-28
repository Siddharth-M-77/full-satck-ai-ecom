'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '../lib/api';
import { useCartStore } from '../stores/cart.store';
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Zap,
  Star,
  Check,
} from 'lucide-react';

interface ProductItem {
  _id: string;
  title: string;
  slug: string;
  basePrice: number;
  compareAtPrice?: number;
  rating: { average: number; count: number };
  variants: Array<{
    sku: string;
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

export default function Home() {
  const { addItem } = useCartStore();
  const [featuredProducts, setFeaturedProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [addingSku, setAddingSku] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, catRes] = await Promise.all([
          apiFetch<{ success: boolean; data: { products: ProductItem[] } }>(
            '/catalog/products?featured=true&limit=8'
          ),
          apiFetch<{ success: boolean; data: CategoryItem[] }>(
            '/catalog/categories'
          ),
        ]);
        setFeaturedProducts(prodRes.data.products);
        setCategories(catRes.data);
      } catch {
        // Handled gracefully
      }
    }
    loadData();
  }, []);

  const handleQuickAdd = async (product: ProductItem) => {
    const primary = product.variants?.[0];
    if (!primary) return;

    setAddingSku(primary.sku);
    try {
      await addItem(product._id, primary.sku, 1);
      setTimeout(() => setAddingSku(null), 1200);
    } catch {
      setAddingSku(null);
    }
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-emerald-500/15 to-teal-400/15 blur-3xl rounded-full -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold mb-8 shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>Next-Generation Intelligent Commerce</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-950 max-w-4xl mx-auto leading-[1.1]">
            Experience Shopping, <br />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
              Powered by Intelligence.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mt-6 leading-relaxed">
            Full-stack AI-native e-commerce equipped with hybrid semantic vector search, conversational shopping assistant, atomic stock reservations, and Razorpay checkout.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            <Link
              href="/catalog"
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center gap-2 group"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Explore 50+ Products</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/register"
              className="px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-800 font-bold text-sm hover:border-slate-300 hover:bg-slate-50 transition shadow-sm"
            >
              Join ShopSense
            </Link>
          </div>

          {/* Key Value Proposition Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-16 text-left">
            <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-sm">
              <Zap className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-xs font-bold text-slate-900">Hybrid Vector Search</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Semantic AI meaning + exact text ranking</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-sm">
              <Truck className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-xs font-bold text-slate-900">Free Express Delivery</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Automated on all orders above ₹999</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-xs font-bold text-slate-900">Razorpay Protected</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Cards, UPI, Netbanking with test mode</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-sm">
              <RotateCcw className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-xs font-bold text-slate-900">Atomic Stock Guards</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Zero overselling with 15-min reservations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Curated Collections
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                Shop by Category
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((c) => (
              <Link
                key={c._id}
                href={`/catalog?category=${c.slug}`}
                className="group p-4 rounded-3xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-lg transition-all text-center flex flex-col items-center"
              >
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 mb-3 group-hover:scale-105 transition-transform">
                  <Image
                    src={c.image?.url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'}
                    alt={c.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                  {c.name}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products Showcase */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Trending Essentials
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                Featured Highlights
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Browse Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((p) => {
              const primary = p.variants?.[0];
              const imageUrl =
                primary?.images?.[0]?.url ||
                'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80';
              const isAdding = addingSku === primary?.sku;

              return (
                <div
                  key={p._id}
                  className="group flex flex-col rounded-3xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-xl transition-all duration-300 overflow-hidden"
                >
                  <Link
                    href={`/catalog/${p.slug}`}
                    className="relative w-full pt-[85%] bg-slate-100 overflow-hidden block"
                  >
                    <Image
                      src={imageUrl}
                      alt={p.title}
                      fill
                      className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  </Link>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {p.rating?.average > 0 && (
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold mb-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{p.rating.average}</span>
                        </div>
                      )}
                      <Link
                        href={`/catalog/${p.slug}`}
                        className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 line-clamp-2 transition-colors"
                      >
                        {p.title}
                      </Link>
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                      <span className="text-base font-extrabold text-slate-900">
                        ₹{p.basePrice.toLocaleString('en-IN')}
                      </span>

                      <button
                        onClick={() => handleQuickAdd(p)}
                        disabled={isAdding}
                        className={`p-2.5 rounded-xl transition shadow-sm ${
                          isAdding
                            ? 'bg-emerald-700 text-white'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                        }`}
                        aria-label="Add to cart"
                      >
                        {isAdding ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <ShoppingBag className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
