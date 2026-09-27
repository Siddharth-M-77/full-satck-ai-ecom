'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import { apiFetch } from '../../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<{
        success: boolean;
        data: {
          user: {
            id: string;
            name: string;
            email: string;
            role: 'customer' | 'staff' | 'admin';
            isEmailVerified: boolean;
          };
          accessToken: string;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setAuth(res.data.user, res.data.accessToken);
      router.push('/account');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Glow Effect */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur-xl opacity-20 transition duration-1000 group-hover:opacity-100" />

          <div className="relative rounded-3xl bg-white border border-slate-100 shadow-xl p-8 sm:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 mb-4 shadow-sm">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Welcome Back
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Sign in to your ShopSense AI account
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-slate-900 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Password
                  </label>
                  <a
                    href="#forgot"
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-slate-900 text-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-sm text-slate-500 mt-8">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
