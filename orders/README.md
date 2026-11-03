# Order Microservice

Production-grade, event-driven Order Microservice for the E-Commerce platform. Orchestrates multi-service workflows across **Auth**, **Product**, and **Inventory** services with transactional outbox messaging, zero-trust price snapshotting, synchronous stock holds, and asynchronous RabbitMQ event streaming.

---

## Architecture & Workflow

```
[ Frontend / Client ]
         │
         │  1. POST /api/orders (items, shipping_address)
         ▼
[ Order Service (Port 4003) ]
         │
         ├─► 2. Validate Product & Snapshots (Price, SKU, Name) ──► [ Product Service (Port 4001) ]
         │
         ├─► 3. Synchronous Stock Hold (15-min TTL) ─────────────► [ Inventory Service (Port 4002) ]
         │
         ├─► 4. Atomic PostgreSQL Transaction:
         │      - Insert `orders`
         │      - Insert `order_items`
         │      - Insert `order_status_history`
         │      - Insert `outbox_events` (`order.created`)
         │
         ▼
[ RabbitMQ Event Bus ] ◄── 5. Asynchronous Outbox Dispatcher
         │
         ├─► `order.created`   ──► Consumed by Inventory / Analytics
         ├─► `order.paid`      ──► Consumed by Inventory (confirms permanent deduction)
         └─► `order.cancelled` ──► Consumed by Inventory (releases held stock back to pool)
```

---

## Features

- **Multi-Service Verification**: Validates product status and variant prices against the Product microservice. Never trusts client-submitted prices.
- **Two-Phase Inventory Reservation**: Synchronously holds inventory in the Inventory service during checkout to prevent overselling. Rejects order creation immediately if stock is depleted.
- **Transactional Outbox Pattern**: Order state changes and event logs are committed atomically to PostgreSQL (`outbox_events`). A background worker dispatches events to RabbitMQ with exponential backoff and retry guarantees.
- **Idempotency Guard**: Replays the existing order if an order creation request is repeated with the same `idempotency_key`, preventing duplicate charges and bookings.
- **Order Lifecycle Management**:
  - `PENDING`: Order created and stock held.
  - `CONFIRMED`: Payment settled (`POST /api/orders/:id/pay`), permanently deducting inventory.
  - `CANCELLED`: Order cancelled (`POST /api/orders/:id/cancel`), automatically releasing held stock back to the inventory pool.
  - `PROCESSING` ➔ `SHIPPED` ➔ `DELIVERED`: Admin/fulfillment status advancement (`PATCH /api/orders/:id/status`).
- **Multi-Tenant Security**: Customers can only view and cancel their own orders. Administrators have full visibility and fulfillment control.

---

## API Endpoints

Port: `4003` (prefix: `/api/orders` or `/api/v1/orders`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Healthcheck verifying PostgreSQL and RabbitMQ status |
| `POST` | `/api/orders` | Customer / Auth | Create new order and reserve inventory stock |
| `GET` | `/api/orders` | Customer / Admin | List orders (Customers see own orders, Admins see all) |
| `GET` | `/api/orders/:id` | Customer / Admin | Get full order details, line items, and audit history |
| `GET` | `/api/orders/number/:orderNumber` | Customer / Admin | Lookup order by order number (e.g. `ORD-20261102-K9X2A1`) |
| `POST` | `/api/orders/:id/pay` | Customer / Admin | Settle payment and permanently confirm inventory reservation |
| `POST` | `/api/orders/:id/cancel` | Customer / Admin | Cancel order and release reserved inventory stock |
| `PATCH` | `/api/orders/:id/status` | Admin | Advance order status (`PROCESSING`, `SHIPPED`, `DELIVERED`) |

---

## Quick Start

1. **Initialize Database Schema**:
   ```bash
   cd d:\project\ecommerce\orders
   npm run db:init
   ```

2. **Start Service in Development Mode**:
   ```bash
   npm run dev
   ```

3. **Start Service in Production Mode**:
   ```bash
   npm start
   ```
