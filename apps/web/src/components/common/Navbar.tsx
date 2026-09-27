'use client';

import Link from 'next/link';
import { useAuthStore } from '../../stores/auth.store';
import { Sparkles, ShoppingBag, User, LogOut, MapPin } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">
              ShopSense<span className="text-emerald-600">AI</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold -mt-1">
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

        {/* Right Auth & Cart Action Area */}
        <div className="flex items-center gap-4">
          <Link
            href="/cart"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition relative"
            aria-label="Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
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
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-emerald-600 transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 shadow-sm shadow-emerald-600/20 transition-all hover:shadow"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
