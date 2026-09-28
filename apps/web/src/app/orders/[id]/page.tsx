'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiDownload, apiFetch } from '../../../lib/api';
import {
  CheckCircle2,
  Package,
  MapPin,
  CreditCard,
  ArrowRight,
  Clock,
  Download,
  Sparkles,
} from 'lucide-react';

interface OrderDetail {
  _id: string;
  orderNumber: string;
  status: string;
  items: Array<{
    title: string;
    sku: string;
    unitPrice: number;
    quantity: number;
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
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  paymentMethod: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    comment?: string;
  }>;
  createdAt: string;
}

export default function OrderSuccessPage() {
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await apiFetch<{ success: boolean; data: OrderDetail }>(
        `/orders/${orderId}`
      );
      setOrder(res.data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const downloadInvoice = async () => {
    if (!order) return;
    setInvoiceLoading(true);
    setInvoiceError('');
    try {
      await apiDownload(`/orders/${order._id}/invoice`, `${order.orderNumber}-invoice.pdf`);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Invoice download failed');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const invoiceReady = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUND_REQUESTED', 'REFUNDED'].includes(order?.status || '');

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading order receipt...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">Order not found</h2>
        <Link
          href="/catalog"
          className="mt-4 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          Return to Store
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Success Badge Banner */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm animate-in zoom-in duration-300">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Thank you for your order!
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Order reference: <span className="font-bold text-slate-800">{order.orderNumber}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Status card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Order Status</span>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
            {order.status}
          </span>
        </div>

        {/* Payment Method */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Payment Method</span>
          </div>
          <p className="text-sm font-bold text-slate-900">{order.paymentMethod}</p>
        </div>

        {/* Destination */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Delivery To</span>
          </div>
          <p className="text-xs font-bold text-slate-900 truncate">
            {order.shippingAddress?.fullName}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {order.shippingAddress?.city}, {order.shippingAddress?.state}
          </p>
        </div>
      </div>

      {/* Items Summary Table */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6 mb-8">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600" />
          Package Items ({order.items.length})
        </h2>

        <div className="divide-y divide-slate-100">
          {order.items.map((i) => (
            <div key={i.sku} className="py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-slate-900 text-sm block">{i.title}</span>
                <span className="text-slate-400">SKU: {i.sku} • Qty: {i.quantity}</span>
              </div>
              <span className="text-sm font-extrabold text-slate-900">
                ₹{i.subtotal.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-900">
              ₹{order.pricing.itemsTotal.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{order.pricing.shippingFee === 0 ? 'FREE' : `₹${order.pricing.shippingFee}`}</span>
          </div>
          <div className="flex justify-between">
            <span>Estimated GST</span>
            <span>₹{order.pricing.taxTotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
            <span>Order total</span>
            <span>₹{order.pricing.grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {invoiceError && <p role="alert" className="mb-4 text-center text-sm text-rose-700">{invoiceError}</p>}
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={downloadInvoice}
          disabled={!invoiceReady || invoiceLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-4" />
          {invoiceLoading ? 'Preparing invoice…' : invoiceReady ? 'Download invoice PDF' : 'Invoice after payment confirmation'}
        </button>
        <Link
          href="/catalog"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
