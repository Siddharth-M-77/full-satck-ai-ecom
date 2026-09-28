import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Boxes, CircleDollarSign, Clock3,
  ClipboardList, CreditCard, Download, History, LayoutDashboard, LogIn, LogOut, Menu, Package, Plus, RefreshCw,
  Search, ShoppingCart, Tag, Truck, Users, X, FolderTree, ImagePlus, Eye, Loader2, Pencil, Trash2, Archive,
  Pause, Play, ShieldCheck, CircleCheck, CircleAlert, Ban, Percent, IndianRupee, CalendarDays, Sparkles,
} from 'lucide-react';
import { adminDownload, adminFetch } from './lib/api';
import { uploadProductImage } from './lib/upload';
import {
  ChartCard, KpiTile, OrdersBarChart, RankedBars, RevenueTrendChart, StatusBreakdown, StockHealth,
  money, statusLabel, viz,
} from './components/charts';
import { EmptyState, Field, Modal, Pager, Pill, emptyPagination, statusTone, type Pagination } from './components/ui';
import { CatalogSetup } from './components/CatalogSetup';
import { OrderDetail } from './components/OrderDetail';

type Section = 'overview' | 'products' | 'catalog' | 'inventory' | 'stock-history' | 'orders' | 'customers' | 'coupons' | 'audit';
type Role = 'admin' | 'staff';
type Variant = { sku: string; price: number; stock: number; compareAtPrice?: number; attributes?: Record<string, string>; images?: Array<{ url: string; publicId?: string }> };
type VariantDraft = { sku: string; price: string; stock: string; compareAtPrice: string; attributes: string; imageUrl: string; imagePublicId?: string };
type Product = { _id: string; title: string; slug: string; description: string; basePrice: number; compareAtPrice?: number; status: string; isFeatured: boolean; categoryId: { _id: string; name: string } | string; brandId?: { _id: string; name: string } | string | null; variants: Variant[] };
type Order = { _id: string; orderNumber: string; status: string; createdAt: string; items: Array<{ title: string; sku: string; quantity: number }>; pricing: { grandTotal: number }; shippingAddress?: { fullName?: string; city?: string }; fulfillment?: { trackingNumber?: string; carrier?: string } };
type Coupon = { _id: string; code: string; discountType: 'flat' | 'percentage'; discountValue: number; minOrderValue: number; maxDiscount?: number; startDate: string; endDate: string; usageLimitGlobal?: number; usageLimitPerUser: number; isActive: boolean; showInOffers?: boolean; usedCount: number };
type Brand = { _id: string; name: string };
type LowStock = { productId: string; title: string; slug: string; sku: string; stock: number; threshold: number };
type Customer = { _id: string; name: string; email: string; isBlocked: boolean; createdAt: string };
type SalesSummary = { revenue: number; orders: number; averageOrderValue: number };
type InventoryRow = { productId: string; title: string; slug: string; productStatus: string; sku: string; attributes?: Record<string, string>; price: number; stock: number; lowStock: boolean };
type SalesPeriod = 'today' | 'last7Days' | 'last30Days';
type Dashboard = {
  overview: { totalRevenue: number; totalOrders: number; avgOrderValue: number; lowStockCount: number; pendingOrders: number; totalProducts: number; totalVariants: number; totalUnitsInStock: number; outOfStockCount: number };
  salesPeriods: Record<SalesPeriod, SalesSummary>;
  previousSalesPeriods: Record<SalesPeriod, SalesSummary>;
  inventory: InventoryRow[];
  salesTrend: Array<{ _id: string; revenue: number; orders: number }>;
  recentOrders: Order[];
  lowStockProducts: LowStock[];
  topProducts: Array<{ _id: string; title: string; salesCount: number }>;
  orderStatusBreakdown: Array<{ status: string; count: number }>;
  revenueByCategory: Array<{ name: string; revenue: number; units: number }>;
  customers: { total: number; newLast30Days: number; blocked: number };
  stockHealth: { healthy: number; low: number; out: number };
};
type Category = { _id: string; name: string; slug: string };
type InventoryLogEntry = { _id: string; sku: string; changeType: string; previousStock: number; changeQuantity: number; newStock: number; notes?: string; createdAt: string; productId?: { title?: string; slug?: string } | string; performedBy?: { name?: string; email?: string } | string };

