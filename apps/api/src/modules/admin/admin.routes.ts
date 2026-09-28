import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { authenticate, requireRoles } from '../../middlewares/auth.middleware.js';
import { USER_ROLES } from '@shopsense/shared';

export const adminRouter: Router = Router();

// Admin and staff can run day-to-day operations; destructive or money-moving actions are admin-only.
adminRouter.use(authenticate, requireRoles(USER_ROLES.ADMIN, USER_ROLES.STAFF));
const adminOnly = requireRoles(USER_ROLES.ADMIN);

// Dashboard Analytics
adminRouter.get('/dashboard', AdminController.getDashboard);

// Order Management
adminRouter.get('/orders', AdminController.getOrders);
adminRouter.get('/orders/:id', AdminController.getOrderById);
adminRouter.patch('/orders/:id/status', AdminController.updateOrderStatus);
adminRouter.post('/orders/:id/refund', adminOnly, AdminController.refundOrder);
adminRouter.get('/orders/:id/invoice', AdminController.downloadInvoice);

// Catalog & Inventory
adminRouter.get('/products', AdminController.getProducts);
adminRouter.post('/products', AdminController.createProduct);
adminRouter.put('/products/:id', AdminController.updateProduct);
adminRouter.delete('/products/:id', adminOnly, AdminController.deleteProduct);
adminRouter.post('/inventory/adjust', AdminController.adjustStock);
adminRouter.get('/inventory/low-stock', AdminController.getLowStock);
adminRouter.get('/uploads/signature', AdminCatalogController.getUploadSignature);

// Categories & Brands
adminRouter.get('/categories', AdminCatalogController.getCategories);
adminRouter.post('/categories', AdminCatalogController.createCategory);
adminRouter.put('/categories/:id', AdminCatalogController.updateCategory);
adminRouter.delete('/categories/:id', adminOnly, AdminCatalogController.deleteCategory);
adminRouter.get('/brands', AdminCatalogController.getBrands);
adminRouter.post('/brands', AdminCatalogController.createBrand);
adminRouter.put('/brands/:id', AdminCatalogController.updateBrand);
adminRouter.delete('/brands/:id', adminOnly, AdminCatalogController.deleteBrand);

// Customers
adminRouter.get('/customers', AdminController.getCustomers);
adminRouter.patch('/customers/:id/block', adminOnly, AdminController.setCustomerBlocked);

// Coupons
adminRouter.get('/coupons', AdminController.getCoupons);
adminRouter.post('/coupons', AdminController.createCoupon);
adminRouter.put('/coupons/:id', AdminController.updateCoupon);
adminRouter.delete('/coupons/:id', adminOnly, AdminController.deleteCoupon);

// Logs & Auditing
adminRouter.get('/audit-logs', adminOnly, AdminController.getAuditLogs);
adminRouter.get('/inventory-logs', AdminController.getInventoryLogs);
