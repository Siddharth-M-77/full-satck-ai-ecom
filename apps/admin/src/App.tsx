import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity, Boxes, CircleDollarSign, Clock3,
  ClipboardList, CreditCard, LayoutDashboard, LogIn, LogOut, Package, Plus, RefreshCw,
  Search, ShoppingCart, Tag, Users, X,
} from 'lucide-react';
import { adminFetch } from './lib/api';

type Section = 'overview' | 'products' | 'inventory' | 'orders' | 'customers' | 'coupons' | 'audit';
type Variant = { sku: string; price: number; stock: number; compareAtPrice?: number; attributes?: Record<string, string>; images?: Array<{ url: string }> };
type VariantDraft = { sku: string; price: string; stock: string; compareAtPrice: string; attributes: string; imageUrl: string };
type Product = { _id: string; title: string; slug: string; description: string; basePrice: number; compareAtPrice?: number; status: string; isFeatured: boolean; categoryId: { _id: string; name: string } | string; variants: Variant[] };
type Order = { _id: string; orderNumber: string; status: string; createdAt: string; items: Array<{ title: string; sku: string; quantity: number }>; pricing: { grandTotal: number }; shippingAddress?: { fullName?: string; city?: string }; fulfillment?: { trackingNumber?: string; carrier?: string } };
type Coupon = { _id: string; code: string; discountType: 'flat' | 'percentage'; discountValue: number; minOrderValue: number; endDate: string; isActive: boolean; usedCount: number };
type LowStock = { productId: string; title: string; slug: string; sku: string; stock: number; threshold: number };
type Customer = { _id: string; name: string; email: string; isBlocked: boolean; createdAt: string };
type SalesSummary = { revenue: number; orders: number; averageOrderValue: number };
type InventoryRow = { productId: string; title: string; slug: string; productStatus: string; sku: string; attributes?: Record<string, string>; price: number; stock: number; lowStock: boolean };
type SalesPeriod = 'today' | 'last7Days' | 'last30Days';
type Dashboard = { overview: { totalRevenue: number; totalOrders: number; avgOrderValue: number; lowStockCount: number; pendingOrders: number; totalProducts: number; totalVariants: number; totalUnitsInStock: number; outOfStockCount: number }; salesPeriods: Record<SalesPeriod, SalesSummary>; inventory: InventoryRow[]; salesTrend: Array<{ _id: string; revenue: number; orders: number }>; recentOrders: Order[]; lowStockProducts: LowStock[]; topProducts: Array<{ _id: string; title: string; salesCount: number }> };
type Category = { _id: string; name: string; slug: string };

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'coupons', label: 'Coupons', icon: Tag },
  { id: 'audit', label: 'Audit log', icon: ClipboardList },
];

