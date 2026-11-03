import reviewService from '../services/review.service.js';

export const createReview = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotency_key;
    const review = await reviewService.createReview(req.body, req.user, idempotencyKey);
    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const review = await reviewService.updateReview(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const result = await reviewService.deleteReview(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const listProductReviews = async (req, res, next) => {
  try {
    const result = await reviewService.listProductReviews(
      req.params.productId,
      req.query,
      req.user
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductRatingSummary = async (req, res, next) => {
  try {
    const summary = await reviewService.getProductRatingSummary(req.params.productId);
    return res.status(200).json({
      success: true,
      data: { summary },
    });
  } catch (error) {
    next(error);
  }
};

export const voteReview = async (req, res, next) => {
  try {
    const result = await reviewService.voteReview(
      req.params.id,
      req.user,
      req.body.vote_type
    );
    return res.status(200).json({
      success: true,
      message: 'Vote recorded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const reportReview = async (req, res, next) => {
  try {
    const report = await reviewService.reportReview(req.params.id, req.user, req.body);
    return res.status(201).json({
      success: true,
      message: 'Review reported to moderators successfully',
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};

export const moderateReview = async (req, res, next) => {
  try {
    const review = await reviewService.moderateReview(
      req.params.id,
      req.user,
      req.body.action,
      req.body.reason
    );
    return res.status(200).json({
      success: true,
      message: `Review ${req.body.action.toLowerCase()}d successfully`,
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserReviews = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const result = await reviewService.getUserReviews(req.user.id, page, limit);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createReview,
  updateReview,
  deleteReview,
  listProductReviews,
  getProductRatingSummary,
  voteReview,
  reportReview,
  moderateReview,
  getUserReviews,
};
