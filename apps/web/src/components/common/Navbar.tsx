'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Heart, LogOut, MapPin, Menu, ReceiptText, Search, ShoppingBag, Sparkles, Truck, User, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useCartStore } from '../../stores/cart.store';
import { useWishlistStore } from '../../stores/wishlist.store';
import { apiFetch } from '../../lib/api';
import { SearchBox } from './SearchBox';
import { useOffers } from './OffersStrip';
import { offerHeadline, FREE_SHIPPING_THRESHOLD, inr } from '../../lib/catalog';

const links = [
  { href: '/catalog', label: 'Shop all' },
  { href: '/catalog?sort=newest', label: 'New arrivals' },
  { href: '/catalog?sort=popular', label: 'Best sellers' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const { itemCount, fetchCart } = useCartStore();
  const wishlistCount = useWishlistStore((state) => state.ids.length);
  const loadWishlist = useWishlistStore((state) => state.load);
  const offers = useOffers();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [categories, setCategories] = useState<Array<{ _id: string; name: string; slug: string }>>([]);
  const account = useRef<HTMLDivElement>(null);

  useEffect(() => { void fetchCart(); }, [fetchCart]);
  useEffect(() => { if (isAuthenticated && user) void loadWishlist(user.id || user.email); }, [isAuthenticated, user, loadWishlist]);
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen || categories.length) return;
    apiFetch<{ data: Array<{ _id: string; name: string; slug: string }> }>('/catalog/categories').then((res) => setCategories(res.data)).catch(() => undefined);
  }, [menuOpen, categories.length]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (!account.current?.contains(event.target as Node)) setAccountOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const topOffer = offers[0];
  const signOut = () => { clearAuth(); setAccountOpen(false); setMenuOpen(false); };
  const iconButton = 'relative grid size-10 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-950';
  const badge = (count: number, tone: string) => count > 0 && <span className={`absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white ${tone}`}>{count > 99 ? '99+' : count}</span>;

  return <>
    <div className="bg-slate-950 px-4 py-2 text-center text-[11px] font-medium text-white sm:text-xs">
      {topOffer
        ? <Link href="/cart" className="inline-flex items-center gap-1.5 hover:text-emerald-300"><Sparkles className="size-3.5 text-emerald-400" /><span><strong>{offerHeadline(topOffer)}</strong> with code <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-bold">{topOffer.code}</span></span><ChevronRight className="size-3.5" /></Link>
        : <span className="inline-flex items-center gap-1.5"><Truck className="size-3.5 text-emerald-400" />Free delivery on orders over {inr(FREE_SHIPPING_THRESHOLD)}</span>}
    </div>

    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className={`${iconButton} lg:hidden`}><Menu className="size-5" /></button>

        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-800 text-white shadow-md shadow-emerald-700/20 transition group-hover:rotate-6"><Sparkles className="size-4" /></span>
          <span className="text-lg font-extrabold tracking-tight text-slate-950">ShopSense<span className="text-emerald-600">AI</span></span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((link) => <Link key={link.href} href={link.href} className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">{link.label}</Link>)}
        </nav>

        <SearchBox className="mx-auto hidden w-full max-w-md md:block" />

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 md:ml-0">
          <button onClick={() => setSearchOpen(true)} aria-label="Search" className={`${iconButton} md:hidden`}><Search className="size-5" /></button>
          <Link href="/wishlist" aria-label={`Wishlist, ${wishlistCount} items`} className={`${iconButton} hidden sm:grid`}><Heart className="size-5" />{badge(wishlistCount, 'bg-rose-500')}</Link>
          <Link href="/cart" aria-label={`Cart, ${itemCount} items`} className={iconButton}><ShoppingBag className="size-5" />{badge(itemCount, 'bg-emerald-600')}</Link>

          {isAuthenticated && user ? <div ref={account} className="relative ml-1">
            <button onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-1 text-sm shadow-sm transition hover:border-emerald-300 sm:pr-3">
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-xs font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
              <span className="hidden font-semibold text-slate-800 sm:inline">{user.name.split(' ')[0]}</span>
            </button>
            {accountOpen && <div className="pop-in absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white py-2 shadow-2xl shadow-slate-900/10">
              <div className="border-b border-slate-100 px-4 pb-3 pt-1"><p className="text-sm font-bold text-slate-900">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
              {[
                { href: '/account', label: 'Account & profile', icon: User },
                { href: '/account/orders', label: 'My orders', icon: ReceiptText },
                { href: '/wishlist', label: 'Wishlist', icon: Heart },
                { href: '/account#addresses', label: 'Saved addresses', icon: MapPin },
              ].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"><Icon className="size-4 text-slate-400" />{label}</Link>)}
              <button onClick={signOut} className="mt-1 flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50"><LogOut className="size-4" />Sign out</button>
            </div>}
          </div> : <div className="ml-1 flex items-center gap-1">
            <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex">Sign in</Link>
            <Link href="/register" className="rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:px-4 sm:text-sm">Join</Link>
          </div>}
        </div>
      </div>
    </header>

    {searchOpen && <div className="fixed inset-0 z-[80] bg-white p-3 md:hidden">
      <div className="flex items-center gap-2"><SearchBox autoFocus className="flex-1" onDone={() => setSearchOpen(false)} /><button onClick={() => setSearchOpen(false)} className="px-2 text-sm font-semibold text-slate-600">Cancel</button></div>
    </div>}

    {menuOpen && <div className="fixed inset-0 z-[80] lg:hidden">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className="drawer-in absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4"><span className="text-lg font-extrabold">Menu</span><button onClick={() => setMenuOpen(false)} aria-label="Close menu" className={iconButton}><X className="size-5" /></button></div>
        <div className="flex-1 overflow-y-auto p-4">
          {isAuthenticated && user
            ? <div className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3"><span className="grid size-10 place-items-center rounded-full bg-emerald-600 font-bold text-white">{user.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="font-bold text-slate-900">Hi, {user.name.split(' ')[0]}</p><p className="truncate text-xs text-slate-600">{user.email}</p></div></div>
            : <div className="mb-4 grid grid-cols-2 gap-2"><Link href="/login" className="rounded-xl border border-slate-200 py-2.5 text-center text-sm font-bold">Sign in</Link><Link href="/register" className="rounded-xl bg-slate-900 py-2.5 text-center text-sm font-bold text-white">Create account</Link></div>}
          <nav className="space-y-0.5">{links.map((link) => <Link key={link.href} href={link.href} className="flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-50">{link.label}<ChevronRight className="size-4 text-slate-400" /></Link>)}</nav>
          {categories.length > 0 && <>
            <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Categories</p>
            <nav className="space-y-0.5">{categories.map((category) => <Link key={category._id} href={`/catalog?category=${category.slug}`} className="block rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">{category.name}</Link>)}</nav>
          </>}
          <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Your stuff</p>
          <nav className="space-y-0.5">
            {[{ href: '/account/orders', label: 'My orders', icon: ReceiptText }, { href: '/wishlist', label: `Wishlist${wishlistCount ? ` (${wishlistCount})` : ''}`, icon: Heart }, { href: '/account', label: 'Account', icon: User }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Icon className="size-4 text-slate-400" />{label}</Link>)}
          </nav>
        </div>
        {isAuthenticated && <button onClick={signOut} className="flex items-center gap-3 border-t border-slate-100 px-7 py-4 text-sm font-semibold text-rose-600"><LogOut className="size-4" />Sign out</button>}
      </aside>
    </div>}
  </>;
}
