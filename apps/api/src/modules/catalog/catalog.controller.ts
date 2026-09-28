import { Request, Response, NextFunction } from 'express';
import { CatalogService } from './catalog.service.js';

export class CatalogController {
  static async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await CatalogService.getCategories();
      res.status(200).json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  static async getBrands(_req: Request, res: Response, next: NextFunction) {
    try {
      const brands = await CatalogService.getBrands();
      res.status(200).json({ success: true, data: brands });
    } catch (err) {
      next(err);
    }
  }

  static async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CatalogService.getProducts(req.query);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getProductBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = req.params.slug as string;
      const product = await CatalogService.getProductBySlug(slug);
      res.status(200).json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }
}
