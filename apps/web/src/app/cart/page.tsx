'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '../../stores/cart.store';
import {
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  ShieldCheck,
  Truck,
  Sparkles,
} from 'lucide-react';

export default function CartPage() {
  const { items, pricing, fetchCart, updateQuantity, removeItem, loading } = useCartStore();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const freeDeliveryThreshold = 999;
  const amountNeededForFreeDelivery = Math.max(
    0,
    freeDeliveryThreshold - pricing.itemsTotal
  );
  const deliveryProgress = Math.min(
    100,
    (pricing.itemsTotal / freeDeliveryThreshold) * 100
  );

  if (loading && items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading your cart...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Your Cart is Empty
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto mb-8">
          Explore our intelligent catalog or ask our AI Shopping Assistant to find perfect picks for you.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-md hover:from-emerald-500 hover:to-teal-500 transition shadow-emerald-600/20"
        >
          <span>Explore Catalog</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Shopping Cart ({items.reduce((acc, i) => acc + i.quantity, 0)})
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your items before proceeding to secure checkout
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Free delivery banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 mb-2">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                {amountNeededForFreeDelivery === 0
                  ? '🎉 You unlocked FREE Express Delivery!'
                  : `Add ₹${amountNeededForFreeDelivery.toLocaleString('en-IN')} more to unlock FREE Delivery`}
              </span>
              <span>{Math.round(deliveryProgress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-emerald-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${deliveryProgress}%` }}
              />
            </div>
          </div>

          {items.map((item) => {
            const attrLabel =
              Object.values(item.attributes || {}).join(' / ') || item.sku;

            return (
              <div
                key={item._id || item.sku}
                className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5 transition hover:border-slate-300"
              >
                {/* Product Image */}
                <Link
                  href={`/catalog/${item.slug}`}
                  className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0"
                >
                  <Image
                    src={
                      item.image ||
                      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'
                    }
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </Link>

                {/* Details */}
                <div className="flex-1">
                  <Link
                    href={`/catalog/${item.slug}`}
                    className="text-sm font-bold text-slate-900 hover:text-emerald-600 line-clamp-1 transition-colors"
                  >
                    {item.title}
                  </Link>

                  <p className="text-xs text-slate-500 mt-1">
                    Variant: <span className="font-medium text-slate-700">{attrLabel}</span>
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-sm font-extrabold text-slate-900">
                      ₹{item.price.toLocaleString('en-IN')}
                    </span>
                    {item.compareAtPrice && (
                      <span className="text-xs text-slate-400 line-through">
                        ₹{item.compareAtPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls & Delete */}
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
                    <button
                      onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                      className="p-2 text-slate-500 hover:text-slate-900 transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                      className="p-2 text-slate-500 hover:text-slate-900 transition"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-sm font-bold text-slate-900 sm:w-24 text-right">
                    ₹{item.subtotal.toLocaleString('en-IN')}
                  </span>

                  <button
                    onClick={() => removeItem(item.sku)}
                    className="p-2 text-slate-400 hover:text-red-600 transition"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary Checkout Card */}
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>

            <div className="space-y-3 text-xs text-slate-600 border-b border-slate-100 pb-4">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">
                  ₹{pricing.itemsTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shipping Fee</span>
                <span>
                  {pricing.shippingFee === 0 ? (
                    <span className="font-bold text-emerald-600">FREE</span>
                  ) : (
                    `₹${pricing.shippingFee}`
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimated GST (18%)</span>
                <span>₹{pricing.taxTotal.toLocaleString('en-IN')}</span>
              </div>
              {pricing.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Coupon Discount</span>
                  <span>-₹{pricing.discountTotal.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-bold text-slate-900">Grand Total</span>
              <span className="text-2xl font-extrabold text-slate-900">
                ₹{pricing.grandTotal.toLocaleString('en-IN')}
              </span>
            </div>

            <Link
              href="/checkout"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2 group text-center"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Safe & Secure 256-bit SSL Checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
