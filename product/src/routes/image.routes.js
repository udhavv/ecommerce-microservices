import { Router } from 'express';
import * as imageController from '../controllers/image.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { uploadSingleImage } from '../middleware/upload.middleware.js';
import { updateImageSchema } from '../validators/image.validators.js';

const router = Router();

router.use(authenticate);

// Protected Cloudinary Image Upload
router.post(
  '/upload',
  requireAuth,
  requireRole(['seller', 'admin']),
  uploadSingleImage,
  imageController.uploadImage
);

router.put(
  '/:id',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(updateImageSchema),
  imageController.updateImage
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(['seller', 'admin']),
  imageController.deleteImage
);

export default router;
