'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { useCartStore } from '../../stores/cart.store';
import { useAuthStore } from '../../stores/auth.store';
import {
  Heart,
  Search,
  SlidersHorizontal,
  Star,
  ShoppingBag,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface ProductItem {
  _id: string;
  title: string;
  slug: string;
  description: string;
  basePrice: number;
  compareAtPrice?: number;
  categoryId: { _id: string; name: string; slug: string };
  brandId?: { _id: string; name: string; slug: string };
  rating: { average: number; count: number };
  variants: Array<{
    sku: string;
    price: number;
    compareAtPrice?: number;
    stock: number;
    images: Array<{ url: string }>;
  }>;
}

interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
}

export default function CatalogPage() {
  const router = useRouter();
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState<string>('newest');

  // Quick-add state tracking
  const [addingSku, setAddingSku] = useState<string | null>(null);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedProductIds([]);
      return;
    }

    apiFetch<{ data: { productIds: Array<{ _id: string }> } }>('/cart/wishlist')
      .then((res) => setSavedProductIds(res.data.productIds.map((product) => product._id)))
      .catch(() => setSavedProductIds([]));
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearch(params.get('search') || '');
    setSelectedCategory(params.get('category') || '');
    setSort(params.get('sort') || 'newest');
  }, []);

  const fetchCatalogData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '12');
      if (selectedCategory) params.set('category', selectedCategory);
      if (search) params.set('search', search);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (inStock) params.set('inStock', 'true');
      if (sort) params.set('sort', sort);

      const [prodRes, catRes] = await Promise.all([
        apiFetch<{
          success: boolean;
          data: {
            products: ProductItem[];
            pagination: { total: number; totalPages: number };
          };
        }>(`/catalog/products?${params.toString()}`),
        categories.length === 0
          ? apiFetch<{ success: boolean; data: CategoryItem[] }>('/catalog/categories')
          : Promise.resolve({ success: true, data: categories }),
      ]);

      setProducts(prodRes.data.products);
      setTotal(prodRes.data.pagination.total);
      setTotalPages(prodRes.data.pagination.totalPages);
      if (categories.length === 0) {
        setCategories(catRes.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [page, selectedCategory, search, minPrice, maxPrice, inStock, sort, categories]);

  useEffect(() => {
    fetchCatalogData();
  }, [fetchCatalogData]);

  const handleQuickAdd = async (product: ProductItem) => {
    const primaryVariant = product.variants?.[0];
    if (!primaryVariant) return;

    setAddingSku(primaryVariant.sku);
    try {
      await addItem(product._id, primaryVariant.sku, 1);
      setTimeout(() => setAddingSku(null), 1200);
    } catch (err: unknown) {
      setAddingSku(null);
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleSaveProduct = async (productId: string) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    setSavingProductId(productId);
    try {
      if (savedProductIds.includes(productId)) {
        await apiFetch(`/cart/wishlist/${productId}`, { method: 'DELETE' });
        setSavedProductIds((current) => current.filter((id) => id !== productId));
      } else {
        await apiFetch(`/cart/wishlist/${productId}`, { method: 'POST' });
        setSavedProductIds((current) => [...current, productId]);
      }
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setSavingProductId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Catalog Title Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Catalog & Products
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {total} items
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Discover curated apparel, gadgets, footwear, and workspace essentials
          </p>
        </div>

        {/* Search Bar */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search products, brands..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
          />
        </div>
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 no-scrollbar">
        <button
          onClick={() => {
            setSelectedCategory('');
            setPage(1);
          }}
          className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            selectedCategory === ''
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => {
              setSelectedCategory(cat.slug);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === cat.slug
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-4">
        {/* Left Filter Sidebar */}
        <aside className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                Refine Search
              </span>
              {(selectedCategory || minPrice || maxPrice || inStock || search) && (
                <button
                  onClick={() => {
                    setSelectedCategory('');
                    setMinPrice('');
                    setMaxPrice('');
                    setInStock(false);
                    setSearch('');
                    setPage(1);
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Price (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-emerald-500"
                />
                <span className="text-slate-400 text-xs">—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* In-stock Filter */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="stockCheck"
                checked={inStock}
                onChange={(e) => {
                  setInStock(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label
                htmlFor="stockCheck"
                className="text-xs text-slate-700 font-medium cursor-pointer"
              >
                In Stock Items Only
              </label>
            </div>

            {/* Sorting */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Sort By
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="newest">Newest Arrivals</option>
                <option value="popular">Most Popular</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="lg:col-span-3">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                No matching products found
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try loosening your filters or search for another keyword like &quot;kurta&quot;, &quot;airpods&quot;, or &quot;nike&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p) => {
                const primaryVariant = p.variants?.[0];
                const imageUrl =
                  primaryVariant?.images?.[0]?.url ||
                  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80';
                const discount = p.compareAtPrice
                  ? Math.round(
                      ((p.compareAtPrice - p.basePrice) / p.compareAtPrice) * 100
                    )
                  : 0;

                const isAdding = addingSku === primaryVariant?.sku;

                return (
                  <div
                    key={p._id}
                    className="group relative flex flex-col rounded-3xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-950/5 transition-all duration-300 overflow-hidden"
                  >
                    {/* Image Area */}
                    <Link
                      href={`/catalog/${p.slug}`}
                      className="relative w-full pt-[85%] bg-slate-100 overflow-hidden block"
                    >
                      <Image
                        src={imageUrl}
                        alt={p.title}
                        fill
                        className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {discount > 0 && (
                        <span className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] tracking-wide shadow-sm">
                          {discount}% OFF
                        </span>
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleSaveProduct(p._id)}
                      disabled={savingProductId === p._id}
                      aria-label={savedProductIds.includes(p._id) ? 'Remove from wishlist' : 'Save to wishlist'}
                      aria-pressed={savedProductIds.includes(p._id)}
                      title={savedProductIds.includes(p._id) ? 'Remove from wishlist' : 'Save to wishlist'}
                      className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition hover:text-rose-600 disabled:opacity-50"
                    >
                      <Heart className={`size-4 ${savedProductIds.includes(p._id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1">
                          <span>{p.categoryId?.name}</span>
                          {p.rating?.average > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {p.rating.average}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/catalog/${p.slug}`}
                          className="font-bold text-sm text-slate-900 group-hover:text-emerald-600 line-clamp-2 transition-colors"
                        >
                          {p.title}
                        </Link>
                      </div>

                      <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-extrabold text-slate-900">
                              ₹{p.basePrice.toLocaleString('en-IN')}
                            </span>
                            {p.compareAtPrice && (
                              <span className="text-xs text-slate-400 line-through">
                                ₹{p.compareAtPrice.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            Free Express Delivery
                          </span>
                        </div>

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
                            <Check className="w-4 h-4 animate-in zoom-in" />
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
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-10">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 transition"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>
              <span className="text-xs font-semibold text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 transition"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
