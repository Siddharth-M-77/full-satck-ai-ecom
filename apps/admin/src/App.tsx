import { LayoutDashboard, Package, ShoppingCart, Users, Bot } from 'lucide-react';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            S
          </div>
          <span className="font-bold text-lg tracking-tight">ShopSense Admin</span>
        </div>

        <nav className="flex flex-col gap-1 text-sm font-medium">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800 text-white">
            <LayoutDashboard className="w-4 h-4 text-emerald-400" />
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
            <Package className="w-4 h-4" />
            Products & Variants
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
            <ShoppingCart className="w-4 h-4" />
            Orders
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
            <Users className="w-4 h-4" />
            Customers
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
            <Bot className="w-4 h-4 text-teal-400" />
            AI Copilot
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center pb-6 border-b border-slate-800 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Store Overview</h1>
            <p className="text-sm text-slate-400">Welcome to your AI-powered e-commerce control center</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
              Live System Connected
            </span>
          </div>
        </header>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Revenue (30d)</p>
            <p className="text-2xl font-bold text-white mt-2">₹1,24,500</p>
            <span className="text-xs text-emerald-400 mt-1 inline-block">↑ 14% vs last month</span>
          </div>
          <div className="p-6 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Orders</p>
            <p className="text-2xl font-bold text-white mt-2">342</p>
            <span className="text-xs text-emerald-400 mt-1 inline-block">12 pending processing</span>
          </div>
          <div className="p-6 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Low Stock SKUs</p>
            <p className="text-2xl font-bold text-amber-400 mt-2">3</p>
            <span className="text-xs text-slate-400 mt-1 inline-block">Triggered AI restock advice</span>
          </div>
          <div className="p-6 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">AI Assistant Conversions</p>
            <p className="text-2xl font-bold text-teal-400 mt-2">28.4%</p>
            <span className="text-xs text-teal-300 mt-1 inline-block">Across 850 sessions</span>
          </div>
        </div>
      </main>
    </div>
  );
}
