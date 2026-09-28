'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { inr, type ProductSummary } from '../../lib/catalog';
import { ProductCard, ProductCardSkeleton } from '../../components/product/ProductCard';

type Facet = { _id: string; name: string; slug: string };
type Filters = { search: string; category: string; brand: string; minPrice: string; maxPrice: string; rating: string; inStock: boolean; sort: string; page: number };

const sortOptions = [
  ['newest', 'Newest first'],
  ['popular', 'Most popular'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
] as const;
const pricePresets: Array<[string, string, string]> = [['', '999', 'Under ₹999'], ['1000', '4999', '₹1,000 – ₹4,999'], ['5000', '19999', '₹5,000 – ₹19,999'], ['20000', '', '₹20,000+']];
const PAGE_SIZE = 12;

function readFilters(params: URLSearchParams): Filters {
  return {
    search: params.get('search') || '',
    category: params.get('category') || '',
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    rating: params.get('rating') || '',
    inStock: params.get('inStock') === 'true',
    sort: params.get('sort') || 'newest',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

function toQuery(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.minPrice) params.set('minPrice', filters.minPrice);
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
  if (filters.rating) params.set('rating', filters.rating);
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

export default function CatalogPage() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10"><div className="grid grid-cols-2 gap-6 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}</div></div>}><Catalog /></Suspense>;
}

