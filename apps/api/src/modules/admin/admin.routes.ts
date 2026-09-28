import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { authenticate, requireRoles } from '../../middlewares/auth.middleware.js';
import { USER_ROLES } from '@shopsense/shared';

export const adminRouter: Router = Router();

// Protect all admin routes
adminRouter.use(authenticate, requireRoles(USER_ROLES.ADMIN, USER_ROLES.STAFF));

// Dashboard Analytics
adminRouter.get('/dashboard', AdminController.getDashboard);

// Order Management
adminRouter.get('/orders', AdminController.getOrders);
adminRouter.patch('/orders/:id/status', AdminController.updateOrderStatus);
adminRouter.post('/orders/:id/refund', AdminController.refundOrder);
adminRouter.get('/orders/:id/invoice', AdminController.downloadInvoice);

// Catalog & Inventory
adminRouter.get('/products', AdminController.getProducts);
adminRouter.post('/products', AdminController.createProduct);
adminRouter.put('/products/:id', AdminController.updateProduct);
adminRouter.delete('/products/:id', AdminController.deleteProduct);
adminRouter.post('/inventory/adjust', AdminController.adjustStock);
adminRouter.get('/inventory/low-stock', AdminController.getLowStock);

// Customers
adminRouter.get('/customers', AdminController.getCustomers);
adminRouter.patch('/customers/:id/block', AdminController.setCustomerBlocked);

// Coupons
adminRouter.get('/coupons', AdminController.getCoupons);
adminRouter.post('/coupons', AdminController.createCoupon);
adminRouter.put('/coupons/:id', AdminController.updateCoupon);
adminRouter.delete('/coupons/:id', AdminController.deleteCoupon);

// Logs & Auditing
adminRouter.get('/audit-logs', AdminController.getAuditLogs);
adminRouter.get('/inventory-logs', AdminController.getInventoryLogs);
