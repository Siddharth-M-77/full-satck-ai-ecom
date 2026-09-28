import { useEffect, useState } from 'react';
import { CircleCheck, CreditCard, Download, MapPin, Truck, User, X } from 'lucide-react';
import { adminFetch } from '../lib/api';
import { money, statusLabel } from './charts';

type Address = Record<string, string | undefined>;
type OrderDetailData = {
  _id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  paymentMethod?: string;
  items: Array<{ sku: string; title: string; quantity: number; unitPrice: number; subtotal: number; image?: string; variantAttributes?: Record<string, string> }>;
  pricing: { itemsTotal: number; discountTotal: number; shippingFee: number; taxTotal: number; grandTotal: number };
  shippingAddress?: Address;
  billingAddress?: Address;
  statusHistory: Array<{ status: string; timestamp: string; comment?: string; updatedBy?: { name?: string; email?: string } | string }>;
  fulfillment?: { trackingNumber?: string; carrier?: string; shippedAt?: string; deliveredAt?: string };
  cancellationReason?: string;
  customer?: { name: string; email: string; phone?: string; isBlocked: boolean; createdAt: string } | null;
  payment?: { razorpayOrderId: string; razorpayPaymentId?: string; amount: number; status: string; method?: string; refunds: Array<{ refundId: string; amount: number; status: string; createdAt: string }> } | null;
};

type Props = {
  orderId: string | null;
  reloadKey: number;
  onClose: () => void;
  onInvoice: (order: { _id: string; orderNumber: string }) => void;
};

