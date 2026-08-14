import express from 'express';
import authRoute from './modules/auth/auth.route';
import userRoute from './modules/auth/user.route';
import customerRoute from './modules/commerce/customer.route';
import addressRoute from './modules/commerce/address.route';
import fileUploadRoute from './modules/auth/fileUpload.route';
import healthRouter from './modules/system/health.route';
import productRoute from './modules/catalog/product.route';
import productSyncRoute from './modules/catalog/product-sync.route';
import productSearchRoute from './modules/catalog/product-search.routes';
import productImportRoute from './modules/catalog/product-import.routes';
import categoryRoute from './modules/catalog/category.route';
import cartRoute from './modules/commerce/cart.route';
import orderRoute from './modules/commerce/order.route';
import paymentRoute from './modules/commerce/payment.route';
import cmsRoute from './modules/cms/cms.route';
import tenantRoute from './modules/tenant/tenant.route';
import marketingRoute from './modules/marketing/marketing.routes';
import collectionRoute from './modules/catalog/collection.route';
import pricingRuleRoute from './modules/catalog/pricing-rule.route';
import sizeGuideRoute from './modules/storefront/size-guide.route';
import attributeRoute from './modules/catalog/attribute.route';
import promotionRoute from './modules/promotion/promotion.route';
import inventoryRoute from './modules/inventory/inventory.route';
import reviewRoute from './modules/system/review.route';
import wishlistRoute from './modules/system/wishlist.route';
import taxRoute from './modules/commerce/tax.route';
import returnRoute from './modules/commerce/return.route';
import analyticsRoute from './modules/system/analytics.route';
import supplierRoute from './modules/supplier/supplier.route';
import notificationRoute from './modules/system/notification.route';
import auditRoute from './modules/tenant/audit.route';
import couponRoute from './modules/commerce/coupon.route';
import storefrontRoute from './modules/storefront/storefront.route';

const router = express.Router();

router.get('/v2', (_, res) => {
  res.json({
    message: 'Welcome to all-in-one-v2-api marketplace endpoints',
  });
});

router.use('/v2/auth', authRoute);
router.use('/v2/users', userRoute);
router.use('/v2/customers', customerRoute);
router.use('/v2/addresses', addressRoute);
router.use('/v2/file-uploads', fileUploadRoute);
router.use('/v2/products', productRoute);
router.use('/v2/products', productSyncRoute);
router.use('/v2/products', productImportRoute);
router.use('/v2/product-search', productSearchRoute);
router.use('/v2/categories', categoryRoute);
router.use('/v2/collections', collectionRoute);
router.use('/v2/pricing-rules', pricingRuleRoute);
router.use('/v2/size-guides', sizeGuideRoute);
router.use('/v2/attributes', attributeRoute);
router.use('/v2/promotions', promotionRoute);
router.use('/v2/inventory', inventoryRoute);
router.use('/v2/cart', cartRoute);
router.use('/v2/orders', orderRoute);
router.use('/v2/payments', paymentRoute);
router.use('/v2/cms', cmsRoute);
router.use('/v2/tenants', tenantRoute);
router.use('/v2/marketing', marketingRoute);
router.use('/v2/reviews', reviewRoute);
router.use('/v2/wishlists', wishlistRoute);
router.use('/v2/taxes', taxRoute);
router.use('/v2/returns', returnRoute);
router.use('/v2/analytics', analyticsRoute);
router.use('/v2/suppliers', supplierRoute);
router.use('/v2/notifications', notificationRoute);
router.use('/v2/audits', auditRoute);
router.use('/v2/coupons', couponRoute);
router.use('/v2/storefront', storefrontRoute);
router.use('/health', healthRouter);

export default router;
