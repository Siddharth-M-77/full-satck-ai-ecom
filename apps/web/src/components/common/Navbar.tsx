'use client';

import Link from 'next/link';
import { useAuthStore } from '../../stores/auth.store';
import { useCartStore } from '../../stores/cart.store';
import { Sparkles, ShoppingBag, Heart, Search, User, LogOut, MapPin, ReceiptText } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Navbar() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const { itemCount, fetchCart } = useCartStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white transition-transform group-hover:scale-105 sm:size-10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="whitespace-nowrap text-lg font-extrabold text-slate-900 transition-colors group-hover:text-emerald-600 sm:text-xl">
              ShopSense<span className="text-emerald-600">AI</span>
            </span>
            <span className="-mt-1 hidden text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:block">
              Intelligent Commerce
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link
            href="/"
            className="hover:text-emerald-600 transition-colors hover:font-semibold"
          >
            Home
          </Link>
          <Link
            href="/catalog"
            className="hover:text-emerald-600 transition-colors hover:font-semibold"
          >
            Explore Catalog
          </Link>
          <Link
            href="/#ai-assistant"
            className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold hover:text-emerald-700"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            AI Assistant
          </Link>
        </nav>

        <form action="/catalog" className="mx-5 hidden max-w-sm flex-1 items-center rounded-full border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-600 xl:flex">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input name="search" type="search" placeholder="Search products, brands..." className="w-full bg-transparent px-2.5 py-2 text-xs text-slate-900 outline-none" />
        </form>

        {/* Right Auth & Cart Action Area */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/catalog"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 xl:hidden"
            aria-label="Search products"
            title="Search products"
          >
            <Search className="w-5 h-5" />
          </Link>
          <Link
            href="/wishlist"
            className="p-2 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
            aria-label="Wishlist"
            title="Wishlist"
          >
            <Heart className="w-5 h-5" />
          </Link>
          <Link
            href="/cart"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition relative"
            aria-label="Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shadow-sm">
                {itemCount}
              </span>
            )}
          </Link>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-3 rounded-full border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/50 transition shadow-sm text-sm"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-800 hidden sm:inline">
                  {user.name.split(' ')[0]}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium capitalize">
                  {user.role}
                </span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Signed in as</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {user.email}
                    </p>
                  </div>

                  <Link
                    href="/account"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Account & Profile
                  </Link>

                  <Link
                    href="/account/orders"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <ReceiptText className="w-4 h-4 text-slate-400" />
                    My Orders
                  </Link>

                  <Link
                    href="/account#addresses"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <MapPin className="w-4 h-4 text-slate-400" />
                    Saved Addresses
                  </Link>

                  <div className="border-t border-slate-100 mt-1">
                    <button
                      onClick={() => {
                        clearAuth();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden whitespace-nowrap px-2 py-2 text-sm font-medium text-slate-700 transition hover:text-emerald-600 sm:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:px-4 sm:text-sm"
              >
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Get Started</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
