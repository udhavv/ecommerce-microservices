-- ============================================================
-- REVIEW & ENGAGEMENT SERVICE DATABASE SCHEMA
-- Target Database: test1
-- ============================================================

-- ============================================================
-- 1. PRODUCT REVIEWS
-- Stores customer reviews and ratings.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id BIGINT NOT NULL,
    variant_id BIGINT,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    order_id BIGINT,

    rating SMALLINT NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    title VARCHAR(255),
    comment TEXT NOT NULL,

    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'HIDDEN'
            )
        ),

    helpful_count INTEGER NOT NULL DEFAULT 0,
    not_helpful_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_review_helpful_count
        CHECK (helpful_count >= 0),

    CONSTRAINT chk_review_not_helpful_count
        CHECK (not_helpful_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id
    ON product_reviews(product_id);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id
    ON product_reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_order_id
    ON product_reviews(order_id);

CREATE INDEX IF NOT EXISTS idx_reviews_status
    ON product_reviews(status);

CREATE INDEX IF NOT EXISTS idx_reviews_product_rating
    ON product_reviews(product_id, rating);

CREATE INDEX IF NOT EXISTS idx_reviews_created_at
    ON product_reviews(created_at DESC);

-- One review per customer per product (when active)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_product_review
    ON product_reviews(user_id, product_id)
    WHERE deleted_at IS NULL;


-- ============================================================
-- 2. REVIEW IMAGES
-- Stores image references for customer reviews.
-- ============================================================

CREATE TABLE IF NOT EXISTS review_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    review_id BIGINT NOT NULL
        REFERENCES product_reviews(id) ON DELETE CASCADE,

    image_url TEXT NOT NULL,

    alt_text VARCHAR(255),

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_review_image_sort
        CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id
    ON review_images(review_id);


-- ============================================================
-- 3. REVIEW VOTES
-- Customers can mark reviews as helpful or not helpful.
-- ============================================================

CREATE TABLE IF NOT EXISTS review_votes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    review_id BIGINT NOT NULL
        REFERENCES product_reviews(id) ON DELETE CASCADE,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    vote_type VARCHAR(15) NOT NULL
        CHECK (
            vote_type IN ('HELPFUL', 'NOT_HELPFUL')
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_review_user_vote
        UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review_id
    ON review_votes(review_id);

CREATE INDEX IF NOT EXISTS idx_review_votes_user_id
    ON review_votes(user_id);


-- ============================================================
-- 4. PRODUCT QUESTIONS
-- Customers can ask questions about products.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_questions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id BIGINT NOT NULL,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(255),

    question TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (
            status IN (
                'PENDING',
                'PUBLISHED',
                'REJECTED',
                'HIDDEN'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_questions_product_id
    ON product_questions(product_id);

CREATE INDEX IF NOT EXISTS idx_questions_user_id
    ON product_questions(user_id);

CREATE INDEX IF NOT EXISTS idx_questions_status
    ON product_questions(status);


-- ============================================================
-- 5. PRODUCT ANSWERS
-- Sellers, admins, or customers can answer questions.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_answers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    question_id BIGINT NOT NULL
        REFERENCES product_questions(id) ON DELETE CASCADE,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(255),

    answer TEXT NOT NULL,

    answer_type VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER'
        CHECK (
            answer_type IN (
                'CUSTOMER',
                'SELLER',
                'ADMIN'
            )
        ),

    is_verified_seller BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (
            status IN (
                'PUBLISHED',
                'HIDDEN',
                'REJECTED'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_answers_question_id
    ON product_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_answers_user_id
    ON product_answers(user_id);


-- ============================================================
-- 6. REVIEW REPORTS
-- Customers can report inappropriate reviews.
-- ============================================================

CREATE TABLE IF NOT EXISTS review_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    review_id BIGINT NOT NULL
        REFERENCES product_reviews(id) ON DELETE CASCADE,

    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    reason VARCHAR(50) NOT NULL
        CHECK (
            reason IN (
                'SPAM',
                'OFFENSIVE',
                'FAKE_REVIEW',
                'IRRELEVANT',
                'INAPPROPRIATE',
                'OTHER'
            )
        ),

    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'REVIEWED',
                'DISMISSED',
                'ACTION_TAKEN'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_review_id
    ON review_reports(review_id);

CREATE INDEX IF NOT EXISTS idx_reports_reported_by
    ON review_reports(reported_by);

CREATE INDEX IF NOT EXISTS idx_reports_status
    ON review_reports(status);


-- ============================================================
-- 7. REVIEW MODERATION LOGS
-- Tracks moderation actions performed by admins.
-- ============================================================

CREATE TABLE IF NOT EXISTS review_moderation_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    review_id BIGINT
        REFERENCES product_reviews(id) ON DELETE SET NULL,

    question_id BIGINT
        REFERENCES product_questions(id) ON DELETE SET NULL,

    answer_id BIGINT
        REFERENCES product_answers(id) ON DELETE SET NULL,

    moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    action VARCHAR(30) NOT NULL
        CHECK (
            action IN (
                'APPROVE',
                'REJECT',
                'HIDE',
                'RESTORE',
                'DELETE'
            )
        ),

    previous_status VARCHAR(20),
    new_status VARCHAR(20),

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_moderation_target
        CHECK (
            num_nonnulls(review_id, question_id, answer_id) = 1
        )
);

CREATE INDEX IF NOT EXISTS idx_moderation_review_id
    ON review_moderation_logs(review_id);

CREATE INDEX IF NOT EXISTS idx_moderation_moderator_id
    ON review_moderation_logs(moderator_id);

CREATE INDEX IF NOT EXISTS idx_moderation_created_at
    ON review_moderation_logs(created_at DESC);


-- ============================================================
-- 8. PRODUCT RATING SUMMARIES
-- Stores aggregated ratings for fast product queries.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_rating_summaries (
    product_id BIGINT PRIMARY KEY,

    total_reviews INTEGER NOT NULL DEFAULT 0,

    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,

    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_total_reviews
        CHECK (total_reviews >= 0),

    CONSTRAINT chk_average_rating
        CHECK (average_rating BETWEEN 0 AND 5),

    CONSTRAINT chk_rating_counts
        CHECK (
            rating_1_count >= 0
            AND rating_2_count >= 0
            AND rating_3_count >= 0
            AND rating_4_count >= 0
            AND rating_5_count >= 0
        )
);


-- ============================================================
-- 9. REVIEW IDEMPOTENCY
-- Prevents duplicate review submissions on request retries.
-- ============================================================

CREATE TABLE IF NOT EXISTS review_idempotency (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    idempotency_key VARCHAR(255) NOT NULL UNIQUE,

    request_hash VARCHAR(64) NOT NULL,

    response_status INTEGER,
    response_body JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_idempotency_expiry
    ON review_idempotency(expires_at);
