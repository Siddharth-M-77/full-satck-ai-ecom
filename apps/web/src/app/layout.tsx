import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { Toaster } from '../components/common/Toaster';
import { QuickView } from '../components/product/QuickView';

export const metadata: Metadata = {
  title: 'ShopSense AI — Shop smarter',
  description: 'Everyday essentials across style, tech and home, with secure checkout and fast delivery across India.',
};

export const viewport: Viewport = {
  themeColor: '#047857',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
        <QuickView />
        <Toaster />
      </body>
    </html>
  );
}