function Catalog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Facet[]>([]);
  const [brands, setBrands] = useState<Facet[]>([]);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [priceDraft, setPriceDraft] = useState({ min: filters.minPrice, max: filters.maxPrice });
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = (changes: Partial<Filters>) => {
    // Any filter change starts again from page one unless the page itself is what changed.
    const next = { ...filters, page: 1, ...changes };
    const query = toQuery(next).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    if (changes.page) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    Promise.all([apiFetch<{ data: Facet[] }>('/catalog/categories'), apiFetch<{ data: Facet[] }>('/catalog/brands')])
      .then(([categoryRes, brandRes]) => { setCategories(categoryRes.data); setBrands(brandRes.data); })
      .catch(() => undefined);
    try { if (localStorage.getItem('shopsense_catalog_layout') === 'list') setLayout('list'); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => { setSearchDraft(filters.search); setPriceDraft({ min: filters.minPrice, max: filters.maxPrice }); }, [filters.search, filters.minPrice, filters.maxPrice]);

  // Search as you type, once typing pauses.
  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = window.setTimeout(() => update({ search: searchDraft.trim() }), 400);
    return () => window.clearTimeout(timer);
    // Only the draft should restart the debounce; `update` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = toQuery(filters);
    params.set('limit', String(PAGE_SIZE));
    params.set('page', String(filters.page));
    params.set('sort', filters.sort);
    apiFetch<{ data: { products: ProductSummary[]; pagination: { total: number; totalPages: number } } }>(`/catalog/products?${params}`)
      .then((res) => { if (cancelled) return; setProducts(res.data.products); setTotal(res.data.pagination.total); setTotalPages(Math.max(1, res.data.pagination.totalPages)); })
      .catch(() => { if (!cancelled) { setProducts([]); setTotal(0); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => {
    document.body.style.overflow = filtersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [filtersOpen]);

  const setLayoutPersisted = (value: 'grid' | 'list') => {
    setLayout(value);
    try { localStorage.setItem('shopsense_catalog_layout', value); } catch { /* storage unavailable */ }
  };

  const categoryName = categories.find((item) => item.slug === filters.category)?.name;
  const brandName = brands.find((item) => item.slug === filters.brand)?.name;
  const chips = [
    filters.search && { label: `“${filters.search}”`, clear: { search: '' } },
    filters.category && { label: categoryName || filters.category, clear: { category: '' } },
    filters.brand && { label: brandName || filters.brand, clear: { brand: '' } },
    (filters.minPrice || filters.maxPrice) && { label: filters.minPrice && filters.maxPrice ? `${inr(Number(filters.minPrice))} – ${inr(Number(filters.maxPrice))}` : filters.minPrice ? `Over ${inr(Number(filters.minPrice))}` : `Under ${inr(Number(filters.maxPrice))}`, clear: { minPrice: '', maxPrice: '' } },
    filters.rating && { label: `${filters.rating}★ & up`, clear: { rating: '' } },
    filters.inStock && { label: 'In stock', clear: { inStock: false } },
  ].filter(Boolean) as Array<{ label: string; clear: Partial<Filters> }>;
  const clearAll = () => update({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', rating: '', inStock: false });

  const filterPanel = <div className="space-y-7">
    <FilterGroup title="Category">
      <div className="space-y-0.5">
        {[{ _id: 'all', name: 'All categories', slug: '' }, ...categories].map((category) => <button key={category._id} onClick={() => update({ category: category.slug })} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition ${filters.category === category.slug ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}>{category.name}{filters.category === category.slug && <span className="size-1.5 rounded-full bg-emerald-600" />}</button>)}
      </div>
    </FilterGroup>

    {brands.length > 0 && <FilterGroup title="Brand">
      <div className="flex flex-wrap gap-1.5">{brands.map((brand) => <button key={brand._id} onClick={() => update({ brand: filters.brand === brand.slug ? '' : brand.slug })} aria-pressed={filters.brand === brand.slug} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filters.brand === brand.slug ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}>{brand.name}</button>)}</div>
    </FilterGroup>}

    <FilterGroup title="Price">
      <div className="space-y-1">{pricePresets.map(([min, max, label]) => { const active = filters.minPrice === min && filters.maxPrice === max; return <label key={label} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><input type="radio" name="price" checked={active} onChange={() => update({ minPrice: min, maxPrice: max })} className="size-4 accent-emerald-700" />{label}</label>; })}</div>
      <form onSubmit={(event) => { event.preventDefault(); update({ minPrice: priceDraft.min, maxPrice: priceDraft.max }); }} className="mt-3 flex items-center gap-2">
        <input type="number" min="0" inputMode="numeric" placeholder="Min" value={priceDraft.min} onChange={(event) => setPriceDraft((draft) => ({ ...draft, min: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-emerald-600" />
        <span className="text-slate-400">–</span>
        <input type="number" min="0" inputMode="numeric" placeholder="Max" value={priceDraft.max} onChange={(event) => setPriceDraft((draft) => ({ ...draft, max: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-emerald-600" />
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Go</button>
      </form>
    </FilterGroup>

    <FilterGroup title="Customer rating">
      <div className="space-y-1">{['4', '3'].map((value) => <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><input type="radio" name="rating" checked={filters.rating === value} onChange={() => update({ rating: value })} className="size-4 accent-emerald-700" /><span className="flex items-center gap-0.5">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`size-3.5 ${index < Number(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</span>& up</label>)}</div>
    </FilterGroup>

    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-800">
      In stock only
      <span className="relative inline-flex"><input type="checkbox" checked={filters.inStock} onChange={(event) => update({ inStock: event.target.checked })} className="peer sr-only" /><span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-emerald-600" /><span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" /></span>
    </label>
  </div>;

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{brandName ? 'Brand' : categoryName ? 'Category' : 'Catalog'}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{filters.search ? `Results for “${filters.search}”` : brandName || categoryName || 'All products'}</h1>
        <p className="mt-1 text-sm text-slate-500">{loading ? 'Finding products…' : `${total} product${total === 1 ? '' : 's'}`}</p>
      </div>
      <div className="flex w-full items-center rounded-full border border-slate-200 bg-white px-3.5 transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-600/10 md:w-80">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} type="search" placeholder="Search in catalog" aria-label="Search in catalog" className="w-full bg-transparent px-2.5 py-2.5 text-sm outline-none" />
      </div>
    </header>

    {categories.length > 0 && <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-4 sm:mx-0 sm:px-0">
      {[{ _id: 'all', name: 'All', slug: '' }, ...categories].map((category) => <button key={category._id} onClick={() => update({ category: category.slug })} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${filters.category === category.slug ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{category.name}</button>)}
    </div>}

    <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden lg:block"><div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 no-scrollbar">{filterPanel}</div></aside>

      <main className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setFiltersOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 lg:hidden"><SlidersHorizontal className="size-3.5" />Filters{chips.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-[10px] text-white">{chips.length}</span>}</button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {chips.map((chip) => <button key={chip.label} onClick={() => update(chip.clear)} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100">{chip.label}<X className="size-3" /></button>)}
            {chips.length > 1 && <button onClick={clearAll} className="px-2 text-xs font-semibold text-slate-500 underline-offset-2 hover:underline">Clear all</button>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select value={filters.sort} onChange={(event) => update({ sort: event.target.value })} aria-label="Sort products" className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600">{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <div className="hidden rounded-full border border-slate-200 bg-white p-0.5 sm:flex" role="group" aria-label="Layout">
              <button onClick={() => setLayoutPersisted('grid')} aria-pressed={layout === 'grid'} aria-label="Grid view" className={`grid size-8 place-items-center rounded-full transition ${layout === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}><LayoutGrid className="size-3.5" /></button>
              <button onClick={() => setLayoutPersisted('list')} aria-pressed={layout === 'list'} aria-label="List view" className={`grid size-8 place-items-center rounded-full transition ${layout === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}><List className="size-3.5" /></button>
            </div>
          </div>
        </div>

        {loading
          ? <div className={layout === 'grid' ? 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3' : 'space-y-3'}>{Array.from({ length: 6 }, (_, index) => <ProductCardSkeleton key={index} layout={layout} />)}</div>
          : products.length === 0
            ? <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-20 text-center">
                <Search className="mx-auto size-10 text-slate-300" />
                <h2 className="mt-3 text-lg font-bold text-slate-900">No products match these filters</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Try removing a filter or searching for something broader.</p>
                {chips.length > 0 && <button onClick={clearAll} className="mt-5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Clear all filters</button>}
              </div>
            : <div className={layout === 'grid' ? 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3' : 'space-y-3'}>{products.map((product, index) => <ProductCard key={product._id} product={product} layout={layout} priority={index < 3} />)}</div>}

        {totalPages > 1 && !loading && <Pagination page={filters.page} totalPages={totalPages} onPage={(page) => update({ page })} />}
      </main>
    </div>

    {filtersOpen && <div className="fixed inset-0 z-[80] lg:hidden">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label="Filters" className="sheet-in absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-extrabold">Filters</h2><button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="grid size-9 place-items-center rounded-full hover:bg-slate-100"><X className="size-5" /></button></header>
        <div className="flex-1 overflow-y-auto p-5">{filterPanel}</div>
        <footer className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4"><button onClick={clearAll} className="rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-800">Clear all</button><button onClick={() => setFiltersOpen(false)} className="rounded-xl bg-slate-900 py-3 text-sm font-bold text-white">Show {total} results</button></footer>
      </section>
    </div>}
  </div>;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3>{children}</section>;
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  // Show first, last, and a window around the current page.
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((value) => value === 1 || value === totalPages || Math.abs(value - page) <= 1);
  return <nav className="mt-12 flex items-center justify-center gap-1.5" aria-label="Pagination">
    <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
    {pages.map((value, index) => <span key={value} className="flex items-center gap-1.5">
      {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
      <button onClick={() => onPage(value)} aria-current={value === page ? 'page' : undefined} className={`grid size-10 place-items-center rounded-full text-sm font-bold transition ${value === page ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>{value}</button>
    </span>)}
    <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page" className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-30"><ChevronRight className="size-4" /></button>
  </nav>;
}
