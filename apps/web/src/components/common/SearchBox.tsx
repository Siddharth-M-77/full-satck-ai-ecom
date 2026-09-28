'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Clock, Loader2, Search, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { inr, primaryImage, type ProductSummary } from '../../lib/catalog';

const RECENT_SEARCHES = 'shopsense_recent_searches';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES) || '[]'); } catch { return []; } };
const saveRecent = (term: string) => { try { localStorage.setItem(RECENT_SEARCHES, JSON.stringify([term, ...readRecent().filter((item) => item !== term)].slice(0, 5))); } catch { /* storage unavailable */ } };

export function SearchBox({ autoFocus = false, onDone, className = '' }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => { setRecent(readRecent()); }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    // Debounce so we search once the shopper pauses, not on every keystroke.
    const timer = window.setTimeout(() => {
      apiFetch<{ data: { products: ProductSummary[] } }>(`/catalog/products?search=${encodeURIComponent(term)}&limit=6`)
        .then((res) => { setResults(res.data.products); setActive(-1); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (href: string) => { setOpen(false); onDone?.(); router.push(href); };
  const searchFor = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    saveRecent(clean);
    go(`/catalog?search=${encodeURIComponent(clean)}`);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (active >= 0 && results[active]) go(`/catalog/${results[active].slug}`);
    else searchFor(query);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((index) => Math.min(results.length - 1, index + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(-1, index - 1)); }
    if (event.key === 'Escape') setOpen(false);
  };

  const showRecent = open && query.trim().length < 2 && recent.length > 0;
  const showResults = open && query.trim().length >= 2;

  return <div ref={box} className={`relative ${className}`}>
    <form onSubmit={submit} role="search" className="flex items-center rounded-full border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-600/10">
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" /> : <Search className="size-4 shrink-0 text-slate-400" />}
      <input value={query} autoFocus={autoFocus} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} type="search" role="combobox" aria-autocomplete="list" placeholder="Search products, brands, categories…" aria-label="Search products" aria-controls={panelId} aria-expanded={open} className="w-full bg-transparent px-2.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
      {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid size-6 place-items-center rounded-full text-slate-400 hover:bg-slate-200"><X className="size-3.5" /></button>}
    </form>

    {(showRecent || showResults) && <div id={panelId} className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
      {showRecent && <div className="p-2">
        <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent searches</p>
        {recent.map((term) => <button key={term} onClick={() => searchFor(term)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Clock className="size-3.5 text-slate-400" />{term}</button>)}
      </div>}
      {showResults && <div className="p-2">
        {results.map((product, index) => <button key={product._id} onMouseEnter={() => setActive(index)} onClick={() => go(`/catalog/${product.slug}`)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${index === active ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
          <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-slate-100"><Image src={primaryImage(product)} alt="" fill sizes="44px" className="object-cover" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{product.title}</span><span className="block truncate text-[11px] text-slate-500">{product.brandId?.name || product.categoryId?.name}</span></span>
          <span className="shrink-0 text-sm font-bold text-slate-900">{inr(product.basePrice)}</span>
        </button>)}
        {!loading && results.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No products match “{query.trim()}”.</p>}
        <button onClick={() => searchFor(query)} className="mt-1 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">See all results for “{query.trim()}”<ArrowUpRight className="size-4" /></button>
      </div>}
    </div>}
  </div>;
}
