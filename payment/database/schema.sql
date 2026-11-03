-- ==============================================================================
-- Payment Service Database Schema
-- Database: payment
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PAYMENTS TABLE
-- Master record of all payment intents and transactions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    -- Public unique payment reference (e.g. PAY-20261102-AB12CD)
    payment_reference VARCHAR(60) NOT NULL UNIQUE,

    -- Cross-service reference to Order Service (no DB foreign key)
    order_id BIGINT NOT NULL,
    order_number VARCHAR(50) NOT NULL,

    -- Customer identifier from Auth Service
    user_id UUID NOT NULL,

    -- Financial amounts
    amount NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',

    -- Payment status lifecycle
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'MOCK_CARD',
    provider VARCHAR(50) NOT NULL DEFAULT 'MOCK_GATEWAY',

    -- Mock Gateway Transaction reference
    provider_transaction_id VARCHAR(100),

    -- Idempotency key to prevent double charging
    idempotency_key VARCHAR(128) UNIQUE,

    -- Error tracking for declines or gateway failures
    error_code VARCHAR(50),
    error_message TEXT,

    -- Optional custom metadata (card last4, simulated bank, etc.)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    captured_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,

    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT payments_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT payments_status_check CHECK (
        status IN (
            'PENDING',
            'AUTHORIZED',
            'CAPTURED',
            'FAILED',
            'REFUNDED',
            'PARTIALLY_REFUNDED',
            'CANCELLED'
        )
    ),
    CONSTRAINT payments_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- ==============================================================================
-- 2. PAYMENT TRANSACTIONS TABLE (Audit Ledger)
-- Detailed ledger of every gateway action (auth, capture, refund, fail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    payment_id BIGINT NOT NULL
        REFERENCES payments(id) ON DELETE CASCADE,

    transaction_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL,

    -- Gateway raw payload or mock simulated response
    gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_type_check CHECK (
        transaction_type IN ('AUTHORIZE', 'CAPTURE', 'REFUND', 'VOID', 'DECLINE')
    ),
    CONSTRAINT transactions_status_check CHECK (
        status IN ('SUCCESS', 'FAILURE', 'PENDING')
    ),
    CONSTRAINT transactions_response_object CHECK (
        jsonb_typeof(gateway_response) = 'object'
    )
);

-- ==============================================================================
-- 3. PAYMENT REFUNDS TABLE
-- Records partial or full refund requests
-- ==============================================================================
CREATE TABLE IF NOT EXISTS payment_refunds (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    refund_reference VARCHAR(60) NOT NULL UNIQUE,

    payment_id BIGINT NOT NULL
        REFERENCES payments(id) ON DELETE CASCADE,

    amount NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    reason TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT refunds_amount_positive CHECK (amount > 0),
    CONSTRAINT refunds_status_check CHECK (
        status IN ('PENDING', 'COMPLETED', 'FAILED')
    )
);

-- ==============================================================================
-- 4. OUTBOX EVENTS TABLE (Transactional Outbox)
-- Ensures reliable at-least-once publishing to RabbitMQ
-- ==============================================================================
CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    event_type VARCHAR(150) NOT NULL,
    payload JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,

    CHECK (jsonb_typeof(payload) = 'object'),
    CHECK (attempts >= 0)
);

-- ==============================================================================
-- Indexes for High Performance Queries
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_number ON payments(order_number);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_outbox_pending ON outbox_events(next_attempt_at, created_at) WHERE published_at IS NULL;

COMMIT;
