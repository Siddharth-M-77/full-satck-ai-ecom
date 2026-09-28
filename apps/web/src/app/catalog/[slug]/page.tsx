'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { useCartStore } from '../../../stores/cart.store';
import {
  Star,
  Check,
  ShoppingBag,
  Zap,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Minus,
  Plus,
} from 'lucide-react';

interface ProductDetail {
  _id: string;
  title: string;
  slug: string;
  description: string;
  bulletPoints: string[];
  basePrice: number;
  compareAtPrice?: number;
  categoryId: { _id: string; name: string; slug: string };
  brandId?: { _id: string; name: string; slug: string; logo?: { url: string } };
  rating: { average: number; count: number };
  variants: Array<{
    sku: string;
    attributes: Record<string, string>;
    price: number;
    compareAtPrice?: number;
    stock: number;
    images: Array<{ url: string; isPrimary?: boolean }>;
  }>;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { addItem } = useCartStore();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; data: ProductDetail }>(
        `/catalog/products/${slug}`
      );
      setProduct(res.data);
    } catch {
      // 404 or server error
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          The item you are searching for might have moved or is unavailable.
        </p>
        <Link
          href="/catalog"
          className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const activeVariant = product.variants[selectedVariantIndex] || product.variants[0];
  const allImages =
    activeVariant?.images?.length > 0
      ? activeVariant.images
      : [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80' }];
  const mainImage = allImages[selectedImageIndex] || allImages[0];

  const currentPrice = activeVariant?.price || product.basePrice;
  const comparePrice = activeVariant?.compareAtPrice || product.compareAtPrice;
  const discountPercent = comparePrice
    ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100)
    : 0;

  const handleAddToCart = async () => {
    if (!activeVariant) return;
    try {
      await addItem(product._id, activeVariant.sku, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleBuyNow = async () => {
    if (!activeVariant) return;
    try {
      await addItem(product._id, activeVariant.sku, quantity);
      router.push('/cart');
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <Link href="/" className="hover:text-emerald-600 transition">
          Home
        </Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-emerald-600 transition">
          Catalog
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium truncate max-w-xs">
          {product.title}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="relative w-full pt-[95%] bg-slate-100 rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm">
            <Image
              src={mainImage.url}
              alt={product.title}
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {discountPercent > 0 && (
              <span className="absolute top-4 left-4 px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md">
                {discountPercent}% OFF
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto py-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition ${
                    selectedImageIndex === idx
                      ? 'border-emerald-600 shadow-sm'
                      : 'border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Purchase Form */}
        <div className="flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  {product.categoryId?.name}
                </span>
                {product.rating?.count > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{product.rating.average}</span>
                    <span className="text-amber-500 font-normal">
                      ({product.rating.count} reviews)
                    </span>
                  </div>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {product.title}
              </h1>

              {product.brandId && (
                <p className="text-xs text-slate-500 mt-1">
                  Brand: <span className="font-semibold text-slate-800">{product.brandId.name}</span>
                </p>
              )}
            </div>

            {/* Pricing Section */}
            <div className="flex items-baseline gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-3xl font-extrabold text-slate-900">
                ₹{currentPrice.toLocaleString('en-IN')}
              </span>
              {comparePrice && (
                <span className="text-base text-slate-400 line-through">
                  ₹{comparePrice.toLocaleString('en-IN')}
                </span>
              )}
              {comparePrice && comparePrice > currentPrice && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  Save ₹{(comparePrice - currentPrice).toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* Variant Selector */}
            {product.variants.length > 1 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Option
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v, i) => {
                    const attrLabel = Object.values(v.attributes || {}).join(' / ') || v.sku;
                    const isSelected = selectedVariantIndex === i;

                    return (
                      <button
                        key={v.sku}
                        onClick={() => {
                          setSelectedVariantIndex(i);
                          setSelectedImageIndex(0);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {attrLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock status & quantity */}
            <div className="flex items-center gap-6 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Quantity
                </label>
                <div className="flex items-center border border-slate-200 rounded-xl bg-white">
                  <button
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-slate-900">
                    {quantity}
                  </span>
                  <button
                    disabled={activeVariant && quantity >= activeVariant.stock}
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Availability
                </label>
                {activeVariant && activeVariant.stock > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check className="w-3.5 h-3.5" />
                    In Stock ({activeVariant.stock} units)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200">
                    Out of Stock
                  </span>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={handleAddToCart}
                disabled={!activeVariant || activeVariant.stock === 0}
                className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 ${
                  added
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                } disabled:opacity-50`}
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" />
                    Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    Add to Cart
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={!activeVariant || activeVariant.stock === 0}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-emerald-400" />
                Buy Now
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2 pt-6 border-t border-slate-100 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Truck className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-slate-800">Free Express</p>
                <p className="text-[10px] text-slate-400">On all orders &gt; ₹999</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-slate-800">Authentic</p>
                <p className="text-[10px] text-slate-400">100% Brand Guarantee</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <RotateCcw className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-slate-800">Easy Returns</p>
                <p className="text-[10px] text-slate-400">7-day hassle-free</p>
              </div>
            </div>

            {/* Bullet Highlights */}
            {product.bulletPoints?.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Key Highlights
                </h3>
                <ul className="space-y-1.5">
                  {product.bulletPoints.map((bp, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Product Description
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
