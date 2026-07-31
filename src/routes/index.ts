import express from 'express';
import authRoute from './auth.route';
import userRoute from './user.route';
import fileUploadRoute from './fileUpload.route';
import healthRouter from './health.route';
import productSyncRoute from './product-sync.route';
import productSearchRoute from './product-search.routes';
import productImportRoute from './product-import.routes';
import categoryRoute from './category.route';
import cartRoute from './cart.route';
import orderRoute from './order.route';
import paymentRoute from './payment.route';
import cmsRoute from './cms.route';
import tenantRoute from './tenant.route';
import marketingRoute from './marketing.routes';
import collectionRoute from './collection.route';
import sizeGuideRoute from './size-guide.route';
import attributeRoute from './attribute.route';
import promotionRoute from './promotion.route';
import inventoryRoute from './inventory.route';

const router = express.Router();

router.get('/v2', (_, res) => {
  res.json({
    message: 'Welcome to all-in-one-v2-api marketplace endpoints',
  });
});

router.use('/v2/auth', authRoute);
router.use('/v2/users', userRoute);
router.use('/v2/file-uploads', fileUploadRoute);
router.use('/v2/products', productSyncRoute);
router.use('/v2/products', productImportRoute);
router.use('/v2/product-search', productSearchRoute);
router.use('/v2/categories', categoryRoute);
router.use('/v2/collections', collectionRoute);
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
router.use('/health', healthRouter);

export default router;
