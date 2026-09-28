'use client';

import { useRef, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { discountPercent, inr, type RecentProduct } from '../../lib/catalog';

/** Horizontally scrolling row with snap points and arrow buttons on wider screens. */
export function Rail({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.8, behavior: 'smooth' });
  return <section>
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>{eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{eyebrow}</p>}<h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">{title}</h2></div>
      <div className="flex items-center gap-2">
        {action}
        <button onClick={() => scroll(-1)} aria-label="Scroll left" className="hidden size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-400 sm:grid"><ChevronLeft className="size-4" /></button>
        <button onClick={() => scroll(1)} aria-label="Scroll right" className="hidden size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-400 sm:grid"><ChevronRight className="size-4" /></button>
      </div>
    </div>
    <div ref={track} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 [&>*]:w-[46%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[30%] lg:[&>*]:w-[22%]">
      {children}
    </div>
  </section>;
}

export function RecentCard({ item }: { item: RecentProduct }) {
  const discount = discountPercent(item.basePrice, item.compareAtPrice);
  return <Link href={`/catalog/${item.slug}`} className="group block">
    <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100"><Image src={item.image} alt={item.title} fill sizes="(max-width: 640px) 46vw, 22vw" className="object-cover transition duration-500 group-hover:scale-105" />{discount > 0 && <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">−{discount}%</span>}</div>
    <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-900 group-hover:text-emerald-700">{item.title}</p>
    <p className="text-sm font-bold text-slate-700">{inr(item.basePrice)}</p>
  </Link>;
}
