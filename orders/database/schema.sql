-- =========================================================
-- Order Service
-- Database: order_db
-- =========================================================

BEGIN;

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number VARCHAR(40) NOT NULL UNIQUE,

    -- Reference to Auth Service. No cross-service foreign key.
    user_id BIGINT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    currency CHAR(3) NOT NULL DEFAULT 'USD',
    subtotal NUMERIC(12, 2) NOT NULL,
    shipping_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,

    -- Snapshot of customer contact information at checkout.
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,

    -- Snapshots preserve the address used for this order.
    shipping_address JSONB NOT NULL,
    billing_address JSONB,

    idempotency_key VARCHAR(128) UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT orders_status_check CHECK (
        status IN (
            'PENDING',
            'CONFIRMED',
            'PROCESSING',
            'SHIPPED',
            'DELIVERED',
            'CANCELLED',
            'FAILED'
        )
    ),

    CONSTRAINT orders_payment_status_check CHECK (
        payment_status IN (
            'PENDING',
            'AUTHORIZED',
            'PAID',
            'FAILED',
            'REFUNDED',
            'PARTIALLY_REFUNDED'
        )
    ),

    CONSTRAINT orders_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT orders_amounts_nonnegative CHECK (
        subtotal >= 0
        AND shipping_fee >= 0
        AND tax_amount >= 0
        AND discount_amount >= 0
        AND total_amount >= 0
    ),

    CONSTRAINT orders_total_consistency CHECK (
        total_amount =
            subtotal + shipping_fee + tax_amount - discount_amount
    ),

    CONSTRAINT orders_shipping_address_object CHECK (
        jsonb_typeof(shipping_address) = 'object'
    ),

    CONSTRAINT orders_billing_address_object CHECK (
        billing_address IS NULL
        OR jsonb_typeof(billing_address) = 'object'
    )
);



CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,

    -- Product Service identifiers are snapshots, not foreign keys.
    product_id BIGINT NOT NULL,
    variant_id BIGINT NOT NULL,

    -- Historical snapshots at the time of purchase.
    product_name VARCHAR(200) NOT NULL,
    variant_name VARCHAR(160),
    sku VARCHAR(100) NOT NULL,

    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT order_items_quantity_positive
        CHECK (quantity > 0),

    CONSTRAINT order_items_price_nonnegative
        CHECK (unit_price >= 0),

    CONSTRAINT order_items_total_consistency
        CHECK (line_total = quantity * unit_price),

    CONSTRAINT order_items_currency_check
        CHECK (currency ~ '^[A-Z]{3}$')
);




CREATE TABLE order_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,

    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    reason TEXT,

    -- Optional event or request correlation identifier.
    correlation_id VARCHAR(128),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        changed_by IN (
            'CUSTOMER',
            'ADMIN',
            'SYSTEM',
            'PAYMENT_SERVICE',
            'INVENTORY_SERVICE'
        )
    )
);




-- Transactional outbox: events are inserted in the same transaction
-- as the order change and published asynchronously to RabbitMQ.
CREATE TABLE outbox_events (
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

CREATE INDEX idx_orders_user_created
    ON orders(user_id, created_at DESC);

CREATE INDEX idx_orders_status_created
    ON orders(status, created_at DESC);

CREATE INDEX idx_orders_payment_status
    ON orders(payment_status, created_at DESC);

CREATE INDEX idx_order_items_order_id
    ON order_items(order_id);

CREATE INDEX idx_order_items_product_id
    ON order_items(product_id);

CREATE INDEX idx_order_status_history_order
    ON order_status_history(order_id, created_at DESC);

CREATE INDEX idx_outbox_pending
    ON outbox_events(next_attempt_at, created_at)
    WHERE published_at IS NULL;

COMMIT;