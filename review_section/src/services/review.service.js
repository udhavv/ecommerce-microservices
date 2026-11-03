import crypto from 'crypto';
import { query, withTransaction } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const reviewService = {
  /**
   * Recalculate and persist the rating summary for a product
   */
  async updateProductRatingSummary(client, productId) {
    const aggRes = await client.query(
      `SELECT 
        COUNT(*)::int AS total_reviews,
        COALESCE(ROUND(AVG(rating), 2), 0) AS average_rating,
        COUNT(*) FILTER (WHERE rating = 1)::int AS rating_1_count,
        COUNT(*) FILTER (WHERE rating = 2)::int AS rating_2_count,
        COUNT(*) FILTER (WHERE rating = 3)::int AS rating_3_count,
        COUNT(*) FILTER (WHERE rating = 4)::int AS rating_4_count,
        COUNT(*) FILTER (WHERE rating = 5)::int AS rating_5_count
      FROM product_reviews
      WHERE product_id = $1 AND status = 'APPROVED' AND deleted_at IS NULL`,
      [productId]
    );

    const s = aggRes.rows[0];

    await client.query(
      `INSERT INTO product_rating_summaries 
        (product_id, total_reviews, average_rating, rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (product_id) DO UPDATE SET
        total_reviews = EXCLUDED.total_reviews,
        average_rating = EXCLUDED.average_rating,
        rating_1_count = EXCLUDED.rating_1_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_5_count = EXCLUDED.rating_5_count,
        updated_at = NOW()`,
      [
        productId,
        s.total_reviews || 0,
        s.average_rating || 0,
        s.rating_1_count || 0,
        s.rating_2_count || 0,
        s.rating_3_count || 0,
        s.rating_4_count || 0,
        s.rating_5_count || 0,
      ]
    );

    return s;
  },

  /**
   * Check if a customer has a verified purchase of a product in the system
   */
  async checkVerifiedPurchase(userId, productId) {
    try {
      const res = await query(
        `SELECT o.id AS order_id
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE o.user_id = $1 
           AND oi.product_id = $2 
           AND o.status IN ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
         LIMIT 1`,
        [userId, productId]
      );

      if (res.rows.length > 0) {
        return { isVerified: true, orderId: res.rows[0].order_id };
      }
      return { isVerified: false, orderId: null };
    } catch (err) {
      logger.warn({ err: err.message, userId, productId }, 'Error checking order history for verified purchase');
      return { isVerified: false, orderId: null };
    }
  },

  /**
   * Create a new product review
   */
  async createReview(data, user, idempotencyKey = null) {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await query(
        `SELECT response_body, response_status 
         FROM review_idempotency 
         WHERE idempotency_key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [idempotencyKey]
      );

      if (existing.rows.length > 0) {
        logger.info({ idempotencyKey }, 'Returning cached idempotent response for review creation');
        return existing.rows[0].response_body;
      }
    }

    // 2. Duplicate Review Check
    const existingReview = await query(
      `SELECT id FROM product_reviews 
       WHERE user_id = $1 AND product_id = $2 AND deleted_at IS NULL`,
      [user.id, data.product_id]
    );

    if (existingReview.rows.length > 0) {
      throw new AppError(
        'You have already submitted a review for this product. You can edit your existing review.',
        409
      );
    }

    // 3. Verified Purchase Check
    let verifiedPurchase = false;
    let verifiedOrderId = data.order_id || null;

    const purchaseCheck = await this.checkVerifiedPurchase(user.id, data.product_id);
    if (purchaseCheck.isVerified) {
      verifiedPurchase = true;
      if (!verifiedOrderId) {
        verifiedOrderId = purchaseCheck.orderId;
      }
    }

    // 4. Atomic Creation & Summary Recalculation
    const createdReview = await withTransaction(async (client) => {
      const insertSql = `
        INSERT INTO product_reviews (
          product_id,
          variant_id,
          user_id,
          customer_name,
          order_id,
          rating,
          title,
          comment,
          verified_purchase,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED')
        RETURNING *
      `;

      const displayName = user.displayName || user.name || 'Verified Customer';

      const res = await client.query(insertSql, [
        data.product_id,
        data.variant_id || null,
        user.id,
        displayName,
        verifiedOrderId,
        data.rating,
        data.title || null,
        data.comment,
        verifiedPurchase,
      ]);

      const review = res.rows[0];

      // Save images if provided
      const insertedImages = [];
      if (Array.isArray(data.images) && data.images.length > 0) {
        for (let idx = 0; idx < data.images.length; idx++) {
          const imgUrl = data.images[idx];
          const imgRes = await client.query(
            `INSERT INTO review_images (review_id, image_url, sort_order)
             VALUES ($1, $2, $3)
             RETURNING id, image_url, sort_order`,
            [review.id, imgUrl, idx]
          );
          insertedImages.push(imgRes.rows[0]);
        }
      }

      // Update product rating summary
      await this.updateProductRatingSummary(client, data.product_id);

      return {
        ...review,
        images: insertedImages,
      };
    });

    // 5. Save Idempotency Record
    if (idempotencyKey) {
      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');

      await query(
        `INSERT INTO review_idempotency (idempotency_key, request_hash, response_status, response_body, expires_at)
         VALUES ($1, $2, 201, $3, NOW() + INTERVAL '24 hours')
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [idempotencyKey, hash, createdReview]
      ).catch(() => {});
    }

    logger.info({ reviewId: createdReview.id, productId: data.product_id, userId: user.id }, 'Product review created');
    return createdReview;
  },

  /**
   * Update an existing review (author or admin)
   */
  async updateReview(id, data, user) {
    const existing = await query(
      `SELECT * FROM product_reviews WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Review not found', 404);
    }

    const review = existing.rows[0];

    const isOwner = String(review.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only edit your own reviews.', 403);
    }

    const updated = await withTransaction(async (client) => {
      const newRating = data.rating !== undefined ? data.rating : review.rating;
      const newTitle = data.title !== undefined ? data.title : review.title;
      const newComment = data.comment !== undefined ? data.comment : review.comment;

      const updateRes = await client.query(
        `UPDATE product_reviews 
         SET rating = $1,
             title = $2,
             comment = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [newRating, newTitle, newComment, id]
      );

      // Replace images if explicitly supplied
      let currentImages = [];
      if (Array.isArray(data.images)) {
        await client.query(`DELETE FROM review_images WHERE review_id = $1`, [id]);
        for (let idx = 0; idx < data.images.length; idx++) {
          const imgRes = await client.query(
            `INSERT INTO review_images (review_id, image_url, sort_order)
             VALUES ($1, $2, $3)
             RETURNING id, image_url, sort_order`,
            [id, data.images[idx], idx]
          );
          currentImages.push(imgRes.rows[0]);
        }
      } else {
        const imgQuery = await client.query(
          `SELECT id, image_url, sort_order FROM review_images WHERE review_id = $1 ORDER BY sort_order ASC`,
          [id]
        );
        currentImages = imgQuery.rows;
      }

      // Update product rating summary
      await this.updateProductRatingSummary(client, review.product_id);

      return {
        ...updateRes.rows[0],
        images: currentImages,
      };
    });

    logger.info({ reviewId: id, userId: user.id }, 'Review updated successfully');
    return updated;
  },

  /**
   * Soft delete a review (author or admin)
   */
  async deleteReview(id, user) {
    const existing = await query(
      `SELECT * FROM product_reviews WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Review not found', 404);
    }

    const review = existing.rows[0];

    const isOwner = String(review.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only delete your own reviews.', 403);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE product_reviews 
         SET deleted_at = NOW(),
             status = 'HIDDEN'
         WHERE id = $1`,
        [id]
      );

      // Recalculate product rating summary
      await this.updateProductRatingSummary(client, review.product_id);
    });

    logger.info({ reviewId: id, userId: user.id }, 'Review soft-deleted successfully');
    return { success: true, message: 'Review deleted successfully' };
  },

  /**
   * List paginated approved reviews for a product with author, images, and user vote status
   */
  async listProductReviews(productId, queryParams = {}, currentUser = null) {
    const page = Number(queryParams.page) || 1;
    const limit = Math.min(Number(queryParams.limit) || 10, 50);
    const offset = (page - 1) * limit;

    const conditions = ['pr.product_id = $1', "pr.status = 'APPROVED'", 'pr.deleted_at IS NULL'];
    const values = [productId];
    let paramIndex = 2;

    if (queryParams.rating) {
      conditions.push(`pr.rating = $${paramIndex}`);
      values.push(Number(queryParams.rating));
      paramIndex++;
    }

    if (queryParams.verified_only === true || queryParams.verified_only === 'true') {
      conditions.push(`pr.verified_purchase = TRUE`);
    }

    if (queryParams.with_images === true || queryParams.with_images === 'true') {
      conditions.push(`EXISTS (SELECT 1 FROM review_images ri WHERE ri.review_id = pr.id)`);
    }

    // Determine Sorting
    let orderByClause = 'pr.created_at DESC';
    switch (queryParams.sort) {
      case 'oldest':
        orderByClause = 'pr.created_at ASC';
        break;
      case 'highest_rating':
        orderByClause = 'pr.rating DESC, pr.created_at DESC';
        break;
      case 'lowest_rating':
        orderByClause = 'pr.rating ASC, pr.created_at DESC';
        break;
      case 'most_helpful':
        orderByClause = 'pr.helpful_count DESC, pr.created_at DESC';
        break;
      default:
        orderByClause = 'pr.created_at DESC';
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total count query
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM product_reviews pr WHERE ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    // 2. Fetch reviews with joined images and author details
    const currentUserId = currentUser?.id || null;
    values.push(limit, offset);
    const limitParam = `$${paramIndex}`;
    const offsetParam = `$${paramIndex + 1}`;

    const reviewSql = `
      SELECT 
        pr.*,
        COALESCE(u.display_name, pr.customer_name, 'Verified Customer') AS author_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ri.id,
                'image_url', ri.image_url,
                'alt_text', ri.alt_text,
                'sort_order', ri.sort_order
              ) ORDER BY ri.sort_order ASC
            )
            FROM review_images ri
            WHERE ri.review_id = pr.id
          ),
          '[]'
        ) AS images,
        ${
          currentUserId
            ? `(SELECT rv.vote_type FROM review_votes rv WHERE rv.review_id = pr.id AND rv.user_id = '${currentUserId}' LIMIT 1)`
            : 'NULL'
        } AS user_vote
      FROM product_reviews pr
      LEFT JOIN users u ON pr.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const dataRes = await query(reviewSql, values);

    return {
      reviews: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  /**
   * Get rating summary breakdown for a product
   */
  async getProductRatingSummary(productId) {
    const res = await query(
      `SELECT * FROM product_rating_summaries WHERE product_id = $1`,
      [productId]
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    }

    // Fallback: Compute on-the-fly and persist
    return withTransaction(async (client) => {
      return this.updateProductRatingSummary(client, productId);
    });
  },

  /**
   * Helpful / Not Helpful vote toggle
   */
  async voteReview(reviewId, user, voteType) {
    const revRes = await query(
      `SELECT id, user_id, helpful_count, not_helpful_count FROM product_reviews WHERE id = $1 AND deleted_at IS NULL`,
      [reviewId]
    );

    if (revRes.rows.length === 0) {
      throw new AppError('Review not found', 404);
    }

    const review = revRes.rows[0];

    // Prevent voting on own review
    if (String(review.user_id) === String(user.id)) {
      throw new AppError('You cannot vote on your own review.', 400);
    }

    return withTransaction(async (client) => {
      const existingVote = await client.query(
        `SELECT id, vote_type FROM review_votes WHERE review_id = $1 AND user_id = $2 FOR UPDATE`,
        [reviewId, user.id]
      );

      let currentVoteType = null;
      let helpfulDelta = 0;
      let notHelpfulDelta = 0;

      if (existingVote.rows.length > 0) {
        const prev = existingVote.rows[0];
        if (prev.vote_type === voteType) {
          // Toggle off: remove vote
          await client.query(`DELETE FROM review_votes WHERE id = $1`, [prev.id]);
          if (voteType === 'HELPFUL') helpfulDelta = -1;
          if (voteType === 'NOT_HELPFUL') notHelpfulDelta = -1;
          currentVoteType = null;
        } else {
          // Switch vote
          await client.query(
            `UPDATE review_votes SET vote_type = $1, updated_at = NOW() WHERE id = $2`,
            [voteType, prev.id]
          );
          if (voteType === 'HELPFUL') {
            helpfulDelta = 1;
            notHelpfulDelta = -1;
          } else {
            helpfulDelta = -1;
            notHelpfulDelta = 1;
          }
          currentVoteType = voteType;
        }
      } else {
        // Insert new vote
        await client.query(
          `INSERT INTO review_votes (review_id, user_id, vote_type) VALUES ($1, $2, $3)`,
          [reviewId, user.id, voteType]
        );
        if (voteType === 'HELPFUL') helpfulDelta = 1;
        if (voteType === 'NOT_HELPFUL') notHelpfulDelta = 1;
        currentVoteType = voteType;
      }

      // Update review counts
      const updatedRev = await client.query(
        `UPDATE product_reviews 
         SET helpful_count = GREATEST(0, helpful_count + $1),
             not_helpful_count = GREATEST(0, not_helpful_count + $2)
         WHERE id = $3
         RETURNING id, helpful_count, not_helpful_count`,
        [helpfulDelta, notHelpfulDelta, reviewId]
      );

      return {
        review_id: reviewId,
        user_vote: currentVoteType,
        helpful_count: updatedRev.rows[0].helpful_count,
        not_helpful_count: updatedRev.rows[0].not_helpful_count,
      };
    });
  },

  /**
   * Report an inappropriate review
   */
  async reportReview(reviewId, user, data) {
    const revRes = await query(
      `SELECT id FROM product_reviews WHERE id = $1 AND deleted_at IS NULL`,
      [reviewId]
    );

    if (revRes.rows.length === 0) {
      throw new AppError('Review not found', 404);
    }

    // Check duplicate report
    const existing = await query(
      `SELECT id FROM review_reports WHERE review_id = $1 AND reported_by = $2`,
      [reviewId, user.id]
    );

    if (existing.rows.length > 0) {
      throw new AppError('You have already reported this review.', 409);
    }

    const reportRes = await query(
      `INSERT INTO review_reports (review_id, reported_by, reason, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [reviewId, user.id, data.reason, data.description || null]
    );

    logger.info({ reviewId, reportedBy: user.id, reason: data.reason }, 'Review reported for moderation');
    return reportRes.rows[0];
  },

  /**
   * Moderate review (Admin only)
   */
  async moderateReview(reviewId, user, action, reason = null) {
    const revRes = await query(
      `SELECT * FROM product_reviews WHERE id = $1`,
      [reviewId]
    );

    if (revRes.rows.length === 0) {
      throw new AppError('Review not found', 404);
    }

    const review = revRes.rows[0];
    let newStatus = review.status;

    switch (action) {
      case 'APPROVE':
        newStatus = 'APPROVED';
        break;
      case 'REJECT':
        newStatus = 'REJECTED';
        break;
      case 'HIDE':
        newStatus = 'HIDDEN';
        break;
      case 'RESTORE':
        newStatus = 'APPROVED';
        break;
      case 'DELETE':
        newStatus = 'HIDDEN';
        break;
      default:
        throw new AppError(`Unknown moderation action: ${action}`, 400);
    }

    return withTransaction(async (client) => {
      const updateRes = await client.query(
        `UPDATE product_reviews 
         SET status = $1,
             deleted_at = ${action === 'DELETE' ? 'NOW()' : 'deleted_at'},
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newStatus, reviewId]
      );

      // Log moderation action
      await client.query(
        `INSERT INTO review_moderation_logs 
          (review_id, moderator_id, action, previous_status, new_status, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [reviewId, user.id, action, review.status, newStatus, reason]
      );

      // Recalculate summary if status changed
      if (review.status !== newStatus) {
        await this.updateProductRatingSummary(client, review.product_id);
      }

      return updateRes.rows[0];
    });
  },

  /**
   * List reviews submitted by a specific user
   */
  async getUserReviews(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM product_reviews WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    const total = countRes.rows[0]?.total || 0;

    const dataRes = await query(
      `SELECT 
        pr.*,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ri.id,
                'image_url', ri.image_url,
                'alt_text', ri.alt_text,
                'sort_order', ri.sort_order
              ) ORDER BY ri.sort_order ASC
            )
            FROM review_images ri
            WHERE ri.review_id = pr.id
          ),
          '[]'
        ) AS images
      FROM product_reviews pr
      WHERE pr.user_id = $1 AND pr.deleted_at IS NULL
      ORDER BY pr.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      reviews: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },
};

export default reviewService;
