'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, TicketPercent } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { offerHeadline, offerTerms, type Offer } from '../../lib/catalog';
import { toast } from '../../stores/toast.store';

let cachedOffers: Offer[] | null = null;

/** Live offers the admin chose to advertise. Shared cache so the home page and cart fetch once. */
export function useOffers() {
  const [offers, setOffers] = useState<Offer[]>(cachedOffers || []);
  useEffect(() => {
    if (cachedOffers) return;
    apiFetch<{ data: Offer[] }>('/coupons/offers')
      .then((res) => { cachedOffers = res.data; setOffers(res.data); })
      .catch(() => setOffers([]));
  }, []);
  return offers;
}

export function OfferTicket({ offer, onApply, applied = false }: { offer: Offer; onApply?: (code: string) => void; applied?: boolean }) {
  const [copied, setCopied] = useState(false);
  const daysLeft = Math.ceil((new Date(offer.endDate).getTime() - Date.now()) / 86400000);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      toast.success(`${offer.code} copied`, { description: 'Paste it in your cart to save.' });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.info(`Use code ${offer.code} at checkout`);
    }
  };
  return <div className="relative flex min-w-0 items-stretch overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
    <div className="flex flex-1 items-center gap-3 p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><TicketPercent className="size-5" /></span>
      <div className="min-w-0"><p className="text-sm font-extrabold text-slate-950">{offerHeadline(offer)}</p><p className="truncate text-[11px] text-slate-600">{offerTerms(offer)}</p>{daysLeft <= 3 && <p className="text-[10px] font-bold text-rose-600">Ends in {daysLeft <= 1 ? 'less than a day' : `${daysLeft} days`}</p>}</div>
    </div>
    <div className="flex flex-col items-center justify-center gap-1 border-l border-dashed border-emerald-300 px-3.5">
      <span className="font-mono text-xs font-bold tracking-wider text-emerald-900">{offer.code}</span>
      {onApply
        ? <button onClick={() => onApply(offer.code)} disabled={applied} className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:bg-emerald-600">{applied ? 'Applied' : 'Apply'}</button>
        : <button onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">{copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? 'Copied' : 'Copy'}</button>}
    </div>
  </div>;
}
