'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Box, ChevronLeft, Clock3, Download, FileText, RefreshCw, ShoppingBag } from 'lucide-react';
import { apiDownload, apiFetch } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

interface CustomerOrder {
  _id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  items: Array<{
    title: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    image?: string;
  }>;
  pricing: {
    itemsTotal: number;
    discountTotal: number;
    shippingFee: number;
    taxTotal: number;
    grandTotal: number;
  };
}

const invoiceStatuses = new Set(['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUND_REQUESTED', 'REFUNDED']);
const statusStyle: Record<string, string> = {
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  PROCESSING: 'border-sky-200 bg-sky-50 text-sky-800',
  SHIPPED: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  DELIVERED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  PENDING_PAYMENT: 'border-amber-200 bg-amber-50 text-amber-800',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-600',
  REFUNDED: 'border-rose-200 bg-rose-50 text-rose-800',
  REFUND_REQUESTED: 'border-amber-200 bg-amber-50 text-amber-800',
};

function formatMoney(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function MyOrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [authHydrated, setAuthHydrated] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingOrder, setDownloadingOrder] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<{ success: boolean; data: CustomerOrder[] }>('/orders');
      setOrders(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const markHydrated = () => setAuthHydrated(true);
    const unsubscribe = useAuthStore.persist.onFinishHydration(markHydrated);
    if (useAuthStore.persist.hasHydrated()) markHydrated();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    if (!isAuthenticated) {
      router.replace('/login?redirect=/account/orders');
      return;
    }
    void fetchOrders();
  }, [authHydrated, isAuthenticated, router, fetchOrders]);

  const downloadInvoice = async (order: CustomerOrder) => {
    setDownloadingOrder(order._id);
    setError('');
    try {
      await apiDownload(`/orders/${order._id}/invoice`, `${order.orderNumber}-invoice.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invoice download failed.');
    } finally {
      setDownloadingOrder(null);
    }
  };

  if (!authHydrated || !isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/account" className="mb-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-800">
        <ChevronLeft className="size-4" /> Account
      </Link>

      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase text-emerald-800">Your ShopSense account</p>
          <h1 className="font-serif text-3xl font-bold text-slate-950">My orders</h1>
          <p className="mt-1 text-sm text-slate-500">Order history, delivery progress and downloadable invoices.</p>
        </div>
        <button type="button" onClick={() => void fetchOrders()} disabled={loading} className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-500 disabled:opacity-50">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh orders
        </button>
      </header>

      {error && <div role="alert" className="mb-5 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      {loading ? (
        <div className="grid min-h-64 place-items-center text-sm text-slate-500" role="status">
          <span className="inline-flex items-center gap-2"><RefreshCw className="size-4 animate-spin" /> Loading your orders</span>
        </div>
      ) : orders.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center border-y border-slate-200 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-800"><ShoppingBag className="size-6" /></span>
          <h2 className="mt-4 font-serif text-xl font-bold text-slate-950">No orders yet</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Once you place an order, its status and invoice will be available here.</p>
          <Link href="/catalog" className="mt-5 inline-flex items-center gap-2 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Explore the catalog <ArrowRight className="size-4" /></Link>
        </section>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const canDownload = invoiceStatuses.has(order.status);
            const firstItem = order.items[0];
            const otherItems = Math.max(0, order.items.length - 1);

            return (
              <article key={order._id} className="border border-slate-200 bg-white">
                <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap gap-x-7 gap-y-2 text-xs">
                    <div><p className="text-[9px] font-bold uppercase text-slate-500">Order placed</p><p className="mt-0.5 font-semibold text-slate-900">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
                    <div><p className="text-[9px] font-bold uppercase text-slate-500">Order number</p><p className="mt-0.5 font-semibold text-slate-900">{order.orderNumber}</p></div>
                    <div><p className="text-[9px] font-bold uppercase text-slate-500">Total</p><p className="mt-0.5 font-semibold text-slate-900">{formatMoney(order.pricing.grandTotal)}</p></div>
                    <div><p className="text-[9px] font-bold uppercase text-slate-500">Payment</p><p className="mt-0.5 font-semibold text-slate-900">{order.paymentMethod}</p></div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold ${statusStyle[order.status] || 'border-slate-200 bg-white text-slate-700'}`}>
                    {order.status === 'PENDING_PAYMENT' ? <Clock3 className="size-3" /> : <Box className="size-3" />}
                    {order.status.replaceAll('_', ' ')}
                  </span>
                </header>

                <div className="flex flex-col justify-between gap-5 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 items-center gap-4">
                    {firstItem?.image ? (
                      <div className="relative size-16 shrink-0 overflow-hidden bg-slate-100 sm:size-20">
                        <Image src={firstItem.image} alt={firstItem.title} fill sizes="80px" className="object-cover" />
                      </div>
                    ) : <div className="grid size-16 shrink-0 place-items-center bg-slate-100 text-slate-400 sm:size-20"><Box className="size-6" /></div>}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-950">{firstItem?.title || 'Order items'}</p>
                      {firstItem && <p className="mt-1 text-xs text-slate-500">Qty {firstItem.quantity} · SKU {firstItem.sku}</p>}
                      {otherItems > 0 && <p className="mt-1 text-xs font-medium text-slate-500">+ {otherItems} more {otherItems === 1 ? 'item' : 'items'}</p>}
                      <p className="mt-1 text-xs font-bold text-slate-800">{formatMoney(order.pricing.grandTotal)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Link href={`/orders/${order._id}`} className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-500">
                      View order <ArrowRight className="size-3.5" />
                    </Link>
                    <button type="button" onClick={() => void downloadInvoice(order)} disabled={!canDownload || downloadingOrder === order._id} title={canDownload ? 'Download invoice PDF' : 'Invoice available after payment confirmation'} className="inline-flex items-center gap-2 bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
                      <Download className="size-3.5" />
                      {downloadingOrder === order._id ? 'Preparing…' : canDownload ? 'Invoice PDF' : 'Invoice after payment'}
                    </button>
                  </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-[10px] text-slate-500 sm:px-5">
                  <span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'} in this order</span>
                  <Link href={`/orders/${order._id}`} className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"><FileText className="size-3" />Full order summary</Link>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}