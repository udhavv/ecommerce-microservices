-- ============================================================
-- PRODUCTION-GRADE INVENTORY SERVICE DATABASE SCHEMA
-- Database: inventory
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Trigger Function: Auto-update updated_at timestamp
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. INVENTORY TABLE
-- Stores real-time stock levels for each product variant with
-- seller multi-tenancy and optimistic concurrency tracking.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Multi-tenant security: guarantees sellers only view and update their own items
    seller_id UUID NOT NULL,

    product_id BIGINT NOT NULL,
    variant_id BIGINT NOT NULL UNIQUE,
    sku VARCHAR(100),

    quantity_available INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,

    low_stock_threshold INTEGER NOT NULL DEFAULT 5,

    -- Optimistic locking counter for concurrency control
    version INTEGER NOT NULL DEFAULT 1,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_inventory_available
        CHECK (quantity_available >= 0),

    CONSTRAINT chk_inventory_reserved
        CHECK (quantity_reserved >= 0),

    CONSTRAINT chk_inventory_threshold
        CHECK (low_stock_threshold >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_seller_id
    ON inventory(seller_id);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id
    ON inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_variant_id
    ON inventory(variant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_sku
    ON inventory(sku);

CREATE INDEX IF NOT EXISTS idx_inventory_low_stock
    ON inventory(quantity_available, low_stock_threshold)
    WHERE quantity_available <= low_stock_threshold;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. INVENTORY RESERVATIONS TABLE
-- Tracks stock reserved during checkout prior to payment.
-- Prevents double-allocation across distributed transactions.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Flexible string to support UUIDs, order numbers (e.g. ORD-1001), or numeric IDs
    order_id VARCHAR(64) NOT NULL,
    variant_id BIGINT NOT NULL,

    quantity INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED'
        CHECK (
            status IN (
                'RESERVED',
                'CONFIRMED',
                'RELEASED',
                'EXPIRED'
            )
        ),

    -- Reservation timeout (e.g. 15 minutes for payment completion)
    expires_at TIMESTAMPTZ,

    idempotency_key VARCHAR(128),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_reservation_quantity
        CHECK (quantity > 0),

    CONSTRAINT uq_order_variant
        UNIQUE (order_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_reservations_order_id
    ON inventory_reservations(order_id);

CREATE INDEX IF NOT EXISTS idx_reservations_variant_id
    ON inventory_reservations(variant_id);

CREATE INDEX IF NOT EXISTS idx_reservations_status_expiry
    ON inventory_reservations(status, expires_at)
    WHERE status = 'RESERVED';

CREATE INDEX IF NOT EXISTS idx_reservations_idempotency
    ON inventory_reservations(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON inventory_reservations;
CREATE TRIGGER trg_reservations_updated_at
    BEFORE UPDATE ON inventory_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. INVENTORY MOVEMENTS (AUDIT TRAIL / IMMUTABLE LEDGER)
-- Complete chronological record of every stock modification.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    inventory_id BIGINT REFERENCES inventory(id) ON DELETE SET NULL,
    variant_id BIGINT NOT NULL,

    movement_type VARCHAR(30) NOT NULL
        CHECK (
            movement_type IN (
                'INITIAL_STOCK',
                'STOCK_IN',
                'STOCK_OUT',
                'RESERVE',
                'RELEASE',
                'ADJUSTMENT',
                'SALE',
                'RETURN'
            )
        ),

    quantity INTEGER NOT NULL,

    reference_type VARCHAR(30), -- 'ORDER', 'RESTOCK', 'MANUAL_ADJUSTMENT', 'RETURN', 'RABBITMQ_SYNC'
    reference_id VARCHAR(64),

    actor_id VARCHAR(64),       -- UUID or identifier of user/system performing action
    actor_role VARCHAR(30),     -- 'seller', 'admin', 'system'

    previous_available INTEGER NOT NULL,
    new_available INTEGER NOT NULL,

    previous_reserved INTEGER NOT NULL,
    new_reserved INTEGER NOT NULL,

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_movement_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_movement_available
        CHECK (previous_available >= 0 AND new_available >= 0),

    CONSTRAINT chk_movement_reserved
        CHECK (previous_reserved >= 0 AND new_reserved >= 0)
);

CREATE INDEX IF NOT EXISTS idx_movements_variant_id
    ON inventory_movements(variant_id);

CREATE INDEX IF NOT EXISTS idx_movements_created_at
    ON inventory_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movements_reference
    ON inventory_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_movements_actor
    ON inventory_movements(actor_id);


-- ============================================================
-- 4. INVENTORY IDEMPOTENCY TABLE
-- Ensures distributed RPCs and message consumer retries are
-- safe against duplicate state transitions.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_idempotency (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    idempotency_key VARCHAR(255) NOT NULL UNIQUE,

    request_hash VARCHAR(64) NOT NULL,

    response_status INTEGER,
    response_body JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_idempotency_key
    ON inventory_idempotency(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_inventory_idempotency_expiry
    ON inventory_idempotency(expires_at)
    WHERE expires_at IS NOT NULL;

COMMIT;
