import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import * as variantController from '../controllers/variant.controller.js';
import * as imageController from '../controllers/image.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from '../validators/product.validators.js';
import { createVariantSchema } from '../validators/variant.validators.js';
import { createImageSchema } from '../validators/image.validators.js';

const router = Router();

// Apply token extraction to all product routes
router.use(authenticate);

// Public Product Endpoints
router.get('/', validate(listProductsQuerySchema, 'query'), productController.listProducts);
router.get('/:idOrSlug', productController.getProduct);

// Protected Product Endpoints (Sellers & Admins only)
router.post(
  '/',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(createProductSchema),
  productController.createProduct
);

router.put(
  '/:id',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(updateProductSchema),
  productController.updateProduct
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(['seller', 'admin']),
  productController.deleteProduct
);

// Nested Variant Endpoints
router.get('/:productId/variants', variantController.listVariants);
router.post(
  '/:productId/variants',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(createVariantSchema),
  variantController.createVariant
);

// Nested Image Endpoints
router.get('/:productId/images', imageController.listImages);
router.post(
  '/:productId/images',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(createImageSchema),
  imageController.createImage
);

export default router;