const validNextStatuses: Record<string, string[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUND_REQUESTED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUND_REQUESTED'],
  REFUND_REQUESTED: ['REFUNDED', 'PAID'],
  CANCELLED: [],
  REFUNDED: [],
};
const money = (value = 0) => `₹${Number(value).toLocaleString('en-IN')}`;

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('shopsense_admin_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [section, setSection] = useState<Section>('overview');
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('today');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState(5);
  const [inventorySearch, setInventorySearch] = useState('');
  const [productDialog, setProductDialog] = useState<Product | null | false>(false);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [couponDialog, setCouponDialog] = useState<Coupon | null | false>(false);
  const [stockTarget, setStockTarget] = useState<LowStock | null>(null);
  const [stockDelta, setStockDelta] = useState(1);
  const [stockNotes, setStockNotes] = useState('');

  const refresh = async (target = section) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      if (target === 'overview') {
        const result = await adminFetch('/admin/dashboard');
        setDashboard(result.data);
      } else if (target === 'products') {
        const [result, categoryResult] = await Promise.all([
          adminFetch(`/admin/products?limit=100&search=${encodeURIComponent(search)}`),
          adminFetch('/catalog/categories'),
        ]);
        setProducts(result.data);
        setCategories(categoryResult.data);
      } else if (target === 'inventory') {
        const [result, productsResult] = await Promise.all([
          adminFetch(`/admin/inventory/low-stock?threshold=${threshold}`),
          adminFetch('/admin/products?limit=100'),
        ]);
        setLowStock(result.data);
        setProducts(productsResult.data);
      } else if (target === 'orders') {
        setOrders((await adminFetch('/admin/orders?limit=100')).data);
      } else if (target === 'customers') {
        setCustomers((await adminFetch('/admin/customers?limit=100')).data);
      } else if (target === 'coupons') {
        setCoupons((await adminFetch('/admin/coupons')).data);
      } else if (target === 'audit') {
        setAudit((await adminFetch('/admin/audit-logs')).data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this section');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) void refresh(section); }, [token, section]);
  useEffect(() => {
    if (productDialog === false) return;
    if (!productDialog) {
      setVariantDrafts([{ sku: '', price: '', stock: '0', compareAtPrice: '', attributes: 'option=Standard', imageUrl: '' }]);
      return;
    }
    setVariantDrafts(productDialog.variants.map((variant) => ({
      sku: variant.sku,
      price: String(variant.price),
      stock: String(variant.stock),
      compareAtPrice: String(variant.compareAtPrice || ''),
      attributes: Object.entries(variant.attributes || {}).map(([key, value]) => `${key}=${value}`).join(','),
      imageUrl: variant.images?.[0]?.url || '',
    })));
  }, [productDialog]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await adminFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!['admin', 'staff'].includes(result.data.user.role)) throw new Error('Admin or staff access is required.');
      localStorage.setItem('shopsense_admin_token', result.data.accessToken);
      setToken(result.data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally { setLoading(false); }
  };

  const signOut = () => {
    localStorage.removeItem('shopsense_admin_token');
    setToken('');
    setDashboard(null);
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = productDialog === false ? null : productDialog;
    const title = String(form.get('title'));
    const payload = {
      title,
      slug: String(form.get('slug')),
      description: String(form.get('description')),
      categoryId: String(form.get('categoryId')),
      basePrice: Number(form.get('price')),
      compareAtPrice: Number(form.get('compareAtPrice')) || undefined,
      status: String(form.get('status')),
      isFeatured: form.get('isFeatured') === 'on',
      variants: variantDrafts.map((variant) => ({
        sku: variant.sku.trim(),
        attributes: Object.fromEntries(variant.attributes.split(',').map((attribute) => attribute.split('=').map((part) => part.trim())).filter((parts) => parts.length === 2 && parts[0])),
        price: Number(variant.price),
        compareAtPrice: Number(variant.compareAtPrice) || undefined,
        stock: Number(variant.stock),
        images: variant.imageUrl ? [{ url: variant.imageUrl, isPrimary: true }] : [],
      })),
    };
    try {
      await adminFetch(editing ? `/admin/products/${editing._id}` : '/admin/products', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      setProductDialog(false);
      setNotice(editing ? 'Product saved.' : 'Product created.');
      await refresh('products');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save product'); }
  };

  const archiveProduct = async (product: Product) => {
    if (!window.confirm(`Archive ${product.title}?`)) return;
    try {
      await adminFetch(`/admin/products/${product._id}`, { method: 'DELETE' });
      setNotice('Product archived.');
      await refresh('products');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not archive product'); }
  };

  const adjustInventory = async (event: FormEvent) => {
    event.preventDefault();
    if (!stockTarget) return;
    try {
      await adminFetch('/admin/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({ productId: stockTarget.productId, sku: stockTarget.sku, changeQuantity: Number(stockDelta), notes: stockNotes }),
      });
      setNotice(`Stock adjusted for ${stockTarget.sku}.`);
      setStockTarget(null);
      setStockNotes('');
      await refresh('inventory');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not adjust stock'); }
  };

  const updateOrder = async (order: Order, status: string) => {
    try {
      await adminFetch(`/admin/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(`${order.orderNumber} updated.`);
      await refresh('orders');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update order'); }
  };

  const refundOrder = async (order: Order) => {
    if (!window.confirm(`Issue a full Razorpay refund for ${order.orderNumber}?`)) return;
    try {
      await adminFetch(`/admin/orders/${order._id}/refund`, { method: 'POST', body: JSON.stringify({ reason: 'Admin dashboard refund' }) });
      setNotice('Refund request accepted by payment provider.');
      await refresh('orders');
    } catch (err) { setError(err instanceof Error ? err.message : 'Refund failed'); }
  };

  const setBlocked = async (customer: Customer) => {
    try {
      await adminFetch(`/admin/customers/${customer._id}/block`, { method: 'PATCH', body: JSON.stringify({ isBlocked: !customer.isBlocked }) });
      setNotice(customer.isBlocked ? 'Customer access restored.' : 'Customer blocked.');
      await refresh('customers');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update customer'); }
  };

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = couponDialog === false ? null : couponDialog;
    const payload = {
      code: String(form.get('code')).toUpperCase(),
      discountType: String(form.get('discountType')),
      discountValue: Number(form.get('discountValue')),
      minOrderValue: Number(form.get('minOrderValue')) || 0,
      usageLimitPerUser: Number(form.get('usageLimitPerUser')) || 1,
      endDate: new Date(String(form.get('endDate'))).toISOString(),
      startDate: new Date().toISOString(),
      isActive: true,
    };
    try {
      await adminFetch(editing ? `/admin/coupons/${editing._id}` : '/admin/coupons', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      setCouponDialog(false);
      setNotice(editing ? 'Coupon updated.' : 'Coupon created.');
      await refresh('coupons');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save coupon'); }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
    try {
      await adminFetch(`/admin/coupons/${coupon._id}`, { method: 'DELETE' });
      setNotice('Coupon deleted.');
      await refresh('coupons');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete coupon'); }
  };

  const updateVariantDraft = (index: number, changes: Partial<VariantDraft>) => {
    setVariantDrafts((current) => current.map((variant, row) => row === index ? { ...variant, ...changes } : variant));
  };

  if (!token) return <main className="grid min-h-screen place-items-center bg-[#f3f6f2] p-5">
    <form onSubmit={login} className="w-full max-w-sm border border-slate-200 bg-white p-7 shadow-sm">
      <div className="mb-7 flex items-center gap-3"><span className="grid size-10 place-items-center bg-emerald-800 text-white"><Package className="size-5" /></span><div><p className="font-semibold text-slate-950">ShopSense</p><p className="text-xs text-slate-500">Store administration</p></div></div>
      <h1 className="font-serif text-2xl font-bold text-slate-950">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Use an admin or staff account.</p>
      {error && <p role="alert" className="mt-4 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <label className="mt-5 block text-xs font-semibold text-slate-700">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700" /></label>
      <label className="mt-4 block text-xs font-semibold text-slate-700">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700" /></label>
      <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"><LogIn className="size-4" />{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>;

  const current = sections.find((item) => item.id === section)!;
  const Icon = current.icon;
  const editingProduct = productDialog === false ? null : productDialog;
  const editingCoupon = couponDialog === false ? null : couponDialog;
  const selectedSales = dashboard?.salesPeriods[salesPeriod] || { revenue: 0, orders: 0, averageOrderValue: 0 };
  const salesPeriodLabel = salesPeriod === 'today' ? 'Today' : salesPeriod === 'last7Days' ? 'Last 7 days' : 'Last 30 days';
  const metricRows: Array<{ label: string; value: string | number; icon: typeof CircleDollarSign }> = dashboard ? [
    { label: `${salesPeriodLabel} revenue`, value: money(selectedSales.revenue), icon: CircleDollarSign },
    { label: `${salesPeriodLabel} paid orders`, value: selectedSales.orders, icon: ShoppingCart },
    { label: 'Average order value', value: money(selectedSales.averageOrderValue), icon: CreditCard },
    { label: 'Awaiting payment', value: dashboard.overview.pendingOrders, icon: Clock3 },
  ] : [];
  const visibleInventory = dashboard?.inventory.filter((item) => {
    const query = inventorySearch.trim().toLowerCase();
    return !query || item.title.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query);
  }) || [];
  const modal = (open: boolean, close: () => void, title: string, content: React.ReactNode) => open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-slate-200 bg-white p-5 shadow-xl sm:p-7"><header className="mb-5 flex items-center justify-between"><h2 className="font-serif text-xl font-bold text-slate-950">{title}</h2><button onClick={close} aria-label="Close" className="grid size-9 place-items-center hover:bg-slate-100"><X className="size-4" /></button></header>{content}</section></div>;

  return <div className="min-h-screen bg-[#f5f7f4] text-slate-900">
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
      <div className="flex items-center gap-3"><span className="grid size-8 place-items-center bg-emerald-800 text-white"><Package className="size-4" /></span><strong className="text-sm">ShopSense <span className="font-normal text-slate-400">/ Admin</span></strong></div>
      <div className="flex items-center gap-2"><span className="hidden text-xs text-slate-500 sm:inline">Store operations</span><button title="Sign out" onClick={signOut} className="grid size-9 place-items-center text-slate-600 hover:bg-slate-100"><LogOut className="size-4" /></button></div>
    </header>
    <div className="mx-auto grid min-w-0 max-w-[1600px] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-slate-200 bg-white p-3 lg:min-h-[calc(100vh-56px)] lg:border-b-0 lg:border-r lg:p-4">
        <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:block lg:space-y-1">{sections.map(({ id, label, icon: ItemIcon }) => <button key={id} onClick={() => { setSection(id); setError(''); setNotice(''); }} className={`flex min-w-0 w-full items-center gap-2 px-2.5 py-2.5 text-left text-[11px] font-semibold transition sm:gap-3 sm:px-3 sm:text-xs lg:gap-3 ${section === id ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-50'}`}><ItemIcon className="size-4 shrink-0" /><span className="truncate">{label}</span></button>)}</nav>
        <div className="mt-8 hidden border-t border-slate-200 pt-4 lg:block"><p className="text-[10px] font-bold uppercase text-slate-400">Live catalog</p><p className="mt-1 text-xs text-slate-600">MongoDB connected through API</p></div>
      </aside>

      <main className="min-w-0 p-4 sm:p-7">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-white text-emerald-800"><Icon className="size-4" /></span><div><p className="text-[10px] font-bold uppercase text-emerald-800">ShopSense operations</p><h1 className="font-serif text-2xl font-bold text-slate-950">{current.label}</h1></div></div>
          <div className="flex items-center gap-2"><button onClick={() => void refresh()} className="flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:border-slate-500"><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>{section === 'products' && <button onClick={() => setProductDialog(null)} className="flex items-center gap-2 bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900"><Plus className="size-4" />New product</button>}{section === 'coupons' && <button onClick={() => setCouponDialog(null)} className="flex items-center gap-2 bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900"><Plus className="size-4" />New coupon</button>}</div>
        </header>
        {error && <div role="alert" className="mb-4 flex items-center justify-between border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss" className="p-1"><X className="size-4" /></button></div>}
        {notice && <div role="status" className="mb-4 flex items-center justify-between border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss" className="p-1"><X className="size-4" /></button></div>}

        {section === 'overview' && dashboard && <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-slate-500">Paid and fulfilled orders only · amounts in INR</p>
            <div className="inline-flex border border-slate-300 bg-white p-0.5" role="group" aria-label="Sales period">
              {([
                ['today', 'Today'],
                ['last7Days', '7 days'],
                ['last30Days', '30 days'],
              ] as Array<[SalesPeriod, string]>).map(([period, label]) => <button key={period} type="button" onClick={() => setSalesPeriod(period)} aria-pressed={salesPeriod === period} className={`px-3 py-1.5 text-[10px] font-semibold ${salesPeriod === period ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 border-y border-slate-200 bg-white md:grid-cols-4">{metricRows.map(({ label, value, icon: MetricIcon }) => <div key={label} className="border-b border-r border-slate-200 p-4 md:border-b-0"><MetricIcon className="size-4 text-emerald-800" /><p className="mt-3 text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-950">{value}</p></div>)}</div>

          <div className="mt-3 grid grid-cols-2 border-y border-slate-200 bg-white sm:grid-cols-4">
            {[
              ['Products', dashboard.overview.totalProducts],
              ['Sellable variants', dashboard.overview.totalVariants],
              ['Units in stock', dashboard.overview.totalUnitsInStock],
              ['Out of stock', dashboard.overview.outOfStockCount],
            ].map(([label, value]) => <div key={String(label)} className="border-b border-r border-slate-200 px-4 py-3 last:border-r-0 sm:border-b-0"><p className="text-[9px] font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 text-base font-bold ${label === 'Out of stock' && Number(value) > 0 ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p></div>)}
          </div>

          <div className="mt-7 grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-[1.25fr_1fr]">
            <section className="min-w-0"><div className="mb-3 flex items-center justify-between"><div className="min-w-0"><h2 className="font-serif text-lg font-bold">Sales trend · last 7 days</h2><p className="text-[10px] text-slate-500">Revenue and paid-order count by UTC day</p></div><Activity className="size-4 shrink-0 text-emerald-800" /></div><div className="flex h-48 min-w-0 items-end gap-2 border-b border-l border-slate-300 bg-white px-3 pt-4">{dashboard.salesTrend.map((day) => { const max = Math.max(1, ...dashboard.salesTrend.map((entry) => entry.revenue)); return <div key={day._id} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"><div title={`${money(day.revenue)} · ${day.orders} orders`} className="mx-auto w-full max-w-12 bg-emerald-700" style={{ height: `${Math.max(4, day.revenue / max * 100)}%` }} /><span className="truncate py-2 text-[9px] text-slate-500">{day._id.slice(5)}</span></div>; })}</div></section>
            <div className="min-w-0 space-y-7">
              <section><h2 className="mb-3 font-serif text-lg font-bold">Low-stock alerts <span className="ml-1 text-sm font-normal text-rose-700">{dashboard.lowStockProducts.length}</span></h2><div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">{dashboard.lowStockProducts.slice(0, 6).map((item) => <div key={`${item.productId}-${item.sku}`} className="flex justify-between gap-3 px-3 py-2.5 text-xs"><span className="min-w-0 truncate font-semibold">{item.title}<span className="ml-2 font-normal text-slate-500">{item.sku}</span></span><span className="shrink-0 font-bold text-rose-700">{item.stock} left</span></div>)}{!dashboard.lowStockProducts.length && <p className="p-4 text-sm text-slate-500">No variants at or below 5 units.</p>}</div></section>
              <section><h2 className="mb-3 font-serif text-lg font-bold">Top-selling products</h2><div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">{dashboard.topProducts.map((product, index) => <div key={product._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"><span className="min-w-0 truncate"><span className="mr-2 text-slate-400">{index + 1}.</span><span className="font-semibold">{product.title}</span></span><span className="shrink-0 text-slate-600">{product.salesCount} sold</span></div>)}{!dashboard.topProducts.length && <p className="p-4 text-sm text-slate-500">Sales leaders appear after completed orders.</p>}</div></section>
            </div>
          </div>

          <section className="mt-8"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-lg font-bold">Stock remaining · every variant</h2><p className="text-[10px] text-slate-500">{dashboard.inventory.length} SKUs across {dashboard.overview.totalProducts} products</p></div><div className="flex items-center gap-2 border border-slate-300 bg-white px-3"><Search className="size-3.5 text-slate-400" /><input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Search product or SKU" className="w-48 py-2 text-xs outline-none" /></div></div><div className="max-h-[440px] overflow-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3">Variant / SKU</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Remaining</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-200">{visibleInventory.map((item) => <tr key={`${item.productId}-${item.sku}`}><td className="max-w-64 px-3 py-2.5"><p className="truncate font-semibold">{item.title}</p><p className="text-[9px] text-slate-500">{item.slug}</p></td><td className="px-3 py-2.5"><p>{Object.values(item.attributes || {}).join(' / ') || 'Standard'}</p><p className="font-mono text-[10px] text-slate-500">{item.sku}</p></td><td className="px-3 py-2.5">{money(item.price)}</td><td className="px-3 py-2.5 text-[10px]">{item.productStatus}</td><td className={`px-3 py-2.5 font-bold ${item.stock === 0 ? 'text-rose-800' : item.lowStock ? 'text-amber-700' : 'text-slate-900'}`}>{item.stock}{item.stock === 0 ? ' · OUT' : item.lowStock ? ' · LOW' : ''}</td><td className="px-3 py-2.5"><button onClick={() => { setStockTarget({ productId: item.productId, title: item.title, slug: item.slug, sku: item.sku, stock: item.stock, threshold: 5 }); setStockDelta(1); }} className="font-semibold text-emerald-800 hover:underline">Adjust</button></td></tr>)}</tbody></table>{!visibleInventory.length && <p className="p-5 text-sm text-slate-500">No matching inventory.</p>}</div></section>
          <section className="mt-8"><h2 className="mb-3 font-serif text-lg font-bold">Recent orders</h2><OrderTable orders={dashboard.recentOrders} onStatus={updateOrder} onRefund={refundOrder} /></section>
        </>}

        {section === 'products' && <><div className="mb-4 flex max-w-md items-center gap-2 border border-slate-300 bg-white px-3"><Search className="size-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void refresh('products'); }} placeholder="Search product title or SKU" className="w-full py-2.5 text-sm outline-none" /></div><div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Variants / Stock</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{products.map((product) => <tr key={product._id}><td className="max-w-64 px-3 py-3"><p className="truncate font-semibold">{product.title}</p><p className="mt-1 text-[10px] text-slate-500">{product.slug}</p></td><td className="px-3 py-3">{typeof product.categoryId === 'object' ? product.categoryId.name : '—'}</td><td className="px-3 py-3">{product.variants.map((variant) => <p key={variant.sku}>{variant.sku} <span className={variant.stock <= threshold ? 'font-bold text-rose-700' : 'text-slate-500'}>· {variant.stock}</span></p>)}</td><td className="px-3 py-3 font-semibold">{money(product.basePrice)}</td><td className="px-3 py-3"><span className="border border-slate-200 px-2 py-1 text-[10px]">{product.status}</span></td><td className="px-3 py-3"><button onClick={() => setProductDialog(product)} className="mr-3 font-semibold text-emerald-800 hover:underline">Edit</button><button onClick={() => void archiveProduct(product)} className="text-rose-700 hover:underline">Archive</button></td></tr>)}</tbody></table>{!products.length && !loading && <p className="p-6 text-sm text-slate-500">No products found.</p>}</div></>}

        {section === 'inventory' && <><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><label className="block text-[10px] font-bold uppercase text-slate-500">Alert threshold</label><input type="number" min="0" max="1000" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="mt-1 w-24 border border-slate-300 bg-white px-3 py-2 text-sm" /></div><p className="text-xs text-slate-500">Low-stock alerts are calculated per variant.</p></div><div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Available</th><th className="px-3 py-3">Alert at</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-200">{lowStock.map((item) => <tr key={`${item.productId}-${item.sku}`}><td className="px-3 py-3 font-semibold">{item.title}</td><td className="px-3 py-3 font-mono">{item.sku}</td><td className="px-3 py-3 font-bold text-rose-700">{item.stock}</td><td className="px-3 py-3">{item.threshold}</td><td className="px-3 py-3"><button onClick={() => setStockTarget(item)} className="font-semibold text-emerald-800 hover:underline">Adjust stock</button></td></tr>)}</tbody></table>{!lowStock.length && <p className="p-6 text-sm text-slate-500">No low-stock variants at this threshold.</p>}</div><section className="mt-7"><h2 className="mb-3 font-serif text-lg font-bold">Manual adjustment</h2><form onSubmit={adjustInventory} className="flex flex-wrap items-end gap-3 border-y border-slate-200 bg-white p-4"><label className="min-w-60 flex-1 text-[10px] font-bold uppercase text-slate-500">Product / variant<select required value={stockTarget ? `${stockTarget.productId}|${stockTarget.sku}` : ''} onChange={(event) => { const [id, sku] = event.target.value.split('|'); const product = products.find((item) => item._id === id); const variant = product?.variants.find((item) => item.sku === sku); if (product && variant) setStockTarget({ productId: id, title: product.title, slug: product.slug, sku, stock: variant.stock, threshold }); }} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-xs"><option value="">Choose variant</option>{products.flatMap((product) => product.variants.map((variant) => <option key={`${product._id}-${variant.sku}`} value={`${product._id}|${variant.sku}`}>{product.title} · {variant.sku} · {variant.stock} in stock</option>))}</select></label><label className="text-[10px] font-bold uppercase text-slate-500">Change (+/-)<input type="number" required value={stockDelta} onChange={(event) => setStockDelta(Number(event.target.value))} className="mt-1 block w-28 border border-slate-300 px-3 py-2 text-sm" /></label><label className="min-w-48 flex-1 text-[10px] font-bold uppercase text-slate-500">Reason<input value={stockNotes} onChange={(event) => setStockNotes(event.target.value)} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-sm" /></label><button disabled={!stockTarget} className="bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Save adjustment</button></form></section></>}

        {section === 'orders' && <OrderTable orders={orders} onStatus={updateOrder} onRefund={refundOrder} />}

        {section === 'customers' && <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-200">{customers.map((customer) => <tr key={customer._id}><td className="px-3 py-3"><p className="font-semibold">{customer.name}</p><p className="mt-1 text-slate-500">{customer.email}</p></td><td className="px-3 py-3">{new Date(customer.createdAt).toLocaleDateString()}</td><td className="px-3 py-3">{customer.isBlocked ? 'Blocked' : 'Active'}</td><td className="px-3 py-3"><button onClick={() => void setBlocked(customer)} className={customer.isBlocked ? 'font-semibold text-emerald-800' : 'font-semibold text-rose-700'}>{customer.isBlocked ? 'Unblock' : 'Block'}</button></td></tr>)}</tbody></table>{!customers.length && <p className="p-6 text-sm text-slate-500">No customers found.</p>}</div>}

        {section === 'coupons' && <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Code</th><th className="px-3 py-3">Discount</th><th className="px-3 py-3">Minimum</th><th className="px-3 py-3">Expires</th><th className="px-3 py-3">Used</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{coupons.map((coupon) => <tr key={coupon._id}><td className="px-3 py-3 font-bold">{coupon.code}<span className={`ml-2 border px-1.5 py-0.5 text-[9px] ${coupon.isActive ? 'border-emerald-200 text-emerald-800' : 'border-slate-200 text-slate-500'}`}>{coupon.isActive ? 'ACTIVE' : 'PAUSED'}</span></td><td className="px-3 py-3">{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : money(coupon.discountValue)}</td><td className="px-3 py-3">{money(coupon.minOrderValue)}</td><td className="px-3 py-3">{new Date(coupon.endDate).toLocaleDateString()}</td><td className="px-3 py-3">{coupon.usedCount}</td><td className="px-3 py-3"><button onClick={() => setCouponDialog(coupon)} className="mr-3 font-semibold text-emerald-800">Edit</button><button onClick={() => void deleteCoupon(coupon)} className="text-rose-700">Delete</button></td></tr>)}</tbody></table>{!coupons.length && <p className="p-6 text-sm text-slate-500">No coupons yet.</p>}</div>}

        {section === 'audit' && <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">When</th><th className="px-3 py-3">Actor</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Resource</th><th className="px-3 py-3">Reference</th></tr></thead><tbody className="divide-y divide-slate-200">{audit.map((entry, index) => <tr key={String(entry._id || index)}><td className="px-3 py-3">{entry.createdAt ? new Date(String(entry.createdAt)).toLocaleString() : '—'}</td><td className="px-3 py-3">{String(entry.userEmail || '—')}</td><td className="px-3 py-3 font-semibold">{String(entry.action || '—')}</td><td className="px-3 py-3">{String(entry.resourceType || '—')}</td><td className="px-3 py-3">{String(entry.resourceId || '—')}</td></tr>)}</tbody></table>{!audit.length && <p className="p-6 text-sm text-slate-500">No audit entries.</p>}</div>}
      </main>
    </div>

    {modal(productDialog !== false, () => setProductDialog(false), editingProduct ? 'Edit product' : 'Create product', <form onSubmit={saveProduct} className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label="Product title" required defaultValue={editingProduct?.title || ''} />
      <Field name="slug" label="Slug" required defaultValue={editingProduct?.slug || ''} />
      <label className="text-[10px] font-bold uppercase text-slate-500">Category<select required name="categoryId" defaultValue={editingProduct ? (typeof editingProduct.categoryId === 'object' ? editingProduct.categoryId._id : editingProduct.categoryId) : ''} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
      <label className="text-[10px] font-bold uppercase text-slate-500">Status<select name="status" defaultValue={editingProduct?.status || 'published'} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
      <label className="flex items-center gap-2 self-end py-2 text-xs font-semibold"><input type="checkbox" name="isFeatured" defaultChecked={editingProduct?.isFeatured || false} />Feature on storefront</label>
      <label className="text-[10px] font-bold uppercase text-slate-500 sm:col-span-2">Description<textarea name="description" required defaultValue={editingProduct?.description || ''} rows={3} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-sm" /></label>
      <section className="space-y-3 border-y border-slate-200 py-4 sm:col-span-2">
        <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase text-slate-700">Variants and stock</h3><button type="button" onClick={() => setVariantDrafts((current) => [...current, { sku: '', price: '', stock: '0', compareAtPrice: '', attributes: '', imageUrl: '' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Plus className="size-3.5" />Add variant</button></div>
        {variantDrafts.map((variant, index) => <div key={`variant-${index}`} className="grid gap-3 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
          <label className="text-[9px] font-bold uppercase text-slate-500">SKU<input required value={variant.sku} onChange={(event) => updateVariantDraft(index, { sku: event.target.value })} className="mt-1 block w-full border border-slate-300 bg-white px-2 py-2 text-xs font-normal text-slate-900" /></label>
          <label className="text-[9px] font-bold uppercase text-slate-500">Attributes (key=value)<input value={variant.attributes} onChange={(event) => updateVariantDraft(index, { attributes: event.target.value })} placeholder="color=Black,size=M" className="mt-1 block w-full border border-slate-300 bg-white px-2 py-2 text-xs font-normal text-slate-900" /></label>
          <label className="text-[9px] font-bold uppercase text-slate-500">Image URL<input type="url" value={variant.imageUrl} onChange={(event) => updateVariantDraft(index, { imageUrl: event.target.value })} className="mt-1 block w-full border border-slate-300 bg-white px-2 py-2 text-xs font-normal text-slate-900" /></label>
          <label className="text-[9px] font-bold uppercase text-slate-500">Price<input type="number" min="0" required value={variant.price} onChange={(event) => updateVariantDraft(index, { price: event.target.value })} className="mt-1 block w-full border border-slate-300 bg-white px-2 py-2 text-xs font-normal text-slate-900" /></label>
          <label className="text-[9px] font-bold uppercase text-slate-500">Compare-at price<input type="number" min="0" value={variant.compareAtPrice} onChange={(event) => updateVariantDraft(index, { compareAtPrice: event.target.value })} className="mt-1 block w-full border border-slate-300 bg-white px-2 py-2 text-xs font-normal text-slate-900" /></label>
          <div className="flex items-end gap-2"><label className="flex-1 text-[9px] font-bold uppercase text-slate-500">Stock<input type="number" min="0" required value={variant.stock} onChange={(event) => updateVariantDraft(index, { stock: event.target.value })} className="mt-1 block w-full border border-slate-300 bg-white px-2 py-2 text-xs font-normal text-slate-900" /></label>{variantDrafts.length > 1 && <button type="button" title="Remove variant" onClick={() => setVariantDrafts((current) => current.filter((_, row) => row !== index))} className="grid size-8 place-items-center border border-slate-300 bg-white text-rose-700"><X className="size-3.5" /></button>}</div>
        </div>)}
      </section>
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setProductDialog(false)} className="border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button><button className="bg-emerald-800 px-4 py-2 text-xs font-semibold text-white">Save product</button></div>
    </form>)}

    {modal(couponDialog !== false, () => setCouponDialog(false), editingCoupon ? 'Edit coupon' : 'Create coupon', <form onSubmit={saveCoupon} className="grid gap-4 sm:grid-cols-2">
      <Field name="code" label="Coupon code" required defaultValue={editingCoupon?.code || ''} />
      <label className="text-[10px] font-bold uppercase text-slate-500">Discount type<select name="discountType" defaultValue={editingCoupon?.discountType || 'percentage'} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="percentage">Percentage</option><option value="flat">Flat amount</option></select></label>
      <Field name="discountValue" label="Discount value" type="number" required defaultValue={editingCoupon ? String(editingCoupon.discountValue) : ''} />
      <Field name="minOrderValue" label="Minimum order value" type="number" defaultValue={editingCoupon ? String(editingCoupon.minOrderValue) : '0'} />
      <Field name="usageLimitPerUser" label="Uses per customer" type="number" defaultValue="1" />
      <Field name="endDate" label="Expiry date" type="date" required defaultValue={editingCoupon?.endDate.slice(0, 10) || ''} />
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setCouponDialog(false)} className="border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button><button className="bg-emerald-800 px-4 py-2 text-xs font-semibold text-white">Save coupon</button></div>
    </form>)}

    {modal(Boolean(stockTarget), () => setStockTarget(null), 'Adjust inventory', <form onSubmit={adjustInventory} className="space-y-4"><p className="text-sm text-slate-600">{stockTarget?.title} · <span className="font-mono">{stockTarget?.sku}</span> · current {stockTarget?.stock}</p><label className="block text-[10px] font-bold uppercase text-slate-500">Change quantity (use a negative value to reduce)<input type="number" required value={stockDelta} onChange={(event) => setStockDelta(Number(event.target.value))} className="mt-1 block w-full border border-slate-300 px-3 py-2.5 text-sm" /></label><label className="block text-[10px] font-bold uppercase text-slate-500">Reason<input value={stockNotes} onChange={(event) => setStockNotes(event.target.value)} className="mt-1 block w-full border border-slate-300 px-3 py-2.5 text-sm" /></label><div className="flex justify-end"><button className="bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white">Apply adjustment</button></div></form>)}
  </div>;
}

function Field({ name, label, type = 'text', required = false, defaultValue = '' }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <label className="text-[10px] font-bold uppercase text-slate-500">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} className="mt-1 block w-full border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-emerald-700" /></label>;
}

function OrderTable({ orders, onStatus, onRefund }: { orders: Order[]; onStatus: (order: Order, status: string) => void; onRefund: (order: Order) => void }) {
  return <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[880px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Order</th><th className="px-3 py-3">Items</th><th className="px-3 py-3">Ship to</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{orders.map((order) => <tr key={order._id}><td className="px-3 py-3"><p className="font-bold">{order.orderNumber}</p><p className="mt-1 text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p></td><td className="max-w-64 px-3 py-3">{order.items.map((item) => <p key={item.sku} className="truncate">{item.title} × {item.quantity}</p>)}</td><td className="px-3 py-3">{order.shippingAddress?.fullName || '—'}<p className="text-slate-500">{order.shippingAddress?.city || ''}</p></td><td className="px-3 py-3 font-bold">{money(order.pricing?.grandTotal)}</td><td className="px-3 py-3"><select aria-label={`Status for ${order.orderNumber}`} value={order.status} onChange={(event) => onStatus(order, event.target.value)} className="border border-slate-300 bg-white px-2 py-1.5 text-[10px]">{[order.status, ...(validNextStatuses[order.status] || [])].map((status) => <option key={status}>{status}</option>)}</select></td><td className="px-3 py-3">{['PAID', 'REFUND_REQUESTED'].includes(order.status) && <button onClick={() => onRefund(order)} className="font-semibold text-rose-700 hover:underline">Refund</button>}{order.fulfillment?.trackingNumber && <p className="mt-1 text-[10px] text-slate-500">{order.fulfillment.trackingNumber}</p>}</td></tr>)}</tbody></table>{!orders.length && <p className="p-6 text-sm text-slate-500">No orders found.</p>}</div>;
}