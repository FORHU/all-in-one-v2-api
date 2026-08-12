import express from 'express';
import { createTaxClass, getTaxClasses } from './tax.controller';

const router = express.Router();

router.post('/classes', createTaxClass);
router.get('/classes', getTaxClasses);

export default router;
