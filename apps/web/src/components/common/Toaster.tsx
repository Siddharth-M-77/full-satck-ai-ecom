'use client';

import Link from 'next/link';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useToastStore } from '../../stores/toast.store';

const icons = {
  success: <CircleCheck className="size-5 shrink-0 text-emerald-400" />,
  error: <CircleAlert className="size-5 shrink-0 text-rose-400" />,
  info: <Info className="size-5 shrink-0 text-sky-300" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end">
    {toasts.map((item) => <div key={item.id} role={item.tone === 'error' ? 'alert' : 'status'} className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
      {icons[item.tone]}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs text-slate-300">{item.description}</p>}
        {item.action && <Link href={item.action.href} onClick={() => dismiss(item.id)} className="mt-1.5 inline-block text-xs font-bold text-emerald-300 hover:text-emerald-200">{item.action.label} →</Link>}
      </div>
      <button onClick={() => dismiss(item.id)} aria-label="Dismiss" className="grid size-6 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"><X className="size-3.5" /></button>
    </div>)}
  </div>;
}
