import Link from 'next/link';
import { RotateCcw, ShieldCheck, Sparkles, Truck, Headphones } from 'lucide-react';

const columns = [
  { title: 'Shop', links: [['All products', '/catalog'], ['New arrivals', '/catalog?sort=newest'], ['Best sellers', '/catalog?sort=popular'], ['Wishlist', '/wishlist']] },
  { title: 'Your account', links: [['Sign in', '/login'], ['Create account', '/register'], ['My orders', '/account/orders'], ['Saved addresses', '/account#addresses']] },
];

const promises = [
  { icon: Truck, title: 'Free delivery', text: 'On orders over ₹999' },
  { icon: ShieldCheck, title: 'Secure payments', text: 'UPI, cards & netbanking via Razorpay' },
  { icon: RotateCcw, title: 'Easy returns', text: 'Raise a request from your orders' },
  { icon: Headphones, title: 'Real support', text: 'We reply on every order query' },
];

export function Footer() {
  return <footer className="mt-20 border-t border-slate-200 bg-white">
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 border-b border-slate-100 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
      {promises.map(({ icon: Icon, title, text }) => <div key={title} className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="size-5" /></span><div><p className="text-sm font-bold text-slate-900">{title}</p><p className="text-xs text-slate-500">{text}</p></div></div>)}
    </div>
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
      <div>
        <Link href="/" className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-800 text-white"><Sparkles className="size-4" /></span><span className="text-lg font-extrabold">ShopSense<span className="text-emerald-600">AI</span></span></Link>
        <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">Everyday essentials across style, tech and home — picked with care and delivered across India.</p>
      </div>
      {columns.map((column) => <div key={column.title}>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{column.title}</p>
        <ul className="mt-3 space-y-2">{column.links.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-slate-600 transition hover:text-emerald-700">{label}</Link></li>)}</ul>
      </div>)}
    </div>
    <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">© {new Date().getFullYear()} ShopSense AI. All prices in INR, inclusive of applicable taxes at checkout.</div>
  </footer>;
}
