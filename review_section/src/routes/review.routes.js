import { Router } from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  createReviewSchema,
  updateReviewSchema,
  listProductReviewsQuerySchema,
  voteReviewSchema,
  reportReviewSchema,
  moderateReviewSchema,
} from '../validators/review.validators.js';

const router = Router();

// Apply soft authentication across all review routes (populates req.user if session/token exists)
router.use(authenticate);

// ------------------------------------------------------------
// Public Catalog Read Endpoints
// ------------------------------------------------------------
router.get(
  '/product/:productId',
  validate(listProductReviewsQuerySchema, 'query'),
  reviewController.listProductReviews
);

router.get(
  '/product/:productId/summary',
  reviewController.getProductRatingSummary
);

// ------------------------------------------------------------
// Protected Customer Action Endpoints
// ------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  validate(createReviewSchema),
  reviewController.createReview
);

router.get(
  '/my-reviews',
  requireAuth,
  reviewController.getUserReviews
);

router.put(
  '/:id',
  requireAuth,
  validate(updateReviewSchema),
  reviewController.updateReview
);

router.delete(
  '/:id',
  requireAuth,
  reviewController.deleteReview
);

router.post(
  '/:id/vote',
  requireAuth,
  validate(voteReviewSchema),
  reviewController.voteReview
);

router.post(
  '/:id/report',
  requireAuth,
  validate(reportReviewSchema),
  reviewController.reportReview
);

// ------------------------------------------------------------
// Protected Admin Moderation Endpoints
// ------------------------------------------------------------
router.patch(
  '/:id/moderate',
  requireAuth,
  requireRole(['admin']),
  validate(moderateReviewSchema),
  reviewController.moderateReview
);

export default router;
