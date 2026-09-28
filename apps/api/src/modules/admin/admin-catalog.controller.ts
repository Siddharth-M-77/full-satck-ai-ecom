import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Category } from '../catalog/category.model.js';
import { Brand } from '../catalog/brand.model.js';
import { Product } from '../catalog/product.model.js';
import { AuditLog } from './audit-log.model.js';
import { AppError } from '../../utils/app-error.js';
import { invalidateCatalogCache } from '../catalog/cache.util.js';
import { env } from '../../config/env.js';

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const pick = (body: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

const categoryFields = ['name', 'slug', 'description', 'parentId', 'image', 'isActive', 'displayOrder'];
const brandFields = ['name', 'slug', 'logo', 'website', 'isActive'];

async function audit(req: Request, action: string, resourceType: string, resourceId: string, diff: Record<string, unknown>) {
  await AuditLog.create({
    userId: req.user?._id,
    userEmail: req.user?.email || 'admin',
    action,
    resourceType,
    resourceId,
    diff,
  });
}

export class AdminCatalogController {
  static async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const [categories, counts] = await Promise.all([
        Category.find().sort({ displayOrder: 1, name: 1 }).lean(),
        Product.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
      ]);
      const countById = new Map(counts.map((row) => [String(row._id), row.count]));
      res.json({
        success: true,
        data: categories.map((category) => ({ ...category, productCount: countById.get(String(category._id)) || 0 })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = pick(req.body, categoryFields);
      if (!data.name) throw AppError.badRequest('Category name is required');
      data.slug = slugify(String(data.slug || data.name));
      if (!data.parentId) data.parentId = null;
      const category = await Category.create(data);
      await invalidateCatalogCache();
      await audit(req, 'CATEGORY_CREATED', 'Category', category.slug, { after: { name: category.name } });
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const data = pick(req.body, categoryFields);
      if (data.slug !== undefined) data.slug = slugify(String(data.slug));
      if (data.parentId === '') data.parentId = null;
      if (data.parentId && String(data.parentId) === id) throw AppError.badRequest('A category cannot be its own parent');
      const category = await Category.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
      if (!category) throw AppError.notFound('Category not found');
      await invalidateCatalogCache();
      await audit(req, 'CATEGORY_UPDATED', 'Category', category.slug, { after: data });
      res.json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const [productCount, childCount] = await Promise.all([
        Product.countDocuments({ categoryId: id }),
        Category.countDocuments({ parentId: id }),
      ]);
      if (productCount || childCount) {
        throw AppError.conflict(
          `Category is still used by ${productCount} product(s) and ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}. Move them first or deactivate the category.`
        );
      }
      const category = await Category.findByIdAndDelete(id);
      if (!category) throw AppError.notFound('Category not found');
      await invalidateCatalogCache();
      await audit(req, 'CATEGORY_DELETED', 'Category', category.slug, { before: { name: category.name } });
      res.json({ success: true, data: { id: category._id } });
    } catch (err) {
      next(err);
    }
  }

  static async getBrands(_req: Request, res: Response, next: NextFunction) {
    try {
      const [brands, counts] = await Promise.all([
        Brand.find().sort({ name: 1 }).lean(),
        Product.aggregate<{ _id: string; count: number }>([
          { $match: { brandId: { $ne: null } } },
          { $group: { _id: '$brandId', count: { $sum: 1 } } },
        ]),
      ]);
      const countById = new Map(counts.map((row) => [String(row._id), row.count]));
      res.json({
        success: true,
        data: brands.map((brand) => ({ ...brand, productCount: countById.get(String(brand._id)) || 0 })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async createBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const data = pick(req.body, brandFields);
      if (!data.name) throw AppError.badRequest('Brand name is required');
      data.slug = slugify(String(data.slug || data.name));
      const brand = await Brand.create(data);
      await invalidateCatalogCache();
      await audit(req, 'BRAND_CREATED', 'Brand', brand.slug, { after: { name: brand.name } });
      res.status(201).json({ success: true, data: brand });
    } catch (err) {
      next(err);
    }
  }

  static async updateBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const data = pick(req.body, brandFields);
      if (data.slug !== undefined) data.slug = slugify(String(data.slug));
      const brand = await Brand.findByIdAndUpdate(String(req.params.id), { $set: data }, { new: true, runValidators: true });
      if (!brand) throw AppError.notFound('Brand not found');
      await invalidateCatalogCache();
      await audit(req, 'BRAND_UPDATED', 'Brand', brand.slug, { after: data });
      res.json({ success: true, data: brand });
    } catch (err) {
      next(err);
    }
  }

  static async deleteBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const productCount = await Product.countDocuments({ brandId: id });
      if (productCount) {
        throw AppError.conflict(`Brand is still used by ${productCount} product(s). Reassign them first or deactivate the brand.`);
      }
      const brand = await Brand.findByIdAndDelete(id);
      if (!brand) throw AppError.notFound('Brand not found');
      await invalidateCatalogCache();
      await audit(req, 'BRAND_DELETED', 'Brand', brand.slug, { before: { name: brand.name } });
      res.json({ success: true, data: { id: brand._id } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Signs a direct browser-to-Cloudinary upload so image bytes never pass through the API
   * and the API secret never leaves the server.
   */
  static async getUploadSignature(_req: Request, res: Response, next: NextFunction) {
    try {
      if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        throw AppError.serviceUnavailable('Image uploads are not configured. Set the CLOUDINARY_* environment variables.');
      }
      const timestamp = Math.round(Date.now() / 1000);
      const folder = 'shopsense/products';
      const signature = crypto
        .createHash('sha1')
        .update(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)
        .digest('hex');
      res.json({
        success: true,
        data: { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, timestamp, folder, signature },
      });
    } catch (err) {
      next(err);
    }
  }
}
