# Product Microservice

High-performance product, catalog, and inventory pricing microservice for the e-commerce platform.

---

## 🏗️ Architecture & Features

- **Express.js (ES Modules)** with Helmet, CORS, and JSON parser
- **PostgreSQL Database (`pg`)** with connection pooling and transactional atomic operations
- **Zod Schemas** for request body and query parameter validation
- **Pino & Grafana Cloud Loki Logging**:
  - Request logging (HTTP method, route, status code, duration, IP, user-agent)
  - Direct async batch streaming to Grafana Cloud Loki using `loghttp` v1 protocol
- **Soft Deletes**: Products are safely archived with `deleted_at = NOW()` and `status = 'ARCHIVED'`
- **Hierarchical Categories**: Supports parent-child nested categories with tree mode

---

## 🗄️ Database Entities

| Table | Description |
|---|---|
| `categories` | Product categories with parent hierarchy and unique slugs |
| `products` | Core products with brand, description, and status (`DRAFT`, `ACTIVE`, `ARCHIVED`) |
| `product_categories` | Many-to-many relationship mapping between products and categories |
| `product_variants` | Product SKUs with JSONB attributes, price, currency, and active flag |
| `product_images` | Media assets with primary flag (`is_primary`), sort order, and variant link |

---

## 🔌 API Endpoints

### Health Check
- `GET /health` - Database connection and service health

### Products (`/api/products` or `/api/v1.0.0/products`)
- `GET /` - List products with pagination, search, category filter, brand, and min/max price
- `GET /:idOrSlug` - Get single product with categories, variants, and images
- `POST /` - Create product (supports atomic creation with variants, categories & images)
- `PUT /:id` - Update product details and category associations
- `DELETE /:id` - Soft-delete product

### Categories (`/api/categories` or `/api/v1.0.0/categories`)
- `GET /` - List all categories (supports `?tree=true` and `?is_active=true`)
- `GET /:idOrSlug` - Get category with subcategories & product counts
- `POST /` - Create new category
- `PUT /:id` - Update category details
- `DELETE /:id` - Delete category (protected against deleting categories with assigned products)

### Product Variants (`/api/products/:productId/variants` & `/api/variants/:id`)
- `GET /:productId/variants` - List all variants for a product
- `POST /:productId/variants` - Add variant to product
- `GET /api/variants/:id` - Get variant by ID
- `PUT /api/variants/:id` - Update variant (SKU, price, attributes, currency)
- `DELETE /api/variants/:id` - Delete variant

### Product Images (`/api/products/:productId/images` & `/api/images/:id`)
- `GET /:productId/images` - List images for product (supports `?variant_id=...`)
- `POST /:productId/images` - Add image to product (manages primary image constraint)
- `PUT /api/images/:id` - Update image metadata / primary flag
- `DELETE /api/images/:id` - Delete image

---

## ⚙️ Environment Variables

Defined in `.env`:

```env
PORT=4001
NODE_ENV=development
VERSION=1.0.0
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=hellowpin1
DB_NAME=test1
DATABASE_URL="postgresql://postgres:hellowpin1@localhost:5432/test1"
LOG_LEVEL=info
FRONTEND_URL_DEVELOPMENT=http://localhost:3000
PRODUCTION_FRONTEND_URL=http://localhost:3000
GRAFANA_CLOUD_LOKI_URL=https://logs-prod-028.grafana.net/loki/api/v1/push
GRAFANA_CLOUD_LOKI_USER=1828443
GRAFANA_CLOUD_API_TOKEN=...
```

---

## 🚀 Running the Service

```bash
# Start in development mode with nodemon
npm run dev

# Start in production mode
npm start
```
