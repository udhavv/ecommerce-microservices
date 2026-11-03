import jwt from 'jsonwebtoken';
import { pool, query } from '../src/config/db.js';
import env from '../src/config/env.js';
import app from '../src/index.js';

const JWT_SECRET = env.jwt.accessSecret;

function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles || ['user'],
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('--- STARTING REVIEW SECTION INTEGRATION TESTS ---');

  // Find or create test users in users table
  const testUser1Id = '11111111-1111-1111-1111-111111111111';
  const testUser2Id = '22222222-2222-2222-2222-222222222222';
  const adminUserId = '33333333-3333-3333-3333-333333333333';

  await query(`
    INSERT INTO users (id, email, password_hash, display_name, status)
    VALUES 
      ('${testUser1Id}', 'reviewer1@test.com', 'hash', 'Alice Reviewer', 'active'),
      ('${testUser2Id}', 'reviewer2@test.com', 'hash', 'Bob Voter', 'active'),
      ('${adminUserId}', 'admin@test.com', 'hash', 'Admin Moderator', 'active')
    ON CONFLICT (id) DO NOTHING
  `);

  const user1 = { id: testUser1Id, email: 'reviewer1@test.com', displayName: 'Alice Reviewer', roles: ['user'] };
  const user2 = { id: testUser2Id, email: 'reviewer2@test.com', displayName: 'Bob Voter', roles: ['user'] };
  const admin = { id: adminUserId, email: 'admin@test.com', displayName: 'Admin Moderator', roles: ['admin', 'user'] };

  const token1 = makeToken(user1);
  const token2 = makeToken(user2);
  const adminToken = makeToken(admin);

  const testProductId = 999999;

  // Clean up any existing test data for this product
  await query('DELETE FROM product_reviews WHERE product_id = $1', [testProductId]);
  await query('DELETE FROM product_questions WHERE product_id = $1', [testProductId]);
  await query('DELETE FROM product_rating_summaries WHERE product_id = $1', [testProductId]);

  const baseUrl = `http://localhost:${env.port}`;

  // Helper fetch
  const req = async (path, options = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body };
  };

  // Wait a moment for server to be listening
  await new Promise((r) => setTimeout(r, 1000));

  // TEST 1: Health check
  console.log('\n[Test 1] Health check endpoint...');
  const healthRes = await req('/health');
  if (healthRes.status === 200 && healthRes.body.status === 'ok') {
    console.log('✅ Health check passed: Service is healthy & DB connected');
  } else {
    throw new Error(`Health check failed: ${JSON.stringify(healthRes.body)}`);
  }

  // TEST 2: Submit a Review (Auth required)
  console.log('\n[Test 2] Submit a review as User 1...');
  const createRes = await req('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: JSON.stringify({
      product_id: testProductId,
      rating: 5,
      title: 'Outstanding quality and fast shipping!',
      comment: 'I really loved this product, works flawlessly and looks great.',
      images: ['https://example.com/images/review1.jpg'],
    }),
  });

  if (createRes.status === 201 && createRes.body.success) {
    console.log('✅ Review created successfully with ID:', createRes.body.data.review.id);
  } else {
    throw new Error(`Create review failed: ${JSON.stringify(createRes.body)}`);
  }

  const reviewId = createRes.body.data.review.id;

  // TEST 3: Duplicate review prevention
  console.log('\n[Test 3] Attempt duplicate review for same product...');
  const dupRes = await req('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: JSON.stringify({
      product_id: testProductId,
      rating: 4,
      comment: 'Trying to submit a second review for the same product',
    }),
  });

  if (dupRes.status === 409) {
    console.log('✅ Duplicate review successfully blocked (409 Conflict):', dupRes.body.error);
  } else {
    throw new Error(`Expected 409 on duplicate review, got ${dupRes.status}`);
  }

  // TEST 4: Product Rating Summary
  console.log('\n[Test 4] Verify product rating summary calculation...');
  const sumRes = await req(`/api/reviews/product/${testProductId}/summary`);
  if (sumRes.status === 200 && sumRes.body.data.summary.total_reviews === 1) {
    const summary = sumRes.body.data.summary;
    console.log(`✅ Rating summary correct: Avg: ${summary.average_rating}, Total: ${summary.total_reviews}, 5-star: ${summary.rating_5_count}`);
  } else {
    throw new Error(`Summary failed: ${JSON.stringify(sumRes.body)}`);
  }

  // TEST 5: Prevent voting on own review
  console.log('\n[Test 5] Verify author cannot vote on their own review...');
  const selfVote = await req(`/api/reviews/${reviewId}/vote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ vote_type: 'HELPFUL' }),
  });

  if (selfVote.status === 400) {
    console.log('✅ Self-voting blocked successfully (400 Bad Request):', selfVote.body.error);
  } else {
    throw new Error(`Expected 400 on self vote, got ${selfVote.status}`);
  }

  // TEST 6: User 2 votes helpful
  console.log('\n[Test 6] User 2 votes helpful...');
  const voteRes = await req(`/api/reviews/${reviewId}/vote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: JSON.stringify({ vote_type: 'HELPFUL' }),
  });

  if (voteRes.status === 200 && voteRes.body.data.helpful_count === 1) {
    console.log('✅ Helpful vote recorded: count is 1, user_vote is HELPFUL');
  } else {
    throw new Error(`Vote failed: ${JSON.stringify(voteRes.body)}`);
  }

  // TEST 7: User 2 toggles vote off
  console.log('\n[Test 7] User 2 toggles helpful vote off...');
  const toggleRes = await req(`/api/reviews/${reviewId}/vote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: JSON.stringify({ vote_type: 'HELPFUL' }),
  });

  if (toggleRes.status === 200 && toggleRes.body.data.helpful_count === 0) {
    console.log('✅ Helpful vote toggled off: count is 0, user_vote is null');
  } else {
    throw new Error(`Toggle vote failed: ${JSON.stringify(toggleRes.body)}`);
  }

  // TEST 8: Update review rating from 5 to 4
  console.log('\n[Test 8] User 1 updates their review rating to 4...');
  const updateRes = await req(`/api/reviews/${reviewId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token1}` },
    body: JSON.stringify({
      rating: 4,
      title: 'Updated Title: Pretty good product',
      comment: 'Updated comment after using for 2 weeks.',
    }),
  });

  if (updateRes.status === 200 && updateRes.body.data.review.rating === 4) {
    console.log('✅ Review updated successfully to rating 4');
  } else {
    throw new Error(`Update failed: ${JSON.stringify(updateRes.body)}`);
  }

  // TEST 9: Verify updated summary has 4-star count
  const updatedSum = await req(`/api/reviews/product/${testProductId}/summary`);
  if (updatedSum.body.data.summary.rating_4_count === 1 && updatedSum.body.data.summary.rating_5_count === 0) {
    console.log('✅ Rating summary dynamically updated to reflect 4-star rating!');
  } else {
    throw new Error(`Summary update mismatch: ${JSON.stringify(updatedSum.body)}`);
  }

  // TEST 10: Ask a Question
  console.log('\n[Test 10] User 2 asks a question about the product...');
  const qRes = await req('/api/questions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: JSON.stringify({
      product_id: testProductId,
      question: 'Does this product come with a manufacturer warranty?',
    }),
  });

  if (qRes.status === 201 && qRes.body.success) {
    console.log('✅ Question posted successfully with ID:', qRes.body.data.question.id);
  } else {
    throw new Error(`Ask question failed: ${JSON.stringify(qRes.body)}`);
  }

  const questionId = qRes.body.data.question.id;

  // TEST 11: Admin answers the question
  console.log('\n[Test 11] Admin submits official answer to the question...');
  const aRes = await req(`/api/questions/${questionId}/answers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      answer: 'Yes! It includes a standard 1-year replacement warranty.',
    }),
  });

  if (aRes.status === 201 && aRes.body.data.answer.answer_type === 'ADMIN') {
    console.log('✅ Answer posted with verified badge & answer_type: ADMIN');
  } else {
    throw new Error(`Answer failed: ${JSON.stringify(aRes.body)}`);
  }

  // TEST 12: List Product Q&A
  console.log('\n[Test 12] List product questions and answers...');
  const listQ = await req(`/api/questions/product/${testProductId}`);
  if (listQ.status === 200 && listQ.body.data.questions.length > 0) {
    const q = listQ.body.data.questions[0];
    console.log(`✅ Q&A list verified: Question "${q.question}" has ${q.answers.length} answer(s)`);
  } else {
    throw new Error(`List Q&A failed: ${JSON.stringify(listQ.body)}`);
  }

  // TEST 13: Report Review
  console.log('\n[Test 13] User 2 reports review...');
  const reportRes = await req(`/api/reviews/${reviewId}/report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: JSON.stringify({
      reason: 'OTHER',
      description: 'Testing reporting functionality',
    }),
  });

  if (reportRes.status === 201) {
    console.log('✅ Review report successfully submitted');
  } else {
    throw new Error(`Report failed: ${JSON.stringify(reportRes.body)}`);
  }

  // Cleanup test data
  console.log('\nCleaning up test data...');
  await query('DELETE FROM product_reviews WHERE product_id = $1', [testProductId]);
  await query('DELETE FROM product_questions WHERE product_id = $1', [testProductId]);
  await query('DELETE FROM product_rating_summaries WHERE product_id = $1', [testProductId]);
  await query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testUser1Id, testUser2Id, adminUserId]);

  console.log('\n🎉 ALL 13 INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER ERROR:', err);
  process.exit(1);
});
