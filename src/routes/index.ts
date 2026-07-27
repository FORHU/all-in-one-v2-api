import express from 'express';
import authRoute from './auth.route';
import userRoute from './user.route';
import fileUploadRoute from './fileUpload.route';
import healthRouter from './health.route';
import productSyncRoute from './product-sync.route';

const router = express.Router();

router.get('/v2', (_, res) => {
  res.json({
    message: 'Welcome to all-in-one-v2-api',
  });
});

router.use('/v2/auth', authRoute);
router.use('/v2/users', userRoute);
router.use('/v2/file-uploads', fileUploadRoute);
router.use('/v2/products', productSyncRoute);
router.use('/health', healthRouter);

export default router;
