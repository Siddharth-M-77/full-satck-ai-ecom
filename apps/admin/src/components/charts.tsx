import type { ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react';

// Validated reference palette (light surface). Series colors carry identity; text stays in ink tokens.
export const viz = {
  revenue: '#2a78d6',
  orders: '#4a3aa7',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
};

export const money = (value = 0) => `₹${Number(value).toLocaleString('en-IN')}`;
export const compactMoney = (value = 0) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${value}`;
};
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const axisTick = { fontSize: 10, fill: viz.muted };

export function ChartCard({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`card p-4 sm:p-5 ${className}`}>
    <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h2 className="text-sm font-bold text-slate-950">{title}</h2>{subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}</div>
      {action}
    </header>
    {children}
  </section>;
}

export function KpiTile({ label, value, current, previous, icon: Icon, hint }: { label: string; value: string | number; current?: number; previous?: number; icon: LucideIcon; hint?: string }) {
  const hasDelta = current !== undefined && previous !== undefined;
  const delta = hasDelta ? (previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100) : undefined;
  const up = (current ?? 0) >= (previous ?? 0);
  return <div className="card p-4">
    <div className="flex items-center justify-between gap-2"><p className="truncate text-[11px] font-semibold text-slate-500">{label}</p><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="size-4" /></span></div>
    <p className="mt-2 truncate text-xl font-bold text-slate-950 sm:text-2xl">{value}</p>
    {hasDelta && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
      {delta === null
        ? <span className="font-semibold text-[#006300]">New</span>
        : <span className={`inline-flex items-center font-semibold ${delta === 0 ? 'text-slate-500' : up ? 'text-[#006300]' : 'text-rose-700'}`}>{delta !== 0 && (up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />)}{Math.abs(delta!).toFixed(1)}%</span>}
      <span className="truncate">vs previous period</span>
    </p>}
    {hint && !hasDelta && <p className="mt-1 truncate text-[11px] text-slate-500">{hint}</p>}
  </div>;
}

type TrendPoint = { _id: string; revenue: number; orders: number };

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
    <p className="font-semibold text-slate-950">{shortDate(point._id)}</p>
    <p className="mt-1 flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full" style={{ background: viz.revenue }} />Revenue <strong className="ml-auto pl-3 text-slate-950">{money(point.revenue)}</strong></p>
    <p className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full" style={{ background: viz.orders }} />Paid orders <strong className="ml-auto pl-3 text-slate-950">{point.orders}</strong></p>
  </div>;
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  return <div className="h-56 w-full sm:h-64">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={viz.revenue} stopOpacity={0.22} /><stop offset="100%" stopColor={viz.revenue} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={viz.grid} />
        <XAxis dataKey="_id" tickFormatter={shortDate} tick={axisTick} axisLine={{ stroke: viz.axis }} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={compactMoney} tick={axisTick} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<TrendTooltip />} cursor={{ stroke: viz.axis, strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={viz.revenue} strokeWidth={2} fill="url(#revenueFill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function OrdersBarChart({ data }: { data: TrendPoint[] }) {
  return <div className="h-40 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={viz.grid} />
        <XAxis dataKey="_id" tickFormatter={shortDate} tick={axisTick} axisLine={{ stroke: viz.axis }} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
        <Bar dataKey="orders" name="Paid orders" fill={viz.orders} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

function RowTooltip({ active, payload, format }: { active?: boolean; payload?: Array<{ payload: { label: string; value: number; detail?: string } }>; format: (value: number) => string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"><p className="font-semibold text-slate-950">{row.label}</p><p className="mt-1 text-slate-600">{format(row.value)}{row.detail ? ` · ${row.detail}` : ''}</p></div>;
}

/** Horizontal ranked bars — one series, direct-labeled, for category names that are too long for an x-axis. */
export function RankedBars({ rows, color, format = String, empty }: { rows: Array<{ label: string; value: number; detail?: string }>; color: string; format?: (value: number) => string; empty: string }) {
  if (!rows.length || rows.every((row) => row.value === 0)) return <p className="grid h-40 place-items-center text-center text-xs text-slate-500">{empty}</p>;
  return <div className="w-full" style={{ height: Math.max(120, rows.length * 36 + 8) }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={112} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} tickFormatter={(value: string) => value.length > 16 ? `${value.slice(0, 15)}…` : value} />
        <Tooltip content={<RowTooltip format={format} />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="value" position="right" formatter={(value: unknown) => format(Number(value))} style={{ fontSize: 11, fill: '#0b0b0b', fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

const statusTone: Record<string, string> = {
  PENDING_PAYMENT: '#eda100', PAID: '#2a78d6', PROCESSING: '#4a3aa7', SHIPPED: '#1baf7a',
  DELIVERED: '#008300', CANCELLED: '#898781', REFUND_REQUESTED: '#eb6834', REFUNDED: '#e34948',
};
export const statusLabel = (status: string) => status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Order pipeline — one stacked strip for part-to-whole plus a labeled list so identity never relies on color. */
export function StatusBreakdown({ rows }: { rows: Array<{ status: string; count: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <p className="grid h-40 place-items-center text-xs text-slate-500">No orders in the last 30 days.</p>;
  return <div>
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={rows.map((row) => `${statusLabel(row.status)} ${row.count}`).join(', ')}>
      {rows.map((row) => <div key={row.status} title={`${statusLabel(row.status)}: ${row.count}`} style={{ width: `${row.count / total * 100}%`, background: statusTone[row.status] || viz.muted }} />)}
    </div>
    <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map((row) => <li key={row.status} className="flex items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-sm" style={{ background: statusTone[row.status] || viz.muted }} /><span className="truncate text-slate-600">{statusLabel(row.status)}</span><span className="ml-auto font-semibold tabular-nums text-slate-950">{row.count}</span><span className="w-10 text-right tabular-nums text-slate-400">{Math.round(row.count / total * 100)}%</span></li>)}
    </ul>
  </div>;
}

/** Stock health uses the reserved status palette, always with icon + label. */
export function StockHealth({ healthy, low, out }: { healthy: number; low: number; out: number }) {
  const total = healthy + low + out;
  const rows = [
    { label: 'Healthy', hint: 'more than 5 units', value: healthy, color: viz.good, icon: CircleCheck },
    { label: 'Low stock', hint: '1–5 units', value: low, color: viz.warning, icon: TriangleAlert },
    { label: 'Out of stock', hint: '0 units', value: out, color: viz.critical, icon: CircleAlert },
  ];
  if (!total) return <p className="grid h-32 place-items-center text-xs text-slate-500">No variants in the catalog yet.</p>;
  return <div>
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={rows.map((row) => `${row.label} ${row.value}`).join(', ')}>
      {rows.filter((row) => row.value > 0).map((row) => <div key={row.label} style={{ width: `${row.value / total * 100}%`, background: row.color }} />)}
    </div>
    <ul className="mt-4 space-y-2.5">
      {rows.map(({ label, hint, value, color, icon: StatusIcon }) => <li key={label} className="flex items-center gap-2 text-xs"><StatusIcon className="size-4 shrink-0" style={{ color }} /><span className="font-semibold text-slate-800">{label}</span><span className="hidden text-slate-400 sm:inline">{hint}</span><span className="ml-auto font-semibold tabular-nums text-slate-950">{value}</span><span className="w-10 text-right tabular-nums text-slate-400">{Math.round(value / total * 100)}%</span></li>)}
    </ul>
  </div>;
}
