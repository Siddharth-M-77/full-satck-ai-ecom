import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';

export type Pagination = { page: number; limit: number; total: number; pages: number };
export const emptyPagination: Pagination = { page: 1, limit: 25, total: 0, pages: 1 };

export function Modal({ open, onClose, title, subtitle, wide = false, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; wide?: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 backdrop-blur-[2px] sm:place-items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className={`max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-7 ${wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-lg font-bold text-slate-950">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}</div>
        <button onClick={onClose} aria-label="Close" className="icon-btn"><X className="size-4" /></button>
      </header>
      {children}
    </section>
  </div>;
}

export function Field({ name, label, type = 'text', required = false, defaultValue = '', placeholder, min, step, hint }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string; min?: string; step?: string; hint?: string }) {
  return <label className="label">{label}{required && <span className="text-rose-600"> *</span>}
    <input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} min={min} step={step} className="input mt-1.5" />
    {hint && <span className="mt-1 block text-[10px] font-normal text-slate-400">{hint}</span>}
  </label>;
}

export function Pager({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  const { page, pages, total, limit } = pagination;
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500" aria-label="Pagination">
    <p>Showing <strong className="text-slate-900">{from}–{to}</strong> of <strong className="text-slate-900">{total}</strong></p>
    <div className="flex items-center gap-1">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="btn-secondary px-2.5 py-1.5"><ChevronLeft className="size-3.5" />Prev</button>
      <span className="px-2 tabular-nums">{page} / {Math.max(1, pages)}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages} className="btn-secondary px-2.5 py-1.5">Next<ChevronRight className="size-3.5" /></button>
    </div>
  </nav>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400"><Inbox className="size-5" /></span>
    <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
    {hint && <p className="mt-1 max-w-sm text-xs text-slate-500">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

const tones: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
  blue: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10',
};

export function Pill({ tone = 'slate', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`pill ${tones[tone]}`}>{children}</span>;
}

const orderTone: Record<string, keyof typeof tones> = {
  PENDING_PAYMENT: 'amber', PAID: 'blue', PROCESSING: 'violet', SHIPPED: 'blue',
  DELIVERED: 'green', CANCELLED: 'slate', REFUND_REQUESTED: 'amber', REFUNDED: 'red',
};
export const statusTone = (status: string) => orderTone[status] || 'slate';
