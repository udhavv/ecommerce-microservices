# Inventory Microservice

Production-grade, event-driven Inventory Microservice for the E-Commerce platform. Handles real-time stock levels, multi-tenant seller stock management, checkout reservations, dead-lock free concurrency controls, and asynchronous messaging via RabbitMQ.

---

## Features

- **Multi-Tenant Seller Security**: Enforces data isolation by tying inventory items to `seller_id (UUID)`. Sellers can only view, restock, and adjust their own items.
- **Race Condition & Deadlock Prevention**:
  - Uses PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) inside atomic database transactions (`withTransaction`).
  - Sorts variant IDs deterministically in ascending order during multi-item reservations to eliminate circular deadlock wait chains.
- **Optimistic Concurrency Control**: Tracks row `version` numbers for conflict detection.
- **Immutable Movement Ledger**: Complete audit log (`inventory_movements`) recording previous vs. new stock quantities, actor IDs, roles, and reference keys (`ORDER`, `RESTOCK`, etc.).
- **Asynchronous RabbitMQ Integration**:
  - **Consumers**:
    - `product.created`: Auto-provisions inventory items for newly created variants.
    - `product.deleted`: Soft-deactivates inventory items.
    - `order.created` / `order.placed`: Atomically reserves stock with a 15-minute TTL.
    - `order.paid` / `order.confirmed`: Permanently settles reservation to completed sales deduction.
    - `order.cancelled` / `order.failed`: Releases reserved stock back to available pool.
  - **Publishers**:
    - `inventory.low_stock`: Emitted when available stock drops below `low_stock_threshold`.
    - `inventory.out_of_stock`: Emitted when stock hits 0.
    - `inventory.stock_updated`: Emitted on any stock modification.
    - `inventory.reserved`: Emitted when stock reservation succeeds.
    - `inventory.reservation_failed`: Emitted on insufficient stock.
    - `inventory.released`: Emitted when reservation is released.
    - `inventory.confirmed`: Emitted when reservation is converted to sale.
- **Idempotency Guard**: Protects against duplicate distributed calls and retry storms.
- **Resilient Connection Handling**: RabbitMQ manager with auto-reconnection and exponential backoff so the service stays operational even if the broker restarts.

---

## Database Schema Highlights

1. **`inventory`**:
   - `id`, `seller_id (UUID)`, `product_id`, `variant_id (UNIQUE)`, `sku`, `quantity_available`, `quantity_reserved`, `low_stock_threshold`, `version`, `is_active`, `created_at`, `updated_at`.
   - Checks: `quantity_available >= 0`, `quantity_reserved >= 0`, `low_stock_threshold >= 0`.
2. **`inventory_reservations`**:
   - `id`, `order_id (VARCHAR(64))`, `variant_id`, `quantity`, `status` (`RESERVED`, `CONFIRMED`, `RELEASED`, `EXPIRED`), `expires_at`, `idempotency_key`.
3. **`inventory_movements`**:
   - `id`, `inventory_id`, `variant_id`, `movement_type`, `quantity`, `reference_type`, `reference_id`, `actor_id`, `actor_role`, `previous_available`, `new_available`, `previous_reserved`, `new_reserved`, `reason`.
4. **`inventory_idempotency`**:
   - `idempotency_key`, `request_hash`, `response_status`, `response_body`, `expires_at`.

---

## API Endpoints

Port: `4002` (configurable via `PORT` in `.env`)

### Public / Catalog Read
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/inventory/variant/:variantId` | Get live stock status for a variant |
| `GET` | `/api/inventory/product/:productId` | Get live stock for all variants of a product |
| `GET` | `/health` | Health check (PostgreSQL + RabbitMQ status) |

### Protected (Seller & Admin)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/inventory` | Seller / Admin | List inventory (Sellers see own items only) |
| `POST` | `/api/inventory` | Seller / Admin | Create / initialize stock for a variant |
| `PATCH` | `/api/inventory/:id/stock` | Seller / Admin | Adjust stock level (add, subtract, or set absolute) |
| `GET` | `/api/inventory/movements/:variantId` | Seller / Admin | View audit movement history |

### Checkout / Order Lifecycle
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/inventory/reserve` | Authenticated | Reserve items for checkout (with idempotency support) |
| `POST` | `/api/inventory/confirm` | Authenticated | Settle reservation to completed sale |
| `POST` | `/api/inventory/release` | Authenticated | Release held stock back to available pool |

---

## Quick Start

1. Initialize database and schema:
   ```bash
   npm run db:init
   ```
2. Start in development mode:
   ```bash
   npm run dev
   ```
3. Start in production mode:
   ```bash
   npm start
   ```

---

## Docker & RabbitMQ Setup

You can run the Inventory service alongside RabbitMQ using Docker and Docker Compose:

### 1. Build and Run via Docker Compose
```bash
# Start RabbitMQ and Inventory Service in the background
docker-compose up -d --build

# View container logs
docker-compose logs -f

# Check health and status
docker-compose ps
```

### 2. Available Services and Ports
- **Inventory Service**: `http://localhost:4002` (Health: `http://localhost:4002/health`)
- **RabbitMQ Broker**: `amqp://localhost:5672`
- **RabbitMQ Management Dashboard**: `http://localhost:15672` (Default credentials: `guest` / `guest`)

### 3. Stop Containers
```bash
docker-compose down
```

