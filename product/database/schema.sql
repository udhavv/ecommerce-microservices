-- =========================================================
-- Product Service
-- Database: product_db
-- =========================================================

BEGIN;

CREATE TABLE categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    description TEXT,
    parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(name)) > 0),
    CHECK (length(trim(slug)) > 0)
);



CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    description TEXT,
    brand VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    seller_id uuid NOT NULL,
    CHECK (length(trim(name)) > 0),
    CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);



CREATE TABLE product_categories (
    product_id BIGINT NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL
        REFERENCES categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (product_id, category_id)
);



CREATE TABLE product_variants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL UNIQUE,
    variant_name VARCHAR(160),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    price NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(sku)) > 0),
    CHECK (price >= 0),
    CHECK (currency ~ '^[A-Z]{3}$'),
    CHECK (jsonb_typeof(attributes) = 'object')
);



CREATE TABLE product_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,
    variant_id BIGINT
        REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(image_url)) > 0),
    CHECK (sort_order >= 0)
);



CREATE INDEX idx_product_images_product_sort
    ON product_images(product_id, sort_order);

CREATE UNIQUE INDEX uq_product_primary_image
    ON product_images(product_id)
    WHERE is_primary = TRUE AND variant_id IS NULL;

CREATE INDEX idx_categories_parent_id
    ON categories(parent_id);

CREATE INDEX idx_products_status_created
    ON products(status, created_at DESC);

CREATE INDEX idx_product_categories_category
    ON product_categories(category_id, product_id);


CREATE INDEX idx_variants_product
    ON product_variants(product_id);


CREATE INDEX idx_products_seller ON products(seller_id);

  

  

  

COMMIT;