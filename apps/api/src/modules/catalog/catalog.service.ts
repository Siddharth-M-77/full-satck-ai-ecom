import { Product, IProduct } from './product.model.js';
import { Category } from './category.model.js';
import { Brand } from './brand.model.js';
import { getCached, setCached, invalidateCatalogCache } from './cache.util.js';
import { AppError } from '../../utils/app-error.js';
import { PRODUCT_STATUS } from '@shopsense/shared';
import mongoose from 'mongoose';

export interface ProductQueryFilters {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
  search?: string;
  featured?: boolean;
  sort?: 'price_asc' | 'price_desc' | 'popular' | 'newest';
  page?: number;
  limit?: number;
}

export class CatalogService {
  static async getCategories() {
    const cacheKey = 'catalog:categories:all';
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const categories = await Category.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    await setCached(cacheKey, categories, 600); // 10 mins
    return categories;
  }

  static async getBrands() {
    const cacheKey = 'catalog:brands:all';
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const brands = await Brand.find({ isActive: true }).sort({ name: 1 }).lean();
    await setCached(cacheKey, brands, 600);
    return brands;
  }

  static async getProducts(filters: ProductQueryFilters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const cacheKey = `catalog:products:${JSON.stringify(filters)}`;
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const query: Record<string, unknown> = {
      status: PRODUCT_STATUS.PUBLISHED,
    };

    if (filters.featured !== undefined) {
      query.isFeatured = filters.featured;
    }

    if (filters.category) {
      const category = await Category.findOne({ slug: filters.category });
      if (category) {
        query.categoryId = category._id;
      }
    }

    if (filters.brand) {
      const brand = await Brand.findOne({ slug: filters.brand });
      if (brand) {
        query.brandId = brand._id;
      }
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.basePrice = {};
      if (filters.minPrice !== undefined) {
        (query.basePrice as Record<string, number>).$gte = Number(filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        (query.basePrice as Record<string, number>).$lte = Number(filters.maxPrice);
      }
    }

    if (filters.rating !== undefined) {
      query['rating.average'] = { $gte: Number(filters.rating) };
    }

    if (filters.inStock) {
      query['variants.stock'] = { $gt: 0 };
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    if (filters.sort === 'price_asc') {
      sortOption = { basePrice: 1 };
    } else if (filters.sort === 'price_desc') {
      sortOption = { basePrice: -1 };
    } else if (filters.sort === 'popular') {
      sortOption = { salesCount: -1 };
    } else if (filters.sort === 'newest') {
      sortOption = { createdAt: -1 };
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    const result = {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await setCached(cacheKey, result, 120); // 2 mins cache
    return result;
  }

  static async getProductBySlug(slug: string) {
    const cacheKey = `catalog:product:${slug}`;
    const cached = await getCached<IProduct>(cacheKey);
    if (cached) return cached;

    const product = await Product.findOne({ slug, status: PRODUCT_STATUS.PUBLISHED })
      .populate('categoryId', 'name slug')
      .populate('brandId', 'name slug logo')
      .lean();

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    await setCached(cacheKey, product, 300);
    return product;
  }

  static async createProduct(data: Partial<IProduct>) {
    const product = new Product(data);
    await product.save();
    await invalidateCatalogCache();
    return product;
  }

  static async updateProduct(id: string, data: Partial<IProduct>) {
    const product = await Product.findByIdAndUpdate(id, data, { new: true });
    if (!product) {
      throw AppError.notFound('Product not found');
    }
    await invalidateCatalogCache();
    return product;
  }

  static async deleteProduct(id: string) {
    const product = await Product.findByIdAndUpdate(
      id,
      { status: PRODUCT_STATUS.ARCHIVED },
      { new: true }
    );
    if (!product) {
      throw AppError.notFound('Product not found');
    }
    await invalidateCatalogCache();
    return { success: true };
  }
}
