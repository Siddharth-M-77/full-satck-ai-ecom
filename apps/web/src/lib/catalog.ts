export interface ProductVariant {
  sku: string;
  attributes?: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  images: Array<{ url: string; isPrimary?: boolean }>;
}

export interface ProductSummary {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  basePrice: number;
  compareAtPrice?: number;
  categoryId?: { _id: string; name: string; slug: string };
  brandId?: { _id: string; name: string; slug: string } | null;
  rating: { average: number; count: number };
  isFeatured?: boolean;
  variants: ProductVariant[];
}

export interface Offer {
  _id: string;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  endDate: string;
}

export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80';
export const FREE_SHIPPING_THRESHOLD = 999;

export const inr = (value = 0) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export const productImages = (product: ProductSummary) =>
  product.variants.flatMap((variant) => variant.images?.map((image) => image.url) || []).filter(Boolean);

export const primaryImage = (product: ProductSummary) => productImages(product)[0] || FALLBACK_IMAGE;

export const discountPercent = (price: number, compareAt?: number) =>
  compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;

export const totalStock = (product: ProductSummary) => product.variants.reduce((sum, variant) => sum + variant.stock, 0);

export const offerHeadline = (offer: Offer) =>
  offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `${inr(offer.discountValue)} off`;

export const offerTerms = (offer: Offer) => [
  offer.minOrderValue ? `on orders above ${inr(offer.minOrderValue)}` : 'on any order',
  offer.maxDiscount ? `up to ${inr(offer.maxDiscount)}` : '',
].filter(Boolean).join(' · ');

const RECENT_KEY = 'shopsense_recently_viewed';
export type RecentProduct = Pick<ProductSummary, '_id' | 'title' | 'slug' | 'basePrice' | 'compareAtPrice'> & { image: string };

export function readRecentlyViewed(): RecentProduct[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

export function rememberViewed(product: ProductSummary) {
  try {
    const entry: RecentProduct = { _id: product._id, title: product.title, slug: product.slug, basePrice: product.basePrice, compareAtPrice: product.compareAtPrice, image: primaryImage(product) };
    const next = [entry, ...readRecentlyViewed().filter((item) => item._id !== product._id)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: recently viewed is a convenience, so skip silently.
  }
}
