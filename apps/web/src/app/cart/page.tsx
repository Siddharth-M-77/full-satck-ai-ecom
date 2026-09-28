'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CircleAlert, Loader2, Lock, Minus, Plus, ShoppingBag, TicketPercent, Trash2, Truck, X } from 'lucide-react';
import { useCartStore, type CartItem } from '../../stores/cart.store';
import { errorMessage, toast } from '../../stores/toast.store';
import { discountPercent, FALLBACK_IMAGE, FREE_SHIPPING_THRESHOLD, inr } from '../../lib/catalog';
import { OfferTicket, useOffers } from '../../components/common/OffersStrip';

export default function CartPage() {
  const { items, pricing, appliedCoupon, couponError, fetchCart, updateQuantity, removeItem, applyCoupon, removeCoupon, loading, itemCount } = useCartStore();
  const offers = useOffers();
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [busySku, setBusySku] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { void fetchCart().finally(() => setLoaded(true)); }, [fetchCart]);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD + 1 - pricing.itemsTotal);
  const progress = Math.min(100, (pricing.itemsTotal / (FREE_SHIPPING_THRESHOLD + 1)) * 100);
  const savingsOnItems = items.reduce((sum, item) => sum + Math.max(0, (item.compareAtPrice || item.price) - item.price) * item.quantity, 0);
  const totalSavings = savingsOnItems + pricing.discountTotal;

  const submitCoupon = async (value: string) => {
    if (!value.trim()) return;
    setApplying(true);
    try {
      await applyCoupon(value.trim());
      setCode('');
      toast.success(`${value.trim().toUpperCase()} applied`, { description: 'Your discount is in the summary.' });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not apply coupon'));
    } finally {
      setApplying(false);
    }
  };

  const changeQuantity = async (item: CartItem, quantity: number) => {
    setBusySku(item.sku);
    try {
      if (quantity <= 0) {
        await removeItem(item.sku);
        toast.info('Removed from cart', { description: item.title });
      } else {
        await updateQuantity(item.sku, quantity);
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update cart'));
    } finally {
      setBusySku(null);
    }
  };

  if (!loaded && items.length === 0) return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-8 lg:grid-cols-[1fr_380px]"><div className="space-y-3">{[0, 1, 2].map((index) => <div key={index} className="h-32 animate-pulse rounded-3xl bg-slate-100" />)}</div><div className="h-80 animate-pulse rounded-3xl bg-slate-100" /></div></div>;

  if (items.length === 0) return <div className="mx-auto max-w-lg px-4 py-24 text-center">
    <div className="mx-auto grid size-24 place-items-center rounded-full bg-emerald-50"><ShoppingBag className="size-10 text-emerald-600" /></div>
    <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-950">Your cart is empty</h1>
    <p className="mt-2 text-sm text-slate-500">Browse the catalog and add things you love — they will wait for you here.</p>
    <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/catalog" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700">Start shopping <ArrowRight className="size-4" /></Link><Link href="/wishlist" className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 hover:border-slate-400">View wishlist</Link></div>
  </div>;

  return <div className="mx-auto max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8 lg:pb-10">
    <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Your cart <span className="text-lg font-semibold text-slate-400">({itemCount} item{itemCount === 1 ? '' : 's'})</span></h1>

    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className={`rounded-2xl border p-4 ${remaining === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Truck className={`size-4 ${remaining === 0 ? 'text-emerald-600' : 'text-slate-500'}`} />{remaining === 0 ? 'You have unlocked free delivery' : <>Add <strong className="text-emerald-700">{inr(remaining)}</strong> more for free delivery</>}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
        </div>

        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {items.map((item) => {
            const off = discountPercent(item.price, item.compareAtPrice);
            const busy = busySku === item.sku;
            return <li key={item._id || item.sku} className={`flex gap-4 p-4 transition sm:p-5 ${busy ? 'opacity-60' : ''}`}>
              <Link href={`/catalog/${item.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:size-28"><Image src={item.image || FALLBACK_IMAGE} alt={item.title} fill sizes="112px" className="object-cover" /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><Link href={`/catalog/${item.slug}`} className="line-clamp-2 text-sm font-bold text-slate-900 hover:text-emerald-700 sm:text-base">{item.title}</Link><p className="mt-0.5 text-xs text-slate-500">{Object.values(item.attributes || {}).join(' / ') || item.sku}</p></div>
                  <button onClick={() => void changeQuantity(item, 0)} disabled={busy} aria-label={`Remove ${item.title}`} className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></button>
                </div>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm"><span className="font-extrabold text-slate-950">{inr(item.price)}</span>{off > 0 && <><span className="text-xs text-slate-400 line-through">{inr(item.compareAtPrice)}</span><span className="text-xs font-bold text-emerald-700">{off}% off</span></>}</p>
                {item.stock <= 5 && <p className="mt-1 text-xs font-semibold text-amber-600">Only {item.stock} left in stock</p>}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-full border border-slate-200 bg-slate-50">
                    <button onClick={() => void changeQuantity(item, item.quantity - 1)} disabled={busy} aria-label="Decrease quantity" className="grid size-9 place-items-center text-slate-600 hover:text-slate-900">{item.quantity === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}</button>
                    <span className="w-8 text-center text-sm font-bold tabular-nums">{busy ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : item.quantity}</span>
                    <button onClick={() => void changeQuantity(item, item.quantity + 1)} disabled={busy || item.quantity >= item.stock} aria-label="Increase quantity" className="grid size-9 place-items-center text-slate-600 hover:text-slate-900 disabled:opacity-30"><Plus className="size-3.5" /></button>
                  </div>
                  <span className="text-base font-extrabold text-slate-950">{inr(item.subtotal)}</span>
                </div>
              </div>
            </li>;
          })}
        </ul>
        <Link href="/catalog" className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800">← Continue shopping</Link>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><TicketPercent className="size-4 text-emerald-600" />Coupons & offers</h2>
          {appliedCoupon
            ? <div className={`mt-3 flex items-center justify-between gap-3 rounded-2xl border p-3 ${couponError ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="min-w-0"><p className="font-mono text-sm font-bold tracking-wider text-slate-900">{appliedCoupon.code}</p><p className={`text-xs ${couponError ? 'text-amber-800' : 'text-emerald-800'}`}>{couponError || `You save ${inr(appliedCoupon.discountAmount)}`}</p></div>
                <button onClick={() => void removeCoupon().catch((err) => toast.error(errorMessage(err)))} aria-label="Remove coupon" className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-white"><X className="size-4" /></button>
              </div>
            : <form onSubmit={(event: FormEvent) => { event.preventDefault(); void submitCoupon(code); }} className="mt-3 flex gap-2">
                <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter coupon code" aria-label="Coupon code" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider outline-none placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-emerald-600" />
                <button disabled={applying || !code.trim()} className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">{applying ? <Loader2 className="size-4 animate-spin" /> : 'Apply'}</button>
              </form>}
          {couponError && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />The discount is paused until this is resolved.</p>}
          {offers.length > 0 && <div className="mt-4 space-y-2">{offers.slice(0, 3).map((offer) => <OfferTicket key={offer._id} offer={offer} applied={appliedCoupon?.code === offer.code && !couponError} onApply={(value) => void submitCoupon(value)} />)}</div>}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">Order summary</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600"><dt>Items ({itemCount})</dt><dd className="font-semibold text-slate-900">{inr(pricing.itemsTotal)}</dd></div>
            {pricing.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Coupon {appliedCoupon?.code}</dt><dd className="font-semibold">−{inr(pricing.discountTotal)}</dd></div>}
            <div className="flex justify-between text-slate-600"><dt>Delivery</dt><dd className={pricing.shippingFee === 0 ? 'font-bold text-emerald-700' : 'font-semibold text-slate-900'}>{pricing.shippingFee === 0 ? 'FREE' : inr(pricing.shippingFee)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>GST (18%)</dt><dd className="font-semibold text-slate-900">{inr(pricing.taxTotal)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-dashed border-slate-200 pt-3"><dt className="font-bold text-slate-900">Total</dt><dd className="text-2xl font-extrabold text-slate-950">{inr(pricing.grandTotal)}</dd></div>
          </dl>
          {totalSavings > 0 && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-800">You are saving {inr(totalSavings)} on this order</p>}
          <Link href="/checkout" className="mt-5 hidden items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 lg:flex"><Lock className="size-4" />Checkout securely<ArrowRight className="size-4" /></Link>
          <p className="mt-3 text-center text-[11px] text-slate-400">Payments processed securely by Razorpay</p>
        </section>
      </aside>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0"><p className="text-[11px] text-slate-500">Total{totalSavings > 0 ? ` · saving ${inr(totalSavings)}` : ''}</p><p className="text-lg font-extrabold">{inr(pricing.grandTotal)}</p></div>
        <Link href="/checkout" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-600/25">{loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Checkout</Link>
      </div>
    </div>
  </div>;
}
