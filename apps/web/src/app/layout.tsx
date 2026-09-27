import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/common/Navbar';

export const metadata: Metadata = {
  title: 'ShopSense AI — Next-Gen Intelligent E-Commerce',
  description: 'AI-Powered Full-Stack E-commerce Platform featuring Semantic Hybrid Search, AI Assistant, and Seamless Checkout.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col font-sans bg-slate-50 text-slate-900">
        <Navbar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
