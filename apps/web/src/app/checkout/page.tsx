'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/auth.store';
import { useCartStore } from '../../stores/cart.store';
import { apiFetch } from '../../lib/api';
import {
  ShieldCheck,
  CreditCard,
  Banknote,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Plus,
} from 'lucide-react';

interface SavedAddress {
  _id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { items, pricing, fetchCart } = useCartStore();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'COD'>('RAZORPAY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New address state if user has none
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/checkout');
      return;
    }

    fetchCart();

    // Fetch saved addresses
    apiFetch<{ success: boolean; data: SavedAddress[] }>('/users/addresses')
      .then((res) => {
        setAddresses(res.data);
        const defaultAddr = res.data.find((a) => a.isDefault) || res.data[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr._id);
        }
      })
      .catch(() => {});

    // Dynamically inject Razorpay Checkout SDK
    if (!document.getElementById('razorpay-sdk')) {
      const script = document.createElement('script');
      script.id = 'razorpay-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isAuthenticated, router, fetchCart]);

  const handlePlaceOrder = async () => {
    setError(null);
    setLoading(true);

    try {
      let shippingAddress: Record<string, unknown>;

      if (selectedAddressId) {
        const addr = addresses.find((a) => a._id === selectedAddressId);
        if (!addr) throw new Error('Selected address not found');
        shippingAddress = {
          fullName: addr.fullName,
          phone: addr.phone,
          addressLine1: addr.addressLine1,
          addressLine2: addr.addressLine2,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
        };
      } else {
        if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode) {
          throw new Error('Please fill in all delivery address fields');
        }
        shippingAddress = {
          fullName,
          phone,
          addressLine1,
          city,
          state,
          postalCode,
          country: 'IN',
        };
      }

      // 1. Create order on server (atomically reserves stock)
      const res = await apiFetch<{
        success: boolean;
        data: {
          order: { _id: string; orderNumber: string };
          razorpayOrder?: { id: string; amount: number; currency: string; keyId: string };
        };
      }>('/checkout/create-order', {
        method: 'POST',
        body: JSON.stringify({
          shippingAddress,
          paymentMethod,
        }),
      });

      const { order, razorpayOrder } = res.data;

      if (paymentMethod === 'COD') {
        await fetchCart();
        router.push(`/orders/${order._id}?success=true`);
        return;
      }

      // 2. Launch Razorpay payment modal
      if (razorpayOrder && window.Razorpay) {
        const options = {
          key: razorpayOrder.keyId || 'rzp_test_placeholder',
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: 'ShopSense AI',
          description: `Order ${order.orderNumber}`,
          order_id: razorpayOrder.id,
          prefill: {
            name: user?.name,
            email: user?.email,
          },
          theme: {
            color: '#059669', // Emerald
          },
          handler: async function (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) {
            // 3. Verify signature on backend
            try {
              await apiFetch('/payments/verify', {
                method: 'POST',
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });
              await fetchCart();
              router.push(`/orders/${order._id}?success=true`);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Verification failed');
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setError(resp.error.description || 'Payment failed');
        });
        rzp.open();
      } else {
        // Fallback for mock/test environments
        router.push(`/orders/${order._id}?success=true`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Secure Checkout
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete your delivery details and choose your payment method
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {/* Address Section */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              1. Delivery Destination
            </h2>

            {addresses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((a) => (
                  <div
                    key={a._id}
                    onClick={() => setSelectedAddressId(a._id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                      selectedAddressId === a._id
                        ? 'border-emerald-600 bg-emerald-50/30 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-slate-900">{a.fullName}</p>
                      {selectedAddressId === a._id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {a.addressLine1}, {a.city}, {a.state} — {a.postalCode}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">Ph: {a.phone}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  placeholder="Street Address"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="sm:col-span-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            )}
          </div>

          {/* Payment Method Section */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              2. Payment Method
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setPaymentMethod('RAZORPAY')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3.5 ${
                  paymentMethod === 'RAZORPAY'
                    ? 'border-emerald-600 bg-emerald-50/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Razorpay Online</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    UPI, Credit/Debit Card, Netbanking (Test Mode Enabled)
                  </p>
                </div>
              </div>

              <div
                onClick={() => setPaymentMethod('COD')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3.5 ${
                  paymentMethod === 'COD'
                    ? 'border-emerald-600 bg-emerald-50/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Cash on Delivery</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pay at your doorstep upon package arrival
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary Checkout Card */}
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900">Order Items ({items.length})</h2>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {items.map((i) => (
                <div key={i.sku} className="flex justify-between items-center text-xs">
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-800">{i.title}</span>
                    <span className="text-slate-400 block">Qty: {i.quantity}</span>
                  </div>
                  <span className="font-bold text-slate-900">
                    ₹{i.subtotal.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  ₹{pricing.itemsTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{pricing.shippingFee === 0 ? 'FREE' : `₹${pricing.shippingFee}`}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (18%)</span>
                <span>₹{pricing.taxTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Total Payable</span>
              <span className="text-2xl font-extrabold text-slate-900">
                ₹{pricing.grandTotal.toLocaleString('en-IN')}
              </span>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={loading || items.length === 0}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {paymentMethod === 'COD' ? 'Confirm Order' : `Pay ₹${pricing.grandTotal.toLocaleString('en-IN')}`}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Razorpay 256-bit Encrypted SSL Gateway</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
