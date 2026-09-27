import { Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium mb-6">
        <Sparkles className="w-4 h-4 text-emerald-600" />
        <span>ShopSense AI Platform</span>
      </div>

      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
        Experience Shopping, <br />
        <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
          Powered by Intelligence.
        </span>
      </h1>

      <p className="text-lg text-slate-600 max-w-2xl mb-8">
        Full-stack AI-first e-commerce platform equipped with hybrid vector search, real-time AI Shopping Assistant, automated inventory safeguards, and Razorpay checkout.
      </p>

      <div className="flex flex-wrap gap-4 justify-center">
        <a
          href="/catalog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Explore Catalog</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </a>
        <a
          href="http://localhost:5000/health"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
        >
          <span>API Health Status</span>
        </a>
      </div>
    </main>
  );
}
