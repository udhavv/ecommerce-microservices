import { jest } from '@jest/globals';

export const tables = {
  users: [],
  product_reviews: [],
  review_images: [],
  review_votes: [],
  review_reports: [],
  product_questions: [],
  product_answers: [],
  product_rating_summaries: [],
  review_idempotency: [],
};

let nextIds = {
  review: 1,
  image: 1,
  vote: 1,
  report: 1,
  question: 1,
  answer: 1,
};

export function resetDatabase() {
  tables.users = [];
  tables.product_reviews = [];
  tables.review_images = [];
  tables.review_votes = [];
  tables.review_reports = [];
  tables.product_questions = [];
  tables.product_answers = [];
  tables.product_rating_summaries = [];
  tables.review_idempotency = [];
  nextIds = { review: 1, image: 1, vote: 1, report: 1, question: 1, answer: 1 };
}

export async function handleQuery(sql, params = []) {
  const query = sql.replace(/\s+/g, ' ').trim();

  // Transactions & Health Checks
  if (
    query === 'BEGIN' ||
    query === 'COMMIT' ||
    query === 'ROLLBACK' ||
    query.startsWith('SELECT 1')
  ) {
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  }

  // 1. Rating Summary Aggregation Query
  if (query.includes('FROM product_reviews') && query.includes('AVG(rating)')) {
    const [productId] = params;
    const active = tables.product_reviews.filter(
      (r) => String(r.product_id) === String(productId) && r.status === 'APPROVED' && !r.deleted_at
    );
    const total_reviews = active.length;
    const sum = active.reduce((acc, r) => acc + Number(r.rating), 0);
    const average_rating = total_reviews > 0 ? Number((sum / total_reviews).toFixed(2)) : 0;
    const r1 = active.filter((r) => Number(r.rating) === 1).length;
    const r2 = active.filter((r) => Number(r.rating) === 2).length;
    const r3 = active.filter((r) => Number(r.rating) === 3).length;
    const r4 = active.filter((r) => Number(r.rating) === 4).length;
    const r5 = active.filter((r) => Number(r.rating) === 5).length;

    return {
      rows: [
        {
          total_reviews,
          average_rating,
          rating_1_count: r1,
          rating_2_count: r2,
          rating_3_count: r3,
          rating_4_count: r4,
          rating_5_count: r5,
        },
      ],
      rowCount: 1,
    };
  }

  // 2. Rating Summaries Upsert / Select
  if (query.includes('INSERT INTO product_rating_summaries')) {
    const [productId, total, avg, r1, r2, r3, r4, r5] = params;
    const idx = tables.product_rating_summaries.findIndex((s) => String(s.product_id) === String(productId));
    const summary = {
      product_id: Number(productId),
      total_reviews: Number(total),
      average_rating: Number(avg),
      rating_1_count: Number(r1),
      rating_2_count: Number(r2),
      rating_3_count: Number(r3),
      rating_4_count: Number(r4),
      rating_5_count: Number(r5),
      updated_at: new Date(),
    };
    if (idx !== -1) {
      tables.product_rating_summaries[idx] = summary;
    } else {
      tables.product_rating_summaries.push(summary);
    }
    return { rows: [{ ...summary }], rowCount: 1 };
  }

  if (query.includes('FROM product_rating_summaries WHERE product_id = $1')) {
    const [productId] = params;
    const summary = tables.product_rating_summaries.find((s) => String(s.product_id) === String(productId));
    return { rows: summary ? [{ ...summary }] : [], rowCount: summary ? 1 : 0 };
  }

  // 3. Verified Purchase Order Check
  if (query.includes('FROM orders o') && query.includes('JOIN order_items oi')) {
    return { rows: [], rowCount: 0 };
  }

  // 4. Review Idempotency Check & Insert
  if (query.includes('FROM review_idempotency WHERE idempotency_key = $1')) {
    const [key] = params;
    const record = tables.review_idempotency.find((i) => i.idempotency_key === key);
    return { rows: record ? [{ ...record }] : [], rowCount: record ? 1 : 0 };
  }

  if (query.includes('INSERT INTO review_idempotency')) {
    const [key, hash, body] = params;
    tables.review_idempotency.push({
      idempotency_key: key,
      request_hash: hash,
      response_status: 201,
      response_body: body,
      expires_at: new Date(Date.now() + 86400000),
    });
    return { rows: [], rowCount: 1 };
  }

  // 5. Existing Review Duplicate Check
  if (query.includes('FROM product_reviews WHERE user_id = $1 AND product_id = $2 AND deleted_at IS NULL')) {
    const [userId, productId] = params;
    const existing = tables.product_reviews.find(
      (r) => String(r.user_id) === String(userId) && String(r.product_id) === String(productId) && !r.deleted_at
    );
    return { rows: existing ? [{ id: existing.id }] : [], rowCount: existing ? 1 : 0 };
  }

  // 6. Review Single Select
  if (
    query.startsWith('SELECT') &&
    (query.includes('FROM product_reviews WHERE id = $1') || query.includes('SELECT * FROM product_reviews WHERE id = $1'))
  ) {
    const [id] = params;
    const rev = tables.product_reviews.find((r) => String(r.id) === String(id));
    return { rows: rev ? [{ ...rev }] : [], rowCount: rev ? 1 : 0 };
  }

  // 7. Insert Review
  if (query.includes('INSERT INTO product_reviews')) {
    const [product_id, variant_id, user_id, customer_name, order_id, rating, title, comment, verified_purchase] = params;
    const newRev = {
      id: nextIds.review++,
      product_id: Number(product_id),
      variant_id: variant_id ? Number(variant_id) : null,
      user_id,
      customer_name: customer_name || 'Verified Customer',
      order_id: order_id || null,
      rating: Number(rating),
      title: title || null,
      comment,
      verified_purchase: !!verified_purchase,
      status: 'APPROVED',
      helpful_count: 0,
      not_helpful_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    tables.product_reviews.push(newRev);
    return { rows: [{ ...newRev }], rowCount: 1 };
  }

  // 8. Update Review
  if (query.includes('UPDATE product_reviews SET rating = $1')) {
    const [rating, title, comment, id] = params;
    const rev = tables.product_reviews.find((r) => String(r.id) === String(id));
    if (!rev) return { rows: [], rowCount: 0 };
    rev.rating = Number(rating);
    rev.title = title;
    rev.comment = comment;
    rev.updated_at = new Date();
    return { rows: [{ ...rev }], rowCount: 1 };
  }

  if (query.includes('UPDATE product_reviews SET deleted_at = NOW()')) {
    const [id] = params;
    const rev = tables.product_reviews.find((r) => String(r.id) === String(id));
    if (rev) {
      rev.deleted_at = new Date();
      rev.status = 'HIDDEN';
    }
    return { rows: rev ? [{ ...rev }] : [], rowCount: rev ? 1 : 0 };
  }

  if (query.includes('UPDATE product_reviews SET helpful_count = GREATEST(0, helpful_count + $1)')) {
    const [helpfulDelta, notHelpfulDelta, reviewId] = params;
    const rev = tables.product_reviews.find((r) => String(r.id) === String(reviewId));
    if (rev) {
      rev.helpful_count = Math.max(0, rev.helpful_count + Number(helpfulDelta));
      rev.not_helpful_count = Math.max(0, rev.not_helpful_count + Number(notHelpfulDelta));
    }
    return {
      rows: rev ? [{ id: rev.id, helpful_count: rev.helpful_count, not_helpful_count: rev.not_helpful_count }] : [],
      rowCount: rev ? 1 : 0,
    };
  }

  // 9. Review Images
  if (query.includes('INSERT INTO review_images')) {
    const [review_id, image_url, sort_order] = params;
    const img = {
      id: nextIds.image++,
      review_id: Number(review_id),
      image_url,
      alt_text: null,
      sort_order: sort_order ?? 0,
      created_at: new Date(),
    };
    tables.review_images.push(img);
    return { rows: [{ ...img }], rowCount: 1 };
  }

  if (query.includes('SELECT id, image_url, sort_order FROM review_images WHERE review_id = $1')) {
    const [reviewId] = params;
    const imgs = tables.review_images.filter((i) => String(i.review_id) === String(reviewId));
    return { rows: imgs.map((i) => ({ ...i })), rowCount: imgs.length };
  }

  if (query.includes('DELETE FROM review_images WHERE review_id = $1')) {
    const [reviewId] = params;
    tables.review_images = tables.review_images.filter((i) => String(i.review_id) !== String(reviewId));
    return { rows: [], rowCount: 1 };
  }

  // 10. List Product Reviews (Count & Data)
  if (query.includes('SELECT COUNT(*)::int AS total FROM product_reviews pr')) {
    const [productId] = params;
    const approved = tables.product_reviews.filter(
      (r) => String(r.product_id) === String(productId) && r.status === 'APPROVED' && !r.deleted_at
    );
    return { rows: [{ total: approved.length }], rowCount: 1 };
  }

  if (query.includes('SELECT pr.*') && query.includes('FROM product_reviews pr')) {
    const [productId] = params;
    const approved = tables.product_reviews.filter(
      (r) => String(r.product_id) === String(productId) && r.status === 'APPROVED' && !r.deleted_at
    );
    const enriched = approved.map((r) => ({
      ...r,
      author_name: r.customer_name || 'Verified Customer',
      images: tables.review_images.filter((i) => i.review_id === r.id),
      user_vote: null,
    }));
    return { rows: enriched, rowCount: enriched.length };
  }

  // 11. Review Votes
  if (query.includes('FROM review_votes WHERE review_id = $1 AND user_id = $2')) {
    const [reviewId, userId] = params;
    const vote = tables.review_votes.find((v) => String(v.review_id) === String(reviewId) && String(v.user_id) === String(userId));
    return { rows: vote ? [{ ...vote }] : [], rowCount: vote ? 1 : 0 };
  }

  if (query.includes('INSERT INTO review_votes')) {
    const [review_id, user_id, vote_type] = params;
    const vote = {
      id: nextIds.vote++,
      review_id: Number(review_id),
      user_id,
      vote_type,
      created_at: new Date(),
      updated_at: new Date(),
    };
    tables.review_votes.push(vote);
    return { rows: [{ ...vote }], rowCount: 1 };
  }

  if (query.includes('UPDATE review_votes SET vote_type = $1')) {
    const [vote_type, id] = params;
    const vote = tables.review_votes.find((v) => String(v.id) === String(id));
    if (vote) {
      vote.vote_type = vote_type;
      vote.updated_at = new Date();
    }
    return { rows: vote ? [{ ...vote }] : [], rowCount: vote ? 1 : 0 };
  }

  if (query.includes('DELETE FROM review_votes WHERE id = $1')) {
    const [id] = params;
    const idx = tables.review_votes.findIndex((v) => String(v.id) === String(id));
    if (idx !== -1) tables.review_votes.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }

  // 12. Review Reports
  if (query.includes('FROM review_reports WHERE review_id = $1 AND reported_by = $2')) {
    const [reviewId, userId] = params;
    const r = tables.review_reports.find((rep) => String(rep.review_id) === String(reviewId) && String(rep.reported_by) === String(userId));
    return { rows: r ? [{ id: r.id }] : [], rowCount: r ? 1 : 0 };
  }

  if (query.includes('INSERT INTO review_reports')) {
    const [review_id, reported_by, reason, description] = params;
    const report = {
      id: nextIds.report++,
      review_id: Number(review_id),
      reported_by,
      reason,
      description: description || null,
      status: 'PENDING',
      created_at: new Date(),
    };
    tables.review_reports.push(report);
    return { rows: [{ ...report }], rowCount: 1 };
  }

  // 13. Questions & Answers
  if (query.includes('INSERT INTO product_questions')) {
    const [product_id, user_id, author_name, question] = params;
    const q = {
      id: nextIds.question++,
      product_id: Number(product_id),
      user_id,
      author_name,
      question,
      status: 'PUBLISHED',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    tables.product_questions.push(q);
    return { rows: [{ ...q }], rowCount: 1 };
  }

  if (query.includes('SELECT COUNT(*)::int AS total FROM product_questions')) {
    const [productId] = params;
    const active = tables.product_questions.filter(
      (q) => String(q.product_id) === String(productId) && q.status === 'PUBLISHED' && !q.deleted_at
    );
    return { rows: [{ total: active.length }], rowCount: 1 };
  }

  if (query.includes('SELECT pq.*') && query.includes('FROM product_questions pq')) {
    const [productId] = params;
    const active = tables.product_questions.filter(
      (q) => String(q.product_id) === String(productId) && q.status === 'PUBLISHED' && !q.deleted_at
    );
    const enriched = active.map((q) => ({
      ...q,
      answers: tables.product_answers.filter((a) => a.question_id === q.id && a.status === 'PUBLISHED' && !a.deleted_at),
    }));
    return { rows: enriched, rowCount: enriched.length };
  }

  if (query.includes('FROM product_questions WHERE id = $1')) {
    const [id] = params;
    const q = tables.product_questions.find((item) => String(item.id) === String(id));
    return { rows: q ? [{ ...q }] : [], rowCount: q ? 1 : 0 };
  }

  if (query.includes('UPDATE product_questions SET deleted_at = NOW()')) {
    const [id] = params;
    const q = tables.product_questions.find((item) => String(item.id) === String(id));
    if (q) {
      q.deleted_at = new Date();
      q.status = 'HIDDEN';
    }
    return { rows: q ? [{ ...q }] : [], rowCount: q ? 1 : 0 };
  }

  if (query.includes('INSERT INTO product_answers')) {
    const [question_id, user_id, author_name, answer, answer_type, is_verified_seller] = params;
    const a = {
      id: nextIds.answer++,
      question_id: Number(question_id),
      user_id,
      author_name,
      answer,
      answer_type: answer_type || 'CUSTOMER',
      is_verified_seller: !!is_verified_seller,
      status: 'PUBLISHED',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    tables.product_answers.push(a);
    return { rows: [{ ...a }], rowCount: 1 };
  }

  if (query.includes('FROM product_answers WHERE id = $1')) {
    const [id] = params;
    const a = tables.product_answers.find((item) => String(item.id) === String(id));
    return { rows: a ? [{ ...a }] : [], rowCount: a ? 1 : 0 };
  }

  if (query.includes('UPDATE product_answers SET deleted_at = NOW()')) {
    const [id] = params;
    const a = tables.product_answers.find((item) => String(item.id) === String(id));
    if (a) {
      a.deleted_at = new Date();
      a.status = 'HIDDEN';
    }
    return { rows: a ? [{ ...a }] : [], rowCount: a ? 1 : 0 };
  }

  return { rows: [], rowCount: 0 };
}

export const mockClient = {
  query: jest.fn(handleQuery),
  release: jest.fn(),
};

export const mockPool = {
  query: jest.fn(handleQuery),
  connect: jest.fn(async () => mockClient),
  on: jest.fn(),
  end: jest.fn(),
};

export async function withTransaction(callback) {
  return callback(mockClient);
}