const formatDate = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const addressLines = (address?: Address) => address ? [
  address.fullName,
  address.addressLine1 || address.street,
  address.addressLine2,
  [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
  address.country,
  address.phone && `Phone: ${address.phone}`,
].filter(Boolean) as string[] : [];

export function OrderDetail({ orderId, reloadKey, onClose, onInvoice }: Props) {
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) { setOrder(null); return; }
    let cancelled = false;
    setError('');
    adminFetch(`/admin/orders/${orderId}`)
      .then((result) => { if (!cancelled) setOrder(result.data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load order'); });
    return () => { cancelled = true; };
  }, [orderId, reloadKey]);

  useEffect(() => {
    if (!orderId) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orderId, onClose]);

  if (!orderId) return null;
  const invoiceReady = order && !['PENDING_PAYMENT', 'CANCELLED'].includes(order.status);

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-label="Order detail" className="flex h-full w-full max-w-2xl flex-col bg-[#f4f6f3] shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase text-emerald-800">Order</p><h2 className="truncate font-serif text-xl font-bold text-slate-950">{order?.orderNumber || 'Loading…'}</h2></div>
        <div className="flex items-center gap-2">
          {invoiceReady && <button onClick={() => order && onInvoice(order)} className="btn-secondary"><Download className="size-3.5" /><span className="hidden sm:inline">Invoice</span></button>}
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center hover:bg-slate-100"><X className="size-4" /></button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {error && <p role="alert" className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {!order && !error && <p className="text-sm text-slate-500">Loading order…</p>}
        {order && <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Status', statusLabel(order.status)],
              ['Placed', new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })],
              ['Items', String(order.items.reduce((sum, item) => sum + item.quantity, 0))],
              ['Total', money(order.pricing.grandTotal)],
            ].map(([label, value]) => <div key={label} className="card p-3"><p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-bold text-slate-950">{value}</p></div>)}
          </section>

          <section className="card overflow-hidden">
            <h3 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase text-slate-700">Items</h3>
            <ul className="divide-y divide-slate-200">{order.items.map((item) => <li key={item.sku} className="flex items-center gap-3 px-4 py-3 text-xs">
              {item.image ? <img src={item.image} alt="" className="size-12 shrink-0 border border-slate-200 object-cover" /> : <div className="size-12 shrink-0 border border-slate-200 bg-slate-50" />}
              <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{item.title}</p><p className="truncate text-[11px] text-slate-500"><span className="font-mono">{item.sku}</span>{item.variantAttributes && Object.keys(item.variantAttributes).length ? ` · ${Object.values(item.variantAttributes).join(' / ')}` : ''}</p></div>
              <div className="shrink-0 text-right"><p className="font-semibold">{money(item.subtotal)}</p><p className="text-[11px] text-slate-500">{item.quantity} × {money(item.unitPrice)}</p></div>
            </li>)}</ul>
            <dl className="space-y-1.5 border-t border-slate-200 px-4 py-3 text-xs">
              {[
                ['Items total', money(order.pricing.itemsTotal)],
                ...(order.pricing.discountTotal ? [['Discount', `− ${money(order.pricing.discountTotal)}`]] : []),
                ['Shipping', order.pricing.shippingFee ? money(order.pricing.shippingFee) : 'Free'],
                ['Tax', money(order.pricing.taxTotal)],
              ].map(([label, value]) => <div key={label} className="flex justify-between text-slate-600"><dt>{label}</dt><dd>{value}</dd></div>)}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-950"><dt>Grand total</dt><dd>{money(order.pricing.grandTotal)}</dd></div>
            </dl>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="card p-4 text-xs">
              <h3 className="mb-2 flex items-center gap-2 font-bold uppercase text-slate-700"><User className="size-3.5" />Customer</h3>
              {order.customer ? <>
                <p className="font-semibold text-slate-900">{order.customer.name}{order.customer.isBlocked && <span className="ml-2 border border-rose-200 px-1.5 py-0.5 text-[9px] text-rose-700">BLOCKED</span>}</p>
                <p className="text-slate-600">{order.customer.email}</p>
                {order.customer.phone && <p className="text-slate-600">{order.customer.phone}</p>}
                <p className="mt-1 text-slate-400">Customer since {new Date(order.customer.createdAt).toLocaleDateString('en-IN')}</p>
              </> : <p className="text-slate-500">Account no longer exists.</p>}
            </section>
            <section className="card p-4 text-xs">
              <h3 className="mb-2 flex items-center gap-2 font-bold uppercase text-slate-700"><MapPin className="size-3.5" />Ship to</h3>
              {addressLines(order.shippingAddress).map((line) => <p key={line} className="text-slate-700">{line}</p>)}
              {!addressLines(order.shippingAddress).length && <p className="text-slate-500">No address recorded.</p>}
            </section>
            <section className="card p-4 text-xs">
              <h3 className="mb-2 flex items-center gap-2 font-bold uppercase text-slate-700"><CreditCard className="size-3.5" />Payment</h3>
              {order.payment ? <>
                <p className="text-slate-700">Status: <strong>{statusLabel(order.payment.status)}</strong>{order.payment.method ? ` · ${order.payment.method}` : ''}</p>
                <p className="text-slate-700">Amount: <strong>{money(order.payment.amount / 100)}</strong></p>
                {order.payment.razorpayPaymentId && <p className="truncate font-mono text-[10px] text-slate-500">{order.payment.razorpayPaymentId}</p>}
                {order.payment.refunds.map((refund) => <p key={refund.refundId} className="mt-1 text-rose-700">Refund {money(refund.amount / 100)} · {refund.status}</p>)}
              </> : <p className="text-slate-500">No payment attempt recorded.</p>}
            </section>
            <section className="card p-4 text-xs">
              <h3 className="mb-2 flex items-center gap-2 font-bold uppercase text-slate-700"><Truck className="size-3.5" />Fulfillment</h3>
              {order.fulfillment?.trackingNumber ? <>
                <p className="text-slate-700">{order.fulfillment.carrier || 'Carrier'} · <span className="font-mono">{order.fulfillment.trackingNumber}</span></p>
                <p className="text-slate-500">Shipped {formatDate(order.fulfillment.shippedAt)}</p>
                {order.fulfillment.deliveredAt && <p className="text-slate-500">Delivered {formatDate(order.fulfillment.deliveredAt)}</p>}
              </> : <p className="text-slate-500">Not shipped yet.</p>}
              {order.cancellationReason && <p className="mt-1 text-rose-700">Cancelled: {order.cancellationReason}</p>}
            </section>
          </div>

          <section className="card p-4">
            <h3 className="mb-3 text-xs font-bold uppercase text-slate-700">Timeline</h3>
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {[...order.statusHistory].reverse().map((entry, index) => {
                const actor = typeof entry.updatedBy === 'object' ? entry.updatedBy : undefined;
                return <li key={`${entry.status}-${entry.timestamp}-${index}`} className="text-xs">
                  <span className={`absolute -left-[7px] mt-0.5 grid size-3.5 place-items-center rounded-full ${index === 0 ? 'bg-emerald-700' : 'bg-slate-300'}`}>{index === 0 && <CircleCheck className="size-2.5 text-white" />}</span>
                  <p className="font-semibold text-slate-900">{statusLabel(entry.status)} <span className="font-normal text-slate-400">· {formatDate(entry.timestamp)}</span></p>
                  {entry.comment && <p className="text-slate-600">{entry.comment}</p>}
                  {actor && <p className="text-slate-400">by {actor.name || actor.email}</p>}
                </li>;
              })}
              {!order.statusHistory.length && <li className="text-xs text-slate-500">No status changes recorded.</li>}
            </ol>
          </section>
        </>}
      </div>
    </aside>
  </div>;
}
