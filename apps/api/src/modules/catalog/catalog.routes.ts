import { Router } from 'express';
import { CatalogController } from './catalog.controller.js';

const router = Router();

router.get('/categories', CatalogController.getCategories);
router.get('/brands', CatalogController.getBrands);
router.get('/products', CatalogController.getProducts);
router.get('/products/:slug', CatalogController.getProductBySlug);

export const catalogRouter = router;
