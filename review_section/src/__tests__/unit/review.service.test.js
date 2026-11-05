import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(async () => mockClient),
  query: mockQuery,
};

const mockWithTransaction = jest.fn(async (callback) => callback(mockClient));

jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const { reviewService } = await import('../../services/review.service.js');
const { AppError } = await import('../../middleware/errorHandler.js');

const makeReviewRow = (overrides = {}) => ({
  id: 1,
  product_id: 10,
  variant_id: null,
  user_id: 'user-111',
  customer_name: 'John Doe',
  order_id: null,
  rating: 5,
  title: 'Great Product',
  comment: 'Really loved this product!',
  verified_purchase: false,
  status: 'APPROVED',
  helpful_count: 0,
  not_helpful_count: 0,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});

describe('Review Service Unit Tests', () => {
  const user = { id: 'user-111', displayName: 'John Doe', roles: ['user'] };
  const adminUser = { id: 'admin-999', displayName: 'Site Admin', roles: ['admin'] };
  const otherUser = { id: 'user-222', displayName: 'Jane Smith', roles: ['user'] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    const payload = {
      product_id: 10,
      rating: 5,
      title: 'Amazing item',
      comment: 'Top quality material and fit.',
      images: ['https://example.com/pic1.jpg'],
    };

    it('creates review in transaction and updates product rating summary', async () => {
      // 1. Duplicate check (none exists)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 2. Verified purchase check
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Inside transaction (mockClient):
      // Insert review
      mockClient.query.mockResolvedValueOnce({ rows: [makeReviewRow({ id: 1 })] });
      // Insert review image
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 101, image_url: 'https://example.com/pic1.jpg' }] });
      // updateProductRatingSummary: Aggregation
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          total_reviews: 1,
          average_rating: 5.0,
          rating_1_count: 0,
          rating_2_count: 0,
          rating_3_count: 0,
          rating_4_count: 0,
          rating_5_count: 1,
        }],
      });
      // updateProductRatingSummary: Upsert
      mockClient.query.mockResolvedValueOnce({});

      const result = await reviewService.createReview(payload, user);

      expect(result.id).toBe(1);
      expect(result.rating).toBe(5);
      expect(result.images).toHaveLength(1);
      expect(mockWithTransaction).toHaveBeenCalled();
    });

    it('throws 409 Conflict if user has already reviewed the product', async () => {
      // Duplicate check returns an existing active review
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] });

      await expect(reviewService.createReview(payload, user)).rejects.toThrow(
        'You have already submitted a review'
      );
    });

    it('returns cached idempotent response if idempotency key exists', async () => {
      const cachedResponse = { id: 1, cached: true };
      mockQuery.mockResolvedValueOnce({ rows: [{ response_body: cachedResponse }] });

      const result = await reviewService.createReview(payload, user, 'idem-key-123');
      expect(result).toEqual(cachedResponse);
    });
  });

  describe('updateReview', () => {
    const updateData = { rating: 4, comment: 'Updated comment' };

    it('updates review when requested by author', async () => {
      const existing = makeReviewRow({ id: 1, user_id: user.id });

      // Check review exists
      mockQuery.mockResolvedValueOnce({ rows: [existing] });

      // In transaction:
      // Update review
      mockClient.query.mockResolvedValueOnce({ rows: [makeReviewRow({ id: 1, rating: 4 })] });
      // Select existing images
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Recalculate summary: Aggregation
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_reviews: 1, average_rating: 4.0 }] });
      // Upsert summary
      mockClient.query.mockResolvedValueOnce({});

      const result = await reviewService.updateReview(1, updateData, user);
      expect(result.id).toBe(1);
      expect(result.rating).toBe(4);
    });

    it('allows admin to update any review', async () => {
      const existing = makeReviewRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [existing] });

      mockClient.query.mockResolvedValueOnce({ rows: [makeReviewRow({ id: 1, rating: 4 })] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_reviews: 1, average_rating: 4.0 }] });
      mockClient.query.mockResolvedValueOnce({});

      const result = await reviewService.updateReview(1, updateData, adminUser);
      expect(result.id).toBe(1);
    });

    it('throws 403 Forbidden if user is not author and not admin', async () => {
      const existing = makeReviewRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [existing] });

      await expect(reviewService.updateReview(1, updateData, otherUser)).rejects.toThrow(
        'Forbidden'
      );
    });

    it('throws 404 AppError if review does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(reviewService.updateReview(999, updateData, user)).rejects.toThrow(
        AppError
      );
    });
  });

  describe('deleteReview', () => {
    it('soft deletes review and recalculates rating summary', async () => {
      const existing = makeReviewRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [existing] });

      // Update deleted_at
      mockClient.query.mockResolvedValueOnce({});
      // Recalculate summary: Aggregation
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_reviews: 0, average_rating: 0 }] });
      // Upsert summary
      mockClient.query.mockResolvedValueOnce({});

      const result = await reviewService.deleteReview(1, user);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    it('throws 403 if non-owner tries to delete review', async () => {
      const existing = makeReviewRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [existing] });

      await expect(reviewService.deleteReview(1, otherUser)).rejects.toThrow('Forbidden');
    });

    it('throws 404 if review does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(reviewService.deleteReview(999, user)).rejects.toThrow(AppError);
    });
  });

  describe('listProductReviews', () => {
    it('returns paginated approved reviews with images and total count', async () => {
      const reviews = [makeReviewRow({ id: 1 }), makeReviewRow({ id: 2 })];

      // 1. Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      // 2. Data query
      mockQuery.mockResolvedValueOnce({ rows: reviews });

      const result = await reviewService.listProductReviews(10, { page: 1, limit: 10 });

      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.reviews).toEqual(reviews);
    });
  });

  describe('voteReview', () => {
    it('throws 400 if user attempts to vote on their own review', async () => {
      const ownReview = makeReviewRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [ownReview] });

      await expect(reviewService.voteReview(1, user, 'HELPFUL')).rejects.toThrow(
        'cannot vote on your own review'
      );
    });

    it('records helpful vote when user votes on another review', async () => {
      const otherReview = makeReviewRow({ id: 1, user_id: otherUser.id });
      mockQuery.mockResolvedValueOnce({ rows: [otherReview] });

      // In transaction:
      // Select existing vote (none)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Insert vote
      mockClient.query.mockResolvedValueOnce({});
      // Update counts
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, helpful_count: 1, not_helpful_count: 0 }],
      });

      const result = await reviewService.voteReview(1, user, 'HELPFUL');
      expect(result.helpful_count).toBe(1);
      expect(result.user_vote).toBe('HELPFUL');
    });

    it('toggles off vote when user votes same type again', async () => {
      const otherReview = makeReviewRow({ id: 1, user_id: otherUser.id });
      mockQuery.mockResolvedValueOnce({ rows: [otherReview] });

      // Existing vote of same type
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 5, vote_type: 'HELPFUL' }] });
      // Delete vote
      mockClient.query.mockResolvedValueOnce({});
      // Update counts
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, helpful_count: 0, not_helpful_count: 0 }],
      });

      const result = await reviewService.voteReview(1, user, 'HELPFUL');
      expect(result.user_vote).toBeNull();
      expect(result.helpful_count).toBe(0);
    });
  });

  describe('reportReview', () => {
    it('logs an abuse report for a review', async () => {
      const rev = makeReviewRow({ id: 1 });
      // 1. Review exists
      mockQuery.mockResolvedValueOnce({ rows: [rev] });
      // 2. Duplicate report check (none)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 3. Insert report
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 10, reason: 'SPAM' }] });

      const result = await reviewService.reportReview(1, user, { reason: 'SPAM' });
      expect(result.reason).toBe('SPAM');
    });

    it('throws 409 if user has already reported the review', async () => {
      const rev = makeReviewRow({ id: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [rev] });
      // Duplicate report returns existing
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 10 }] });

      await expect(
        reviewService.reportReview(1, user, { reason: 'SPAM' })
      ).rejects.toThrow('already reported');
    });
  });
});
