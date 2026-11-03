import { query, withTransaction } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const qaService = {
  /**
   * Ask a question about a product
   */
  async createQuestion(data, user) {
    const authorName = user.displayName || user.name || 'Shopper';

    const res = await query(
      `INSERT INTO product_questions (product_id, user_id, author_name, question, status)
       VALUES ($1, $2, $3, $4, 'PUBLISHED')
       RETURNING *`,
      [data.product_id, user.id, authorName, data.question]
    );

    logger.info({ questionId: res.rows[0].id, productId: data.product_id, userId: user.id }, 'Product question asked');
    return res.rows[0];
  },

  /**
   * List questions and published answers for a product
   */
  async listProductQuestions(productId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*)::int AS total 
       FROM product_questions 
       WHERE product_id = $1 AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [productId]
    );
    const total = countRes.rows[0]?.total || 0;

    const sql = `
      SELECT 
        pq.*,
        COALESCE(u.display_name, pq.author_name, 'Shopper') AS author_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pa.id,
                'user_id', pa.user_id,
                'author_name', COALESCE(au.display_name, pa.author_name, 'Community Member'),
                'answer', pa.answer,
                'answer_type', pa.answer_type,
                'is_verified_seller', pa.is_verified_seller,
                'created_at', pa.created_at
              ) ORDER BY 
                CASE WHEN pa.answer_type = 'SELLER' THEN 1 
                     WHEN pa.answer_type = 'ADMIN' THEN 2 
                     ELSE 3 END,
                pa.created_at ASC
            )
            FROM product_answers pa
            LEFT JOIN users au ON pa.user_id = au.id
            WHERE pa.question_id = pq.id AND pa.status = 'PUBLISHED' AND pa.deleted_at IS NULL
          ),
          '[]'
        ) AS answers
      FROM product_questions pq
      LEFT JOIN users u ON pq.user_id = u.id
      WHERE pq.product_id = $1 AND pq.status = 'PUBLISHED' AND pq.deleted_at IS NULL
      ORDER BY pq.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const dataRes = await query(sql, [productId, limit, offset]);

    return {
      questions: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  /**
   * Submit an answer to a product question
   */
  async answerQuestion(questionId, data, user) {
    const qRes = await query(
      `SELECT * FROM product_questions WHERE id = $1 AND deleted_at IS NULL`,
      [questionId]
    );

    if (qRes.rows.length === 0) {
      throw new AppError('Question not found', 404);
    }

    const question = qRes.rows[0];

    // Determine answer type & seller verification
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = roles.includes('admin');
    const isSeller = roles.includes('seller');

    let answerType = 'CUSTOMER';
    let isVerifiedSeller = false;

    if (isAdmin) {
      answerType = 'ADMIN';
      isVerifiedSeller = true;
    } else if (isSeller) {
      // Check if this seller owns the product
      const prodRes = await query(
        `SELECT seller_id FROM products WHERE id = $1`,
        [question.product_id]
      ).catch(() => ({ rows: [] }));

      if (prodRes.rows.length > 0 && String(prodRes.rows[0].seller_id) === String(user.id)) {
        answerType = 'SELLER';
        isVerifiedSeller = true;
      }
    }

    const authorName = user.displayName || user.name || (isVerifiedSeller ? 'Official Seller' : 'Customer');

    const res = await query(
      `INSERT INTO product_answers (question_id, user_id, author_name, answer, answer_type, is_verified_seller, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED')
       RETURNING *`,
      [questionId, user.id, authorName, data.answer, answerType, isVerifiedSeller]
    );

    logger.info({ answerId: res.rows[0].id, questionId, userId: user.id }, 'Answer submitted for question');
    return res.rows[0];
  },

  /**
   * Soft delete a question (author or admin)
   */
  async deleteQuestion(id, user) {
    const qRes = await query(
      `SELECT * FROM product_questions WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (qRes.rows.length === 0) {
      throw new AppError('Question not found', 404);
    }

    const question = qRes.rows[0];
    const isOwner = String(question.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only delete your own questions.', 403);
    }

    await query(
      `UPDATE product_questions SET deleted_at = NOW(), status = 'HIDDEN' WHERE id = $1`,
      [id]
    );

    return { success: true, message: 'Question deleted successfully' };
  },

  /**
   * Soft delete an answer (author or admin)
   */
  async deleteAnswer(id, user) {
    const aRes = await query(
      `SELECT * FROM product_answers WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (aRes.rows.length === 0) {
      throw new AppError('Answer not found', 404);
    }

    const answer = aRes.rows[0];
    const isOwner = String(answer.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only delete your own answers.', 403);
    }

    await query(
      `UPDATE product_answers SET deleted_at = NOW(), status = 'HIDDEN' WHERE id = $1`,
      [id]
    );

    return { success: true, message: 'Answer deleted successfully' };
  },
};

export default qaService;