const PAGE_SIZE = 25;
const toDateInput = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : '';
const todayInput = () => new Date().toISOString().slice(0, 10);
const errorText = (err: unknown, fallback: string) => err instanceof Error ? err.message : fallback;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard; group: string; hint: string; adminOnly?: boolean }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Insights', hint: 'Sales, orders and stock at a glance' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, group: 'Sales', hint: 'Fulfil, ship, invoice and refund orders' },
  { id: 'customers', label: 'Customers', icon: Users, group: 'Sales', hint: 'Search and manage customer accounts' },
  { id: 'coupons', label: 'Coupons', icon: Tag, group: 'Sales', hint: 'Discount codes and their usage' },
  { id: 'products', label: 'Products', icon: Package, group: 'Catalog', hint: 'Listings, variants, prices and images' },
  { id: 'catalog', label: 'Categories & brands', icon: FolderTree, group: 'Catalog', hint: 'How the storefront is organised' },
  { id: 'inventory', label: 'Inventory', icon: Boxes, group: 'Catalog', hint: 'Low-stock alerts and manual adjustments' },
  { id: 'stock-history', label: 'Stock history', icon: History, group: 'Catalog', hint: 'Every stock movement, newest first' },
  { id: 'audit', label: 'Audit log', icon: ClipboardList, group: 'Admin', hint: 'Who changed what, and when', adminOnly: true },
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
const orderStatuses = Object.keys(validNextStatuses);
const emptyVariant = (): VariantDraft => ({ sku: '', price: '', stock: '0', compareAtPrice: '', attributes: '', imageUrl: '' });

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
  const [navOpen, setNavOpen] = useState(false);
  const [trendDays, setTrendDays] = useState<7 | 30>(30);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogEntry[]>([]);
  const [shipTarget, setShipTarget] = useState<Order | null>(null);
  const [role, setRole] = useState<Role>(() => (localStorage.getItem('shopsense_admin_role') as Role) || 'staff');
  const [adminName, setAdminName] = useState(() => localStorage.getItem('shopsense_admin_name') || '');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [productPage, setProductPage] = useState<Pagination>(emptyPagination);
  const [orderPage, setOrderPage] = useState<Pagination>(emptyPagination);
  const [customerPage, setCustomerPage] = useState<Pagination>(emptyPagination);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadingVariant, setUploadingVariant] = useState<number | null>(null);
  const isAdmin = role === 'admin';

  const refresh = async (target = section, page?: number) => {
    if (!token) return;
    setLoading(true);
    setError('');
    const pageParams = (current: Pagination) => new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page ?? current.page) });
    try {
      if (target === 'overview') {
        const result = await adminFetch('/admin/dashboard');
        setDashboard(result.data);
      } else if (target === 'products') {
        const params = pageParams(productPage);
        if (search.trim()) params.set('search', search.trim());
        const [result, categoryResult, brandResult] = await Promise.all([
          adminFetch(`/admin/products?${params}`),
          adminFetch('/admin/categories'),
          adminFetch('/admin/brands'),
        ]);
        setProducts(result.data);
        setProductPage(result.pagination);
        setCategories(categoryResult.data);
        setBrands(brandResult.data);
      } else if (target === 'catalog') {
        setReloadKey((key) => key + 1);
      } else if (target === 'inventory') {
        const [result, productsResult] = await Promise.all([
          adminFetch(`/admin/inventory/low-stock?threshold=${threshold}`),
          adminFetch('/admin/products?limit=100'),
        ]);
        setLowStock(result.data);
        setProducts(productsResult.data);
      } else if (target === 'stock-history') {
        setInventoryLogs((await adminFetch('/admin/inventory-logs')).data);
      } else if (target === 'orders') {
        const params = pageParams(orderPage);
        if (orderStatusFilter) params.set('status', orderStatusFilter);
        if (orderSearch.trim()) params.set('search', orderSearch.trim());
        const result = await adminFetch(`/admin/orders?${params}`);
        setOrders(result.data);
        setOrderPage(result.pagination);
        setReloadKey((key) => key + 1);
      } else if (target === 'customers') {
        const params = pageParams(customerPage);
        if (customerSearch.trim()) params.set('search', customerSearch.trim());
        const result = await adminFetch(`/admin/customers?${params}`);
        setCustomers(result.data);
        setCustomerPage(result.pagination);
      } else if (target === 'coupons') {
        setCoupons((await adminFetch('/admin/coupons')).data);
      } else if (target === 'audit') {
        setAudit((await adminFetch('/admin/audit-logs')).data);
      }
    } catch (err) {
      setError(errorText(err, 'Could not load this section'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) void refresh(section); }, [token, section]);
  useEffect(() => { if (token && section === 'orders') void refresh('orders', 1); }, [orderStatusFilter]);
  useEffect(() => { if (token && section === 'inventory') void refresh('inventory'); }, [threshold]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!token) return;
    adminFetch('/auth/me')
      .then((result) => {
        const user = result.data?.user ?? result.data;
        if (user?.role === 'admin' || user?.role === 'staff') {
          setRole(user.role);
          localStorage.setItem('shopsense_admin_role', user.role);
        }
        if (user?.name) {
          setAdminName(user.name);
          localStorage.setItem('shopsense_admin_name', user.name);
        }
      })
      .catch(() => undefined);
  }, [token]);
  useEffect(() => {
    if (productDialog === false) return;
    if (!productDialog) {
      setVariantDrafts([{ ...emptyVariant(), attributes: 'option=Standard' }]);
      return;
    }
    setVariantDrafts(productDialog.variants.map((variant) => ({
      sku: variant.sku,
      price: String(variant.price),
      stock: String(variant.stock),
      compareAtPrice: String(variant.compareAtPrice || ''),
      attributes: Object.entries(variant.attributes || {}).map(([key, value]) => `${key}=${value}`).join(','),
      imageUrl: variant.images?.[0]?.url || '',
      imagePublicId: variant.images?.[0]?.publicId,
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
      localStorage.setItem('shopsense_admin_role', result.data.user.role);
      localStorage.setItem('shopsense_admin_name', result.data.user.name || '');
      setRole(result.data.user.role);
      setAdminName(result.data.user.name || '');
      setToken(result.data.accessToken);
    } catch (err) {
      setError(errorText(err, 'Sign in failed'));
    } finally { setLoading(false); }
  };

  const signOut = () => {
    ['shopsense_admin_token', 'shopsense_admin_role', 'shopsense_admin_name'].forEach((key) => localStorage.removeItem(key));
    setToken('');
    setDashboard(null);
    setSection('overview');
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = productDialog === false ? null : productDialog;
    const variants = variantDrafts.map((variant) => ({
      sku: variant.sku.trim(),
      attributes: Object.fromEntries(variant.attributes.split(',').map((attribute) => attribute.split('=').map((part) => part.trim())).filter((parts) => parts.length === 2 && parts[0])),
      price: Number(variant.price),
      compareAtPrice: Number(variant.compareAtPrice) || undefined,
      stock: Number(variant.stock),
      images: variant.imageUrl ? [{ url: variant.imageUrl, publicId: variant.imagePublicId, isPrimary: true }] : [],
    }));
    // The storefront lists and sorts products by basePrice, so keep it in sync with the cheapest variant.
    const cheapest = variants.reduce((best, variant) => variant.price < best.price ? variant : best, variants[0]);
    const payload = {
      title: String(form.get('title')).trim(),
      slug: String(form.get('slug')).trim(),
      description: String(form.get('description')),
      categoryId: String(form.get('categoryId')),
      brandId: String(form.get('brandId')) || null,
      basePrice: cheapest?.price ?? 0,
      compareAtPrice: cheapest?.compareAtPrice,
      status: String(form.get('status')),
      isFeatured: form.get('isFeatured') === 'on',
      variants,
    };
    try {
      await adminFetch(editing ? `/admin/products/${editing._id}` : '/admin/products', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      setProductDialog(false);
      setNotice(editing ? 'Product saved.' : 'Product created.');
      await refresh('products');
    } catch (err) { setError(errorText(err, 'Could not save product')); }
  };

  const archiveProduct = async (product: Product) => {
    if (!window.confirm(`Archive ${product.title}? It will be hidden from the storefront.`)) return;
    try {
      await adminFetch(`/admin/products/${product._id}`, { method: 'DELETE' });
      setNotice('Product archived.');
      await refresh('products');
    } catch (err) { setError(errorText(err, 'Could not archive product')); }
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
      await refresh(section === 'overview' ? 'overview' : 'inventory');
    } catch (err) { setError(errorText(err, 'Could not adjust stock')); }
  };

  const updateOrder = async (order: Order, status: string, fulfillment: { carrier?: string; trackingNumber?: string } = {}) => {
    if (status === 'SHIPPED' && !fulfillment.trackingNumber) {
      setShipTarget(order);
      return;
    }
    try {
      await adminFetch(`/admin/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...fulfillment }) });
      setNotice(`${order.orderNumber} marked as ${statusLabel(status).toLowerCase()}.`);
      await refresh(section === 'overview' ? 'overview' : 'orders');
    } catch (err) { setError(errorText(err, 'Could not update order')); }
  };

  const shipOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!shipTarget) return;
    const form = new FormData(event.currentTarget);
    const order = shipTarget;
    setShipTarget(null);
    await updateOrder(order, 'SHIPPED', {
      carrier: String(form.get('carrier')).trim(),
      trackingNumber: String(form.get('trackingNumber')).trim(),
    });
  };

  const downloadInvoice = async (order: { _id: string; orderNumber: string }) => {
    try {
      await adminDownload(`/admin/orders/${order._id}/invoice`, `${order.orderNumber}-invoice.pdf`);
    } catch (err) { setError(errorText(err, 'Could not download invoice')); }
  };

  const refundOrder = async (order: Order) => {
    if (!window.confirm(`Issue a full Razorpay refund for ${order.orderNumber}?`)) return;
    try {
      await adminFetch(`/admin/orders/${order._id}/refund`, { method: 'POST', body: JSON.stringify({ reason: 'Admin dashboard refund' }) });
      setNotice('Refund request accepted by payment provider.');
      await refresh(section === 'overview' ? 'overview' : 'orders');
    } catch (err) { setError(errorText(err, 'Refund failed')); }
  };

  const setBlocked = async (customer: Customer) => {
    if (!customer.isBlocked && !window.confirm(`Block ${customer.name}? They will be signed out and cannot place orders.`)) return;
    try {
      await adminFetch(`/admin/customers/${customer._id}/block`, { method: 'PATCH', body: JSON.stringify({ isBlocked: !customer.isBlocked }) });
      setNotice(customer.isBlocked ? 'Customer access restored.' : 'Customer blocked.');
      await refresh('customers');
    } catch (err) { setError(errorText(err, 'Could not update customer')); }
  };

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = couponDialog === false ? null : couponDialog;
    const optionalNumber = (name: string) => form.get(name) === '' ? undefined : Number(form.get(name));
    const payload = {
      code: String(form.get('code')).trim().toUpperCase(),
      discountType: String(form.get('discountType')),
      discountValue: Number(form.get('discountValue')),
      minOrderValue: Number(form.get('minOrderValue')) || 0,
      maxDiscount: optionalNumber('maxDiscount'),
      usageLimitGlobal: optionalNumber('usageLimitGlobal'),
      usageLimitPerUser: Number(form.get('usageLimitPerUser')) || 1,
      startDate: new Date(`${String(form.get('startDate'))}T00:00:00`).toISOString(),
      // End of the chosen day, so a coupon "expiring 31 Oct" works all of 31 Oct.
      endDate: new Date(`${String(form.get('endDate'))}T23:59:59`).toISOString(),
      isActive: form.get('isActive') === 'on',
      showInOffers: form.get('showInOffers') === 'on',
    };
    if (new Date(payload.endDate) <= new Date(payload.startDate)) {
      setError('Expiry date must be after the start date.');
      return;
    }
    try {
      await adminFetch(editing ? `/admin/coupons/${editing._id}` : '/admin/coupons', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      setCouponDialog(false);
      setNotice(editing ? 'Coupon updated.' : 'Coupon created.');
      await refresh('coupons');
    } catch (err) { setError(errorText(err, 'Could not save coupon')); }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    try {
      await adminFetch(`/admin/coupons/${coupon._id}`, { method: 'PUT', body: JSON.stringify({ isActive: !coupon.isActive }) });
      setNotice(coupon.isActive ? `${coupon.code} paused.` : `${coupon.code} activated.`);
      await refresh('coupons');
    } catch (err) { setError(errorText(err, 'Could not update coupon')); }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
    try {
      await adminFetch(`/admin/coupons/${coupon._id}`, { method: 'DELETE' });
      setNotice('Coupon deleted.');
      await refresh('coupons');
    } catch (err) { setError(errorText(err, 'Could not delete coupon')); }
  };

  const updateVariantDraft = (index: number, changes: Partial<VariantDraft>) => {
    setVariantDrafts((current) => current.map((variant, row) => row === index ? { ...variant, ...changes } : variant));
  };

  const uploadVariantImage = async (index: number, file?: File) => {
    if (!file) return;
    setUploadingVariant(index);
    try {
      const image = await uploadProductImage(file);
      updateVariantDraft(index, { imageUrl: image.url, imagePublicId: image.publicId });
    } catch (err) {
      setError(errorText(err, 'Image upload failed'));
    } finally { setUploadingVariant(null); }
  };

  const goToPage = (target: 'products' | 'orders' | 'customers', page: number) => {
    const setter = target === 'products' ? setProductPage : target === 'orders' ? setOrderPage : setCustomerPage;
    setter((current) => ({ ...current, page }));
    void refresh(target, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!token) return <LoginScreen email={email} password={password} error={error} loading={loading} onEmail={setEmail} onPassword={setPassword} onSubmit={login} />;

  const visibleSections = sections.filter((item) => !item.adminOnly || isAdmin);
  const current = sections.find((item) => item.id === section)!;
  const editingProduct = productDialog === false ? null : productDialog;
  const editingCoupon = couponDialog === false ? null : couponDialog;
  const selectedSales = dashboard?.salesPeriods[salesPeriod] || { revenue: 0, orders: 0, averageOrderValue: 0 };
  const salesPeriodLabel = salesPeriod === 'today' ? 'Today' : salesPeriod === 'last7Days' ? 'Last 7 days' : 'Last 30 days';
  const previousSales = dashboard?.previousSalesPeriods?.[salesPeriod] || { revenue: 0, orders: 0, averageOrderValue: 0 };
  const trendData = dashboard ? dashboard.salesTrend.slice(-trendDays) : [];
  const trendRevenue = trendData.reduce((sum, day) => sum + day.revenue, 0);
  const trendOrders = trendData.reduce((sum, day) => sum + day.orders, 0);
  const openSection = (id: Section) => { setSection(id); setError(''); setNotice(''); setNavOpen(false); };
  const visibleInventory = dashboard?.inventory.filter((item) => {
    const query = inventorySearch.trim().toLowerCase();
    return !query || item.title.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query);
  }) || [];
  const navGroups = [...new Set(visibleSections.map((item) => item.group))];
  const primaryAction = section === 'products'
    ? <button onClick={() => setProductDialog(null)} className="btn-primary"><Plus className="size-4" />New product</button>
    : section === 'coupons'
      ? <button onClick={() => setCouponDialog(null)} className="btn-primary"><Plus className="size-4" />New coupon</button>
      : null;

  return <div className="min-h-screen">
    {navOpen && <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}

    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${navOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
      <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-100 px-5">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-sm"><Sparkles className="size-4" /></span><div><p className="text-sm font-bold leading-tight text-slate-950">ShopSense</p><p className="text-[10px] font-medium text-slate-400">Admin console</p></div></div>
        <button onClick={() => setNavOpen(false)} aria-label="Close navigation" className="icon-btn lg:hidden"><X className="size-4" /></button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => <div key={group}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</p>
          <div className="space-y-0.5">{visibleSections.filter((item) => item.group === group).map(({ id, label, icon: ItemIcon }) => <button key={id} onClick={() => openSection(id)} aria-current={section === id ? 'page' : undefined} className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${section === id ? 'bg-emerald-50 text-emerald-900 shadow-[inset_2px_0_0_#047857]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><ItemIcon className={`size-4 shrink-0 ${section === id ? 'text-emerald-700' : 'text-slate-400'}`} /><span className="truncate">{label}</span>{id === 'orders' && (dashboard?.overview.pendingOrders ?? 0) > 0 && <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">{dashboard?.overview.pendingOrders}</span>}{id === 'inventory' && (dashboard?.lowStockProducts.length ?? 0) > 0 && <span className="ml-auto rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700">{dashboard?.lowStockProducts.length}</span>}</button>)}</div>
        </div>)}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(adminName || role)}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-900">{adminName || 'Signed in'}</p><p className="flex items-center gap-1 text-[10px] text-slate-500"><ShieldCheck className="size-3" />{isAdmin ? 'Administrator' : 'Staff · limited access'}</p></div>
          <button title="Sign out" onClick={signOut} className="icon-btn"><LogOut className="size-4" /></button>
        </div>
      </div>
    </aside>

    <div className="min-w-0 lg:pl-64">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setNavOpen(true)} aria-label="Open navigation" className="icon-btn size-9 lg:hidden"><Menu className="size-5" /></button>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold text-slate-950 sm:text-xl">{current.label}</h1><p className="hidden truncate text-xs text-slate-500 sm:block">{current.hint}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => void refresh()} title="Refresh" className="btn-secondary px-2.5 sm:px-3.5"><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Refresh</span></button>
            {primaryAction}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {error && <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><CircleAlert className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError('')} aria-label="Dismiss" className="icon-btn size-6 text-rose-700 hover:bg-rose-100"><X className="size-3.5" /></button></div>}

        {section === 'overview' && !dashboard && <OverviewSkeleton />}
        {section === 'overview' && dashboard && <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-slate-500">Paid & fulfilled orders · INR · vs previous {salesPeriod === 'today' ? 'day' : salesPeriodLabel.toLowerCase().replace('last ', '')}</p>
            <Segmented value={salesPeriod} onChange={setSalesPeriod} label="Sales period" options={[['today', 'Today'], ['last7Days', '7 days'], ['last30Days', '30 days']]} />
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiTile label={`${salesPeriodLabel} revenue`} value={money(selectedSales.revenue)} current={selectedSales.revenue} previous={previousSales.revenue} icon={CircleDollarSign} />
            <KpiTile label={`${salesPeriodLabel} paid orders`} value={selectedSales.orders} current={selectedSales.orders} previous={previousSales.orders} icon={ShoppingCart} />
            <KpiTile label="Average order value" value={money(selectedSales.averageOrderValue)} current={selectedSales.averageOrderValue} previous={previousSales.averageOrderValue} icon={CreditCard} />
            <KpiTile label="Awaiting payment" value={dashboard.overview.pendingOrders} hint="Orders with pending payment" icon={Clock3} />
          </div>

          <div className="card grid grid-cols-2 divide-slate-100 sm:grid-cols-3 xl:grid-cols-6 xl:divide-x">
            {[
              { label: 'Customers', value: dashboard.customers?.total ?? 0 },
              { label: 'New (30 days)', value: dashboard.customers?.newLast30Days ?? 0 },
              { label: 'Products', value: dashboard.overview.totalProducts },
              { label: 'Sellable variants', value: dashboard.overview.totalVariants },
              { label: 'Units in stock', value: dashboard.overview.totalUnitsInStock.toLocaleString('en-IN') },
              { label: 'Out of stock', value: dashboard.overview.outOfStockCount, alert: dashboard.overview.outOfStockCount > 0 },
            ].map(({ label, value, alert }) => <div key={label} className="min-w-0 px-4 py-3"><p className="truncate text-[11px] font-medium text-slate-500">{label}</p><p className={`mt-0.5 text-lg font-bold tabular-nums ${alert ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p></div>)}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Revenue"
              subtitle={`${money(trendRevenue)} from ${trendOrders} paid orders · last ${trendDays} days (UTC)`}
              action={<Segmented value={trendDays} onChange={setTrendDays} label="Trend range" options={[[7, '7D'], [30, '30D']]} />}
            >
              <RevenueTrendChart data={trendData} />
              <p className="mb-1 mt-5 text-xs font-bold text-slate-950">Paid orders per day</p>
              <OrdersBarChart data={trendData} />
            </ChartCard>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
              <ChartCard title="Order pipeline" subtitle="Orders created in the last 30 days"><StatusBreakdown rows={dashboard.orderStatusBreakdown || []} /></ChartCard>
              <ChartCard title="Stock health" subtitle={`${dashboard.overview.totalVariants} variants across ${dashboard.overview.totalProducts} products`}><StockHealth {...(dashboard.stockHealth || { healthy: 0, low: 0, out: 0 })} /></ChartCard>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue by category" subtitle="Paid item revenue · last 30 days">
              <RankedBars rows={(dashboard.revenueByCategory || []).map((row) => ({ label: row.name, value: row.revenue, detail: `${row.units} units` }))} color={viz.revenue} format={money} empty="Category revenue appears after paid orders." />
            </ChartCard>
            <ChartCard title="Top-selling products" subtitle="All-time units sold">
              <RankedBars rows={dashboard.topProducts.map((product) => ({ label: product.title, value: product.salesCount }))} color={viz.orders} format={(value) => `${value} sold`} empty="Sales leaders appear after completed orders." />
            </ChartCard>
          </div>

          <ChartCard title="Low-stock alerts" subtitle="Variants at or below 5 units · click one to restock" action={<button onClick={() => openSection('inventory')} className="btn-ghost text-emerald-800">Manage inventory</button>}>
            {dashboard.lowStockProducts.length
              ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{dashboard.lowStockProducts.slice(0, 9).map((item) => <button key={`${item.productId}-${item.sku}`} onClick={() => { setStockTarget(item); setStockDelta(1); }} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs transition hover:border-emerald-300 hover:bg-emerald-50/40"><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{item.title}</span><span className="block truncate font-mono text-[10px] text-slate-500">{item.sku}</span></span>{item.stock === 0 ? <Pill tone="red">Out</Pill> : <Pill tone="amber">{item.stock} left</Pill>}</button>)}</div>
              : <p className="flex items-center gap-2 text-sm text-slate-500"><CircleCheck className="size-4 text-emerald-600" />Every variant has more than 5 units.</p>}
          </ChartCard>

          <section className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><div><h2 className="text-sm font-bold text-slate-950">Stock remaining · every variant</h2><p className="mt-0.5 text-[11px] text-slate-500">{dashboard.inventory.length} SKUs across {dashboard.overview.totalProducts} products</p></div><div className="search-box w-full sm:w-64"><Search className="size-3.5 shrink-0 text-slate-400" /><input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Search product or SKU" className="w-full min-w-0 bg-transparent py-2 text-xs outline-none" /></div></header>
            <div className="max-h-[420px] overflow-auto"><table className="data-table min-w-[720px]"><thead className="sticky top-0"><tr><th>Product</th><th>Variant / SKU</th><th>Price</th><th>Status</th><th>Remaining</th><th /></tr></thead><tbody>{visibleInventory.map((item) => <tr key={`${item.productId}-${item.sku}`}><td className="max-w-64"><p className="truncate font-semibold text-slate-900">{item.title}</p><p className="text-[10px] text-slate-400">{item.slug}</p></td><td><p>{Object.values(item.attributes || {}).join(' / ') || 'Standard'}</p><p className="font-mono text-[10px] text-slate-500">{item.sku}</p></td><td className="tabular-nums">{money(item.price)}</td><td><Pill tone={item.productStatus === 'published' ? 'green' : 'slate'}>{statusLabel(item.productStatus)}</Pill></td><td>{item.stock === 0 ? <Pill tone="red">Out of stock</Pill> : item.lowStock ? <Pill tone="amber">{item.stock} · low</Pill> : <span className="font-semibold tabular-nums">{item.stock}</span>}</td><td className="text-right"><button onClick={() => { setStockTarget({ productId: item.productId, title: item.title, slug: item.slug, sku: item.sku, stock: item.stock, threshold: 5 }); setStockDelta(1); }} className="btn-ghost text-emerald-800">Adjust</button></td></tr>)}</tbody></table>{!visibleInventory.length && <EmptyState title="No matching inventory" />}</div>
          </section>

          <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-950">Recent orders</h2><button onClick={() => openSection('orders')} className="btn-ghost text-emerald-800">View all</button></div><OrderTable orders={dashboard.recentOrders} isAdmin={isAdmin} onView={(order) => setDetailOrderId(order._id)} onStatus={updateOrder} onRefund={refundOrder} onInvoice={downloadInvoice} /></section>
        </div>}

        {section === 'products' && <section className="card overflow-hidden">
          <form onSubmit={(event) => { event.preventDefault(); goToPage('products', 1); }} className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="search-box w-full sm:max-w-md"><Search className="size-4 shrink-0 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or SKU, press Enter" className="w-full min-w-0 bg-transparent py-2.5 text-sm outline-none" /></div>
            <p className="text-xs text-slate-500">{productPage.total} products</p>
          </form>
          {products.length ? <>
            <ul className="divide-y divide-slate-100 md:hidden">{products.map((product) => <li key={product._id} className="flex gap-3 p-4"><ProductThumb product={product} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold">{product.title}</p><ProductStatus status={product.status} /></div><p className="text-xs text-slate-500">{refName(product.categoryId)}{refName(product.brandId) !== '—' ? ` · ${refName(product.brandId)}` : ''}</p><div className="mt-2 flex items-center justify-between gap-2"><p className="text-sm font-bold">{priceRange(product)}</p><StockSummary product={product} threshold={threshold} /></div><div className="mt-2 flex gap-1"><button onClick={() => setProductDialog(product)} className="btn-secondary px-2.5 py-1.5"><Pencil className="size-3.5" />Edit</button>{isAdmin && product.status !== 'archived' && <button onClick={() => void archiveProduct(product)} className="btn-danger px-2.5 py-1.5"><Archive className="size-3.5" />Archive</button>}</div></div></li>)}</ul>
            <div className="hidden overflow-x-auto md:block"><table className="data-table min-w-[820px]"><thead><tr><th>Product</th><th>Category / brand</th><th>Variants</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead><tbody>{products.map((product) => <tr key={product._id}><td className="max-w-72"><div className="flex items-center gap-3"><ProductThumb product={product} /><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{product.title}{product.isFeatured && <Sparkles className="ml-1 inline size-3 text-amber-500" aria-label="Featured" />}</p><p className="truncate text-[10px] text-slate-400">/{product.slug}</p></div></div></td><td><p>{refName(product.categoryId)}</p><p className="text-[10px] text-slate-400">{refName(product.brandId)}</p></td><td className="tabular-nums">{product.variants.length}</td><td className="font-semibold tabular-nums">{priceRange(product)}</td><td><StockSummary product={product} threshold={threshold} /></td><td><ProductStatus status={product.status} /></td><td><div className="flex justify-end gap-1"><button onClick={() => setProductDialog(product)} title="Edit" className="icon-btn"><Pencil className="size-3.5" /></button>{isAdmin && product.status !== 'archived' && <button onClick={() => void archiveProduct(product)} title="Archive" className="icon-btn hover:bg-rose-50 hover:text-rose-700"><Archive className="size-3.5" /></button>}</div></td></tr>)}</tbody></table></div>
            <Pager pagination={productPage} onPage={(page) => goToPage('products', page)} />
          </> : !loading && <EmptyState title="No products found" hint={search ? 'Try a different search.' : 'Create your first product to start selling.'} action={<button onClick={() => setProductDialog(null)} className="btn-primary"><Plus className="size-4" />New product</button>} />}
        </section>}

        {section === 'catalog' && <CatalogSetup isAdmin={isAdmin} reloadKey={reloadKey} onNotice={setNotice} onError={setError} />}

        {section === 'inventory' && <div className="space-y-4">
          <section className="card overflow-hidden">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4">
              <div><h2 className="text-sm font-bold text-slate-950">Low-stock variants <span className="font-normal text-slate-400">{lowStock.length}</span></h2><p className="mt-0.5 text-[11px] text-slate-500">Alerts are calculated per variant.</p></div>
              <label className="label flex items-center gap-2">Alert at or below<input type="number" min="0" max="1000" value={threshold} onChange={(event) => setThreshold(Math.max(0, Number(event.target.value)))} className="input w-20 py-1.5" />units</label>
            </header>
            {lowStock.length ? <div className="overflow-x-auto"><table className="data-table min-w-[600px]"><thead><tr><th>Product</th><th>SKU</th><th>Available</th><th /></tr></thead><tbody>{lowStock.map((item) => <tr key={`${item.productId}-${item.sku}`}><td className="font-semibold text-slate-900">{item.title}</td><td className="font-mono text-[11px]">{item.sku}</td><td>{item.stock === 0 ? <Pill tone="red">Out of stock</Pill> : <Pill tone="amber">{item.stock} left</Pill>}</td><td className="text-right"><button onClick={() => { setStockTarget(item); setStockDelta(Math.max(1, threshold - item.stock + 1)); }} className="btn-secondary px-2.5 py-1.5"><Plus className="size-3.5" />Restock</button></td></tr>)}</tbody></table></div>
              : <EmptyState title="Nothing is running low" hint={`No variant has ${threshold} or fewer units.`} />}
          </section>
          <section className="card p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-950">Manual adjustment</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Use a negative number to remove stock (damage, loss, returns to supplier).</p>
            <form onSubmit={adjustInventory} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.5fr)_auto] sm:items-end">
              <label className="label">Product / variant<select required value={stockTarget ? `${stockTarget.productId}|${stockTarget.sku}` : ''} onChange={(event) => { const [id, sku] = event.target.value.split('|'); const product = products.find((item) => item._id === id); const variant = product?.variants.find((item) => item.sku === sku); if (product && variant) setStockTarget({ productId: id, title: product.title, slug: product.slug, sku, stock: variant.stock, threshold }); }} className="input mt-1.5"><option value="">Choose variant</option>{products.flatMap((product) => product.variants.map((variant) => <option key={`${product._id}-${variant.sku}`} value={`${product._id}|${variant.sku}`}>{product.title} · {variant.sku} · {variant.stock} in stock</option>))}</select></label>
              <label className="label">Change (+/−)<input type="number" required value={stockDelta} onChange={(event) => setStockDelta(Number(event.target.value))} className="input mt-1.5" /></label>
              <label className="label">Reason<input value={stockNotes} onChange={(event) => setStockNotes(event.target.value)} placeholder="e.g. New batch from supplier" className="input mt-1.5" /></label>
              <button disabled={!stockTarget} className="btn-primary py-2.5">Save adjustment</button>
            </form>
          </section>
        </div>}

        {section === 'orders' && <section className="space-y-3">
          <form onSubmit={(event) => { event.preventDefault(); goToPage('orders', 1); }} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="search-box flex-1"><Search className="size-4 shrink-0 text-slate-400" /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Order number, customer or city" className="w-full min-w-0 bg-transparent py-2.5 text-sm outline-none" /></div>
            <select aria-label="Filter by status" value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)} className="input sm:w-48">
              <option value="">All statuses</option>
              {orderStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <button className="btn-primary py-2.5"><Search className="size-3.5" />Search</button>
          </form>
          <OrderTable orders={orders} isAdmin={isAdmin} onView={(order) => setDetailOrderId(order._id)} onStatus={updateOrder} onRefund={refundOrder} onInvoice={downloadInvoice} footer={<Pager pagination={orderPage} onPage={(page) => goToPage('orders', page)} />} />
        </section>}

        {section === 'stock-history' && <section className="card overflow-hidden">{inventoryLogs.length ? <div className="overflow-x-auto"><table className="data-table min-w-[820px]"><thead><tr><th>When</th><th>Product / SKU</th><th>Type</th><th className="text-right">Change</th><th className="text-right">Stock</th><th>By / notes</th></tr></thead><tbody>{inventoryLogs.map((log) => {
          const product = typeof log.productId === 'object' ? log.productId : undefined;
          const actor = typeof log.performedBy === 'object' ? log.performedBy : undefined;
          return <tr key={log._id}><td className="whitespace-nowrap text-slate-500">{new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="max-w-64"><p className="truncate font-semibold text-slate-900">{product?.title || '—'}</p><p className="font-mono text-[10px] text-slate-500">{log.sku}</p></td><td><Pill tone={log.changeQuantity >= 0 ? 'green' : 'slate'}>{statusLabel(log.changeType)}</Pill></td><td className={`text-right font-bold tabular-nums ${log.changeQuantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{log.changeQuantity > 0 ? '+' : ''}{log.changeQuantity}</td><td className="whitespace-nowrap text-right tabular-nums text-slate-500">{log.previousStock} → <strong className="text-slate-950">{log.newStock}</strong></td><td className="max-w-64"><p className="truncate">{actor?.name || actor?.email || 'System'}</p>{log.notes && <p className="truncate text-slate-500">{log.notes}</p>}</td></tr>;
        })}</tbody></table></div> : !loading && <EmptyState title="No stock movements yet" hint="Orders, refunds and manual adjustments show up here." />}</section>}

        {section === 'customers' && <section className="card overflow-hidden">
          <form onSubmit={(event) => { event.preventDefault(); goToPage('customers', 1); }} className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="search-box w-full sm:max-w-md"><Search className="size-4 shrink-0 text-slate-400" /><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name or email, press Enter" className="w-full min-w-0 bg-transparent py-2.5 text-sm outline-none" /></div>
            <p className="text-xs text-slate-500">{customerPage.total} customers</p>
          </form>
          {customers.length ? <>
            <ul className="divide-y divide-slate-100">{customers.map((customer) => <li key={customer._id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/70">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${customer.isBlocked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>{initials(customer.name)}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{customer.name}</p><p className="truncate text-xs text-slate-500">{customer.email}</p></div>
              <p className="hidden text-xs text-slate-500 sm:block">Joined {new Date(customer.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
              {customer.isBlocked ? <Pill tone="red">Blocked</Pill> : <Pill tone="green">Active</Pill>}
              {isAdmin && <button onClick={() => void setBlocked(customer)} className={customer.isBlocked ? 'btn-secondary px-2.5 py-1.5' : 'btn-danger px-2.5 py-1.5'}>{customer.isBlocked ? 'Unblock' : <><Ban className="size-3.5" /><span className="hidden sm:inline">Block</span></>}</button>}
            </li>)}</ul>
            <Pager pagination={customerPage} onPage={(page) => goToPage('customers', page)} />
          </> : !loading && <EmptyState title="No customers found" hint={customerSearch ? 'Try a different name or email.' : undefined} />}
        </section>}

        {section === 'coupons' && (coupons.length
          ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{coupons.map((coupon) => <CouponCard key={coupon._id} coupon={coupon} isAdmin={isAdmin} onEdit={() => setCouponDialog(coupon)} onToggle={() => void toggleCoupon(coupon)} onDelete={() => void deleteCoupon(coupon)} />)}</div>
          : !loading && <div className="card"><EmptyState title="No coupons yet" hint="Create a discount code to run a promotion." action={<button onClick={() => setCouponDialog(null)} className="btn-primary"><Plus className="size-4" />New coupon</button>} /></div>)}

        {section === 'audit' && isAdmin && <section className="card overflow-hidden">{audit.length ? <div className="overflow-x-auto"><table className="data-table min-w-[720px]"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th><th>Reference</th></tr></thead><tbody>{audit.map((entry, index) => <tr key={String(entry._id || index)}><td className="whitespace-nowrap text-slate-500">{entry.createdAt ? new Date(String(entry.createdAt)).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td><td>{String(entry.userEmail || '—')}</td><td><Pill tone={String(entry.action).includes('DELETE') || String(entry.action).includes('BLOCK') || String(entry.action).includes('REFUND') ? 'red' : 'blue'}>{statusLabel(String(entry.action || '—'))}</Pill></td><td>{String(entry.resourceType || '—')}</td><td className="font-mono text-[11px]">{String(entry.resourceId || '—')}</td></tr>)}</tbody></table></div> : !loading && <EmptyState title="No audit entries" />}</section>}
      </main>
    </div>

    {notice && <div role="status" className="fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl sm:left-auto sm:right-6 sm:translate-x-0"><CircleCheck className="size-4 shrink-0 text-emerald-400" /><span className="flex-1">{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss" className="grid size-6 place-items-center rounded text-slate-400 hover:text-white"><X className="size-3.5" /></button></div>}

    <OrderDetail orderId={detailOrderId} reloadKey={reloadKey} onClose={() => setDetailOrderId(null)} onInvoice={downloadInvoice} />

    <Modal open={productDialog !== false} onClose={() => setProductDialog(false)} title={editingProduct ? 'Edit product' : 'New product'} subtitle={editingProduct ? `/${editingProduct.slug}` : 'Add a listing with one or more variants'} wide>
      <form onSubmit={saveProduct} className="space-y-6">
        <FormSection title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="title" label="Product title" required defaultValue={editingProduct?.title || ''} />
            <Field name="slug" label="URL slug" required defaultValue={editingProduct?.slug || ''} placeholder="noise-cancelling-headphones" />
            <label className="label sm:col-span-2">Description<span className="text-rose-600"> *</span><textarea name="description" required defaultValue={editingProduct?.description || ''} rows={3} className="input mt-1.5" /></label>
          </div>
        </FormSection>
        <FormSection title="Organisation">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="label">Category<span className="text-rose-600"> *</span><select required name="categoryId" defaultValue={editingProduct ? refId(editingProduct.categoryId) : ''} className="input mt-1.5"><option value="">Select category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
            <label className="label">Brand<select name="brandId" defaultValue={editingProduct ? refId(editingProduct.brandId) : ''} className="input mt-1.5"><option value="">No brand</option>{brands.map((brand) => <option key={brand._id} value={brand._id}>{brand.name}</option>)}</select></label>
            <label className="label">Status<select name="status" defaultValue={editingProduct?.status || 'published'} className="input mt-1.5"><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-3"><input type="checkbox" name="isFeatured" defaultChecked={editingProduct?.isFeatured || false} className="size-4 accent-emerald-700" />Feature on the storefront home page</label>
          </div>
        </FormSection>
        <FormSection title="Variants, pricing & stock" action={<button type="button" onClick={() => setVariantDrafts((current) => [...current, emptyVariant()])} className="btn-secondary px-2.5 py-1.5"><Plus className="size-3.5" />Add variant</button>}>
          <div className="space-y-3">{variantDrafts.map((variant, index) => <div key={`variant-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[96px_minmax(0,1fr)]">
            <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-stretch">
              <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white sm:size-24">
                {variant.imageUrl ? <img src={variant.imageUrl} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5 text-slate-300" />}
                {uploadingVariant === index && <span className="absolute inset-0 grid place-items-center bg-white/80"><Loader2 className="size-5 animate-spin text-emerald-700" /></span>}
              </div>
              <label className="btn-secondary cursor-pointer px-2 py-1.5 text-[11px]"><ImagePlus className="size-3.5" />Upload<input type="file" accept="image/*" className="sr-only" disabled={uploadingVariant !== null} onChange={(event) => { void uploadVariantImage(index, event.target.files?.[0]); event.target.value = ''; }} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="label">SKU<span className="text-rose-600"> *</span><input required value={variant.sku} onChange={(event) => updateVariantDraft(index, { sku: event.target.value })} className="input mt-1.5 font-mono text-xs" /></label>
              <label className="label sm:col-span-2">Attributes<input value={variant.attributes} onChange={(event) => updateVariantDraft(index, { attributes: event.target.value })} placeholder="color=Black, size=M" className="input mt-1.5" /></label>
              <label className="label">Price (₹)<span className="text-rose-600"> *</span><input type="number" min="0" required value={variant.price} onChange={(event) => updateVariantDraft(index, { price: event.target.value })} className="input mt-1.5" /></label>
              <label className="label">Compare-at (₹)<input type="number" min="0" value={variant.compareAtPrice} onChange={(event) => updateVariantDraft(index, { compareAtPrice: event.target.value })} className="input mt-1.5" /></label>
              <div className="flex items-end gap-2"><label className="label flex-1">Stock<span className="text-rose-600"> *</span><input type="number" min="0" required value={variant.stock} onChange={(event) => updateVariantDraft(index, { stock: event.target.value })} className="input mt-1.5" /></label>{variantDrafts.length > 1 && <button type="button" title="Remove variant" onClick={() => setVariantDrafts((current) => current.filter((_, row) => row !== index))} className="icon-btn mb-0.5 size-9 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="size-4" /></button>}</div>
              <label className="label sm:col-span-3">Image URL<input type="url" value={variant.imageUrl} onChange={(event) => updateVariantDraft(index, { imageUrl: event.target.value, imagePublicId: undefined })} placeholder="Upload above, or paste an https:// link" className="input mt-1.5 text-xs" /></label>
            </div>
          </div>)}</div>
          <p className="mt-2 text-[11px] text-slate-500">The listing price shown on the storefront is the cheapest variant.</p>
        </FormSection>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setProductDialog(false)} className="btn-secondary">Cancel</button><button disabled={uploadingVariant !== null} className="btn-primary">Save product</button></div>
      </form>
    </Modal>

    <Modal open={couponDialog !== false} onClose={() => setCouponDialog(false)} title={editingCoupon ? `Edit ${editingCoupon.code}` : 'New coupon'} subtitle={editingCoupon ? `Used ${editingCoupon.usedCount} time${editingCoupon.usedCount === 1 ? '' : 's'}` : 'Customers enter this code at checkout'}>
      <form onSubmit={saveCoupon} className="grid gap-4 sm:grid-cols-2">
        <Field name="code" label="Coupon code" required defaultValue={editingCoupon?.code || ''} placeholder="DIWALI20" />
        <label className="label">Discount type<select name="discountType" defaultValue={editingCoupon?.discountType || 'percentage'} className="input mt-1.5"><option value="percentage">Percentage off</option><option value="flat">Flat amount off</option></select></label>
        <Field name="discountValue" label="Discount value" type="number" min="1" required defaultValue={editingCoupon ? String(editingCoupon.discountValue) : ''} />
        <Field name="maxDiscount" label="Maximum discount (₹)" type="number" min="0" defaultValue={editingCoupon?.maxDiscount !== undefined ? String(editingCoupon.maxDiscount) : ''} hint="Caps percentage coupons. Leave empty for no cap." />
        <Field name="minOrderValue" label="Minimum order value (₹)" type="number" min="0" defaultValue={editingCoupon ? String(editingCoupon.minOrderValue) : '0'} />
        <Field name="usageLimitPerUser" label="Uses per customer" type="number" min="1" defaultValue={String(editingCoupon?.usageLimitPerUser ?? 1)} />
        <Field name="usageLimitGlobal" label="Total uses allowed" type="number" min="1" defaultValue={editingCoupon?.usageLimitGlobal !== undefined ? String(editingCoupon.usageLimitGlobal) : ''} hint="Leave empty for unlimited." />
        <div />
        <Field name="startDate" label="Starts on" type="date" required defaultValue={editingCoupon ? toDateInput(editingCoupon.startDate) : todayInput()} />
        <Field name="endDate" label="Expires on" type="date" required defaultValue={toDateInput(editingCoupon?.endDate)} />
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" name="isActive" defaultChecked={editingCoupon?.isActive ?? true} className="size-4 accent-emerald-700" />Active — customers can use this code</label>
        <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" name="showInOffers" defaultChecked={editingCoupon?.showInOffers ?? false} className="mt-0.5 size-4 accent-emerald-700" /><span>Show on storefront offers<span className="block font-normal text-slate-500">Advertised on the home page and cart. Leave off for private codes you share yourself.</span></span></label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setCouponDialog(false)} className="btn-secondary">Cancel</button><button className="btn-primary">Save coupon</button></div>
      </form>
    </Modal>

    <Modal open={Boolean(shipTarget)} onClose={() => setShipTarget(null)} title={`Ship ${shipTarget?.orderNumber || 'order'}`} subtitle="Tracking details are saved on the order and shown to the customer.">
      <form onSubmit={shipOrder} className="grid gap-4 sm:grid-cols-2">
        <Field name="carrier" label="Carrier" required defaultValue={shipTarget?.fulfillment?.carrier || ''} placeholder="Delhivery, BlueDart…" />
        <Field name="trackingNumber" label="Tracking number" required defaultValue={shipTarget?.fulfillment?.trackingNumber || ''} />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setShipTarget(null)} className="btn-secondary">Cancel</button><button className="btn-primary"><Truck className="size-4" />Mark as shipped</button></div>
      </form>
    </Modal>

    <Modal open={Boolean(stockTarget)} onClose={() => setStockTarget(null)} title="Adjust stock" subtitle={stockTarget ? `${stockTarget.title} · ${stockTarget.sku}` : undefined}>
      <form onSubmit={adjustInventory} className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Current', stockTarget?.stock ?? 0], ['Change', `${stockDelta > 0 ? '+' : ''}${stockDelta || 0}`], ['After', (stockTarget?.stock ?? 0) + (Number(stockDelta) || 0)]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p><p className={`mt-0.5 text-lg font-bold tabular-nums ${label === 'After' && Number(value) < 0 ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p></div>)}
        </div>
        <label className="label">Change quantity<input type="number" required value={stockDelta} onChange={(event) => setStockDelta(Number(event.target.value))} className="input mt-1.5" /><span className="mt-1 block text-[10px] font-normal text-slate-400">Use a negative number to reduce stock.</span></label>
        <label className="label">Reason<input value={stockNotes} onChange={(event) => setStockNotes(event.target.value)} placeholder="e.g. New batch from supplier" className="input mt-1.5" /></label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setStockTarget(null)} className="btn-secondary">Cancel</button><button disabled={(stockTarget?.stock ?? 0) + (Number(stockDelta) || 0) < 0} className="btn-primary">Apply adjustment</button></div>
      </form>
    </Modal>
  </div>;
}

function LoginScreen({ email, password, error, loading, onEmail, onPassword, onSubmit }: { email: string; password: string; error: string; loading: boolean; onEmail: (value: string) => void; onPassword: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return <main className="grid min-h-screen lg:grid-cols-2">
    <section className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-2.5"><span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><Sparkles className="size-5" /></span><p className="text-lg font-bold">ShopSense</p></div>
      <div className="max-w-md">
        <h2 className="text-4xl font-bold leading-tight">Run your whole store from one place.</h2>
        <p className="mt-4 text-sm leading-relaxed text-emerald-100/80">Track sales as they happen, ship orders with tracking, keep stock healthy and manage your catalogue — on desktop or phone.</p>
        <ul className="mt-8 space-y-3 text-sm text-emerald-50/90">{['Live revenue, order and stock analytics', 'Invoices, shipping and refunds in a click', 'Role-based access for your staff'].map((line) => <li key={line} className="flex items-center gap-2"><CircleCheck className="size-4 text-emerald-300" />{line}</li>)}</ul>
      </div>
      <p className="text-xs text-emerald-100/50">© {new Date().getFullYear()} ShopSense AI</p>
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-emerald-500/20 blur-3xl" />
    </section>
    <section className="grid place-items-center p-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-emerald-700 text-white"><Sparkles className="size-5" /></span><p className="text-lg font-bold">ShopSense</p></div>
        <h1 className="text-2xl font-bold text-slate-950">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with an admin or staff account.</p>
        {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</p>}
        <label className="label mt-6">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => onEmail(event.target.value)} className="input mt-1.5 py-2.5" placeholder="you@store.com" /></label>
        <label className="label mt-4">Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => onPassword(event.target.value)} className="input mt-1.5 py-2.5" /></label>
        <button disabled={loading} className="btn-primary mt-6 w-full py-3 text-sm">{loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  </main>;
}

function Segmented<T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: Array<[T, string]>; label: string }) {
  return <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm" role="group" aria-label={label}>
    {options.map(([option, text]) => <button key={String(option)} type="button" onClick={() => onChange(option)} aria-pressed={value === option} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${value === option ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{text}</button>)}
  </div>;
}

function FormSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>{action}</div>{children}</section>;
}

function OverviewSkeleton() {
  const block = 'animate-pulse rounded-xl bg-slate-200/70';
  return <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className={`${block} h-28`} />)}</div>
    <div className={`${block} h-16`} />
    <div className="grid gap-4 xl:grid-cols-3"><div className={`${block} h-96 xl:col-span-2`} /><div className={`${block} h-96`} /></div>
  </div>;
}

const refName = (ref: { name: string } | string | null | undefined) => ref && typeof ref === 'object' ? ref.name : '—';
const refId = (ref: { _id: string } | string | null | undefined) => ref && typeof ref === 'object' ? ref._id : ref || '';

function priceRange(product: Product) {
  const prices = product.variants.map((variant) => variant.price);
  if (!prices.length) return money(product.basePrice);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? money(low) : `${money(low)} – ${money(high)}`;
}

function ProductThumb({ product }: { product: Product }) {
  const url = product.variants.find((variant) => variant.images?.[0]?.url)?.images?.[0]?.url;
  return url
    ? <img src={url} alt="" className="size-11 shrink-0 rounded-lg border border-slate-200 object-cover" />
    : <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300"><Package className="size-4" /></span>;
}

function ProductStatus({ status }: { status: string }) {
  return <Pill tone={status === 'published' ? 'green' : status === 'draft' ? 'amber' : 'slate'}>{statusLabel(status)}</Pill>;
}

function StockSummary({ product, threshold }: { product: Product; threshold: number }) {
  const total = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  const out = product.variants.filter((variant) => variant.stock === 0).length;
  const low = product.variants.filter((variant) => variant.stock > 0 && variant.stock <= threshold).length;
  if (out === product.variants.length) return <Pill tone="red">Out of stock</Pill>;
  return <span className="inline-flex flex-wrap items-center gap-1"><span className="font-semibold tabular-nums">{total}</span>{out > 0 && <Pill tone="red">{out} out</Pill>}{low > 0 && <Pill tone="amber">{low} low</Pill>}</span>;
}

function CouponCard({ coupon, isAdmin, onEdit, onToggle, onDelete }: { coupon: Coupon; isAdmin: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const now = Date.now();
  const expired = new Date(coupon.endDate).getTime() < now;
  const scheduled = new Date(coupon.startDate).getTime() > now;
  const exhausted = coupon.usageLimitGlobal !== undefined && coupon.usedCount >= coupon.usageLimitGlobal;
  const state = !coupon.isActive ? { label: 'Paused', tone: 'slate' as const } : expired ? { label: 'Expired', tone: 'red' as const } : exhausted ? { label: 'Used up', tone: 'red' as const } : scheduled ? { label: 'Scheduled', tone: 'blue' as const } : { label: 'Live', tone: 'green' as const };
  const usagePct = coupon.usageLimitGlobal ? Math.min(100, coupon.usedCount / coupon.usageLimitGlobal * 100) : 0;
  const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return <article className={`card flex flex-col overflow-hidden ${state.label === 'Live' ? '' : 'opacity-90'}`}>
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-slate-200 p-4">
      <div className="min-w-0">
        <p className="truncate font-mono text-lg font-bold tracking-wider text-slate-950">{coupon.code}</p>
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-emerald-800">{coupon.discountType === 'percentage' ? <><Percent className="size-3.5" />{coupon.discountValue}% off</> : <><IndianRupee className="size-3.5" />{coupon.discountValue.toLocaleString('en-IN')} off</>}{coupon.maxDiscount ? <span className="font-normal text-slate-500"> · up to {money(coupon.maxDiscount)}</span> : null}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1"><Pill tone={state.tone}>{state.label}</Pill>{coupon.showInOffers && <Pill tone="violet">On storefront</Pill>}</div>
    </div>
    <dl className="grid flex-1 grid-cols-2 gap-3 p-4 text-xs">
      <div><dt className="text-slate-500">Minimum order</dt><dd className="mt-0.5 font-semibold text-slate-900">{coupon.minOrderValue ? money(coupon.minOrderValue) : 'None'}</dd></div>
      <div><dt className="text-slate-500">Per customer</dt><dd className="mt-0.5 font-semibold text-slate-900">{coupon.usageLimitPerUser}×</dd></div>
      <div className="col-span-2"><dt className="flex items-center gap-1 text-slate-500"><CalendarDays className="size-3" />Valid</dt><dd className="mt-0.5 font-semibold text-slate-900">{date(coupon.startDate)} → {date(coupon.endDate)}</dd></div>
      <div className="col-span-2">
        <dt className="flex justify-between text-slate-500"><span>Redemptions</span><span className="font-semibold text-slate-900">{coupon.usedCount}{coupon.usageLimitGlobal ? ` / ${coupon.usageLimitGlobal}` : ''}</span></dt>
        {coupon.usageLimitGlobal ? <dd className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${usagePct >= 100 ? 'bg-rose-500' : 'bg-emerald-600'}`} style={{ width: `${usagePct}%` }} /></dd> : <dd className="mt-0.5 text-[10px] text-slate-400">No total limit</dd>}
      </div>
    </dl>
    <footer className="flex items-center justify-end gap-1 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
      <button onClick={onToggle} className="btn-ghost">{coupon.isActive ? <><Pause className="size-3.5" />Pause</> : <><Play className="size-3.5" />Activate</>}</button>
      <button onClick={onEdit} className="btn-ghost"><Pencil className="size-3.5" />Edit</button>
      {isAdmin && <button onClick={onDelete} title="Delete" className="icon-btn hover:bg-rose-50 hover:text-rose-700"><Trash2 className="size-3.5" /></button>}
    </footer>
  </article>;
}

const invoiceReady = (status: string) => !['PENDING_PAYMENT', 'CANCELLED'].includes(status);

function OrderTable({ orders, isAdmin, onView, onStatus, onRefund, onInvoice, footer }: { orders: Order[]; isAdmin: boolean; onView: (order: Order) => void; onStatus: (order: Order, status: string) => void; onRefund: (order: Order) => void; onInvoice: (order: Order) => void; footer?: ReactNode }) {
  const statusSelect = (order: Order) => validNextStatuses[order.status]?.length
    ? <select aria-label={`Status for ${order.orderNumber}`} value={order.status} onChange={(event) => onStatus(order, event.target.value)} className="input w-auto max-w-full py-1.5 text-[11px]">{[order.status, ...validNextStatuses[order.status]].map((status) => <option key={status} value={status}>{status === order.status ? statusLabel(status) : `→ ${statusLabel(status)}`}</option>)}</select>
    : <Pill tone={statusTone(order.status)}>{statusLabel(order.status)}</Pill>;
  const actions = (order: Order) => <div className="flex items-center justify-end gap-0.5">
    <button onClick={() => onView(order)} title="View details" className="icon-btn"><Eye className="size-3.5" /></button>
    {invoiceReady(order.status) && <button onClick={() => onInvoice(order)} title="Download invoice" className="icon-btn"><Download className="size-3.5" /></button>}
    {isAdmin && ['PAID', 'REFUND_REQUESTED'].includes(order.status) && <button onClick={() => onRefund(order)} className="btn-ghost text-rose-700 hover:bg-rose-50">Refund</button>}
  </div>;
  const tracking = (order: Order) => order.fulfillment?.trackingNumber && <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Truck className="size-3" />{order.fulfillment.carrier ? `${order.fulfillment.carrier} · ` : ''}{order.fulfillment.trackingNumber}</p>;

  if (!orders.length) return <div className="card"><EmptyState title="No orders found" hint="Try a different search or status filter." /></div>;
  return <div className="card overflow-hidden">
    <ul className="divide-y divide-slate-100 md:hidden">
      {orders.map((order) => <li key={order._id} className="p-4 text-xs">
        <div className="flex items-start justify-between gap-3"><button onClick={() => onView(order)} className="min-w-0 text-left"><p className="truncate text-sm font-bold text-slate-900">{order.orderNumber}</p><p className="text-slate-500">{new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {order.shippingAddress?.fullName || '—'}{order.shippingAddress?.city ? `, ${order.shippingAddress.city}` : ''}</p></button><p className="shrink-0 text-sm font-bold">{money(order.pricing?.grandTotal)}</p></div>
        <p className="mt-2 truncate text-slate-600">{order.items.map((item) => `${item.title} × ${item.quantity}`).join(', ')}</p>
        {tracking(order)}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">{statusSelect(order)}{actions(order)}</div>
      </li>)}
    </ul>
    <div className="hidden overflow-x-auto md:block"><table className="data-table min-w-[900px]"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td><button onClick={() => onView(order)} className="text-left"><p className="font-bold text-slate-900 hover:text-emerald-800 hover:underline">{order.orderNumber}</p><p className="mt-0.5 text-slate-500">{new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p></button></td><td><p className="font-medium">{order.shippingAddress?.fullName || '—'}</p><p className="text-slate-500">{order.shippingAddress?.city || ''}</p></td><td className="max-w-60">{order.items.slice(0, 2).map((item) => <p key={item.sku} className="truncate">{item.title} × {item.quantity}</p>)}{order.items.length > 2 && <p className="text-slate-400">+{order.items.length - 2} more</p>}</td><td className="font-bold tabular-nums">{money(order.pricing?.grandTotal)}</td><td>{statusSelect(order)}{tracking(order)}</td><td>{actions(order)}</td></tr>)}</tbody></table></div>
    {footer}
  </div>;
}
