# Mock Payment Microservice

Production-grade, event-driven Mock Payment Microservice for the E-Commerce platform. Simulates bank card authorizations, captures, declines, and refunds without connecting to real financial networks, while maintaining full transactional consistency and RabbitMQ event streaming.

---

## Features

- **Realistic Mock Gateway Simulation**:
  - Simulates payment card authorization, funds checks, card expiration, and bank declines.
  - Realistic latency (100–150ms) mimicking banking settlement networks.
  - Supports magic card numbers and explicit simulation triggers (`mock_action`).
- **Closed-Loop Workflow with Order Microservice**:
  - Upon successful payment capture, automatically transitions the Order in the Order service to `PAID` / `CONFIRMED`.
  - Confirms the temporary inventory reservation in the Inventory service into a permanent stock deduction.
- **Audit Ledger & Double-Entry Tracking**:
  - Every authorization, capture, decline, and refund is stored immutably in `payment_transactions`.
- **Transactional Outbox Pattern**:
  - Payment events (`payment.successful`, `payment.failed`, `payment.refunded`) are recorded atomically in `outbox_events` and published reliably to RabbitMQ.
- **Idempotency Guard**:
  - Prevents double-charging if a user clicks "Pay" multiple times or if network requests retry.

---

## Mock Card Numbers & Simulation Controls

You can control mock payment outcomes using test card numbers or by passing `mock_action` in the request body:

| Card Number | `mock_action` | Simulated Outcome | Description |
| :--- | :--- | :--- | :--- |
| `4242 4242 4242 4242` | `SUCCESS` | **CAPTURED** (200 OK) | Instant card authorization and capture |
| `4000 0000 0000 0002` | `DECLINE` | **FAILED** (400 Bad Request) | Simulates bank decline |
| `4000 0000 0000 0004` | `EXPIRED_CARD` | **FAILED** (400 Bad Request) | Simulates expired card |
| `4000 0000 0000 0999` | `INSUFFICIENT_FUNDS` | **FAILED** (400 Bad Request) | Simulates insufficient account balance |
| *Any* | `NETWORK_TIMEOUT` | **FAILED** (500 / 504) | Simulates banking network timeout |

---

## Database Schema Highlights ([`database/schema.sql`](./database/schema.sql))

1. **`payments`**:
   - `id`, `payment_reference` (e.g. `PAY-20261102-K9X2A1`), `order_id`, `order_number`, `user_id (UUID)`, `amount`, `currency`, `status` (`PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`), `payment_method`, `provider_transaction_id`, `idempotency_key`, `error_code`, `error_message`, `metadata`, `captured_at`, `refunded_at`.
2. **`payment_transactions`**:
   - Detailed ledger recording every gateway attempt: `id`, `payment_id`, `transaction_type` (`CAPTURE`, `DECLINE`, `REFUND`), `amount`, `status` (`SUCCESS`, `FAILURE`), `gateway_response (JSONB)`.
3. **`payment_refunds`**:
   - `id`, `refund_reference`, `payment_id`, `amount`, `reason`, `status` (`COMPLETED`, `FAILED`).
4. **`outbox_events`**:
   - `id`, `event_id (UUID)`, `aggregate_type`, `aggregate_id`, `event_type`, `payload (JSONB)`, `published_at`, `attempts`.

---

## API Endpoints

Port: `4004` (prefix: `/api/payments`)

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Service healthcheck (PostgreSQL + RabbitMQ) |
| `POST` | `/api/payments/process` | Customer | Process mock charge for an order |
| `GET` | `/api/payments/order/:orderId` | Customer / Admin | Get payment receipt for an order |
| `GET` | `/api/payments/:id` | Customer / Admin | Get full payment record with ledger history |
| `GET` | `/api/payments` | Customer / Admin | List payments (customers see own, admins see all) |
| `POST` | `/api/payments/:id/refund` | Admin | Refund a captured payment |

---

## Quick Start

1. **Initialize Database Schema**:
   ```bash
   cd d:\project\ecommerce\payment
   npm run db:init
   ```

2. **Start Service in Development Mode**:
   ```bash
   npm run dev
   ```
