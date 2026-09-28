'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../stores/auth.store';
import { apiFetch } from '../../lib/api';
import {
  User,
  MapPin,
  Plus,
  Trash2,
  CheckCircle,
  Phone,
  Home,
  ShieldCheck,
  Building,
  ReceiptText,
} from 'lucide-react';

interface Address {
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
  type: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Address form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const fetchAddresses = useCallback(async () => {
    try {
      setLoadingAddresses(true);
      const res = await apiFetch<{ success: boolean; data: Address[] }>(
        '/users/addresses'
      );
      setAddresses(res.data);
    } catch {
      // Handled silently
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchAddresses();
  }, [isAuthenticated, router, fetchAddresses]);

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);

    try {
      await apiFetch('/users/addresses', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          phone,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country: 'IN',
          isDefault,
        }),
      });

      setIsModalOpen(false);
      // Reset form
      setFullName('');
      setPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setPostalCode('');
      setIsDefault(false);

      await fetchAddresses();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await apiFetch(`/users/addresses/${addressId}/default`, {
        method: 'PATCH',
      });
      await fetchAddresses();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to remove this address?')) return;

    try {
      await apiFetch(`/users/addresses/${addressId}`, {
        method: 'DELETE',
      });
      await fetchAddresses();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          My Account
        </h1>
        <p className="text-slate-500 mt-1">
          Manage your personal profile, security, and delivery addresses
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="space-y-6">
          <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10" />

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-emerald-500/20">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{user.name}</h2>
                <p className="text-xs text-slate-500">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {user.role.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Account Status</span>
                <span className="font-medium text-emerald-600">Active</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Addresses</span>
                <span className="font-semibold text-slate-900">
                  {addresses.length}
                </span>
              </div>
            </div>
            <Link
              href="/account/orders"
              className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-slate-800 transition hover:text-emerald-800"
            >
              <span className="inline-flex items-center gap-2"><ReceiptText className="size-4 text-emerald-700" />My orders and invoices</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Address Book */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Address Book
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Saved delivery locations for faster checkout
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Add Address
              </button>
            </div>

            {loadingAddresses ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <Building className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800">
                  No addresses saved yet
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Add your home or office address to enable quick 1-click checkout.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition"
                >
                  Add Your First Address
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr._id}
                    className={`p-5 rounded-2xl border transition relative ${
                      addr.isDefault
                        ? 'border-emerald-500/80 bg-emerald-50/20 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {addr.isDefault && (
                      <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        DEFAULT
                      </span>
                    )}

                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-1">
                      <Home className="w-4 h-4 text-slate-400" />
                      <span>{addr.fullName}</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                      {addr.addressLine1}
                      {addr.addressLine2 && `, ${addr.addressLine2}`}
                      <br />
                      {addr.city}, {addr.state} — {addr.postalCode}
                    </p>

                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-3">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{addr.phone}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                      {!addr.isDefault ? (
                        <button
                          onClick={() => handleSetDefault(addr._id)}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition"
                        >
                          Set as Default
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          Primary Delivery
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteAddress(addr._id)}
                        className="text-slate-400 hover:text-red-600 transition p-1"
                        aria-label="Delete Address"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-100 shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Add New Address
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Enter your complete shipping destination details
            </p>

            <form onSubmit={handleCreateAddress} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Siddharth S"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Flat / House No., Apartment, Street"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Landmark / Sector (Optional)
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Near City Center"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Karnataka"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="560001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="defaultAddressCheck"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="defaultAddressCheck"
                  className="text-xs text-slate-600 font-medium cursor-pointer"
                >
                  Make this my default shipping address
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {savingAddress ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
