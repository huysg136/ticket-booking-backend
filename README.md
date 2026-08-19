# Concert Ticket Booking Platform

A modular-monolith backend for concert browsing, ticket reservation, vouchers, and internal operations. The design prioritizes transactional correctness under flash-sale concurrency over feature breadth.

## Stack and architecture

Node.js, TypeScript, Express 5, PostgreSQL, Prisma 7, Zod, JWT, bcryptjs, Swagger/OpenAPI, Jest, and Supertest. Express modules separate HTTP concerns from business rules, while PostgreSQL remains the single consistency boundary. At 300–500 bookings/minute (about 5–8.3/second), this is simpler and more appropriate than microservices or queues.

## Setup

Prerequisites: Node.js 20+, npm, and PostgreSQL.

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Swagger UI: http://localhost:3000/api/docs

```bash
npm run build
npm run prisma:validate
set RUN_INTEGRATION_TESTS=true
npm test
```

Integration tests destructively clean their database and only activate for an explicitly enabled URL containing `test` or `localhost`.

## Performance test

With the API running, k6 can generate the assignment peak load of eight booking requests per second:

```powershell
npm run perf:booking
```

Configure a longer run with `$env:RATE = "8"` and `$env:DURATION = "5m"`. The test automatically logs in, selects available inventory, separates expected inventory conflicts from server errors, and saves a JSON result under `performance/results`. See [performance testing](performance/README.md).

The recorded local peak-load result is documented in [performance test results](docs/performance-test-results.md).

## Seed accounts

All assignment-only accounts use password `Assignment123!`: `customer@example.com`, `operator@example.com`, and `admin@example.com`. Seed data includes the published **GEEK Up Summer Concert**, VIP/Standard categories, `FLASH20`, and `WELCOME100`.

## Engineering decisions

- Conditional inventory updates prevent overselling; inventory, amount snapshots, voucher reservation, and booking writes share one transaction.
- `UNIQUE(userId, idempotencyKey)` guarantees retry safety; concurrent losers return the winner.
- Voucher capacity uses a conditional atomic increment and `UNIQUE(voucherId,userId)` prevents reuse.
- Category IDs are processed deterministically to reduce deadlock risk.
- PostgreSQL Decimal/Prisma Decimal preserve money; booking items snapshot unit prices.
- Cancellation/expiry restores inventory while locking the booking, preventing double release.

Implemented: JWT/RBAC, published concert browsing, owned bookings, transactional reservations, vouchers, paginated operations, a simple quantity-based suspicious heuristic, concert/voucher operations, valid status transitions, Swagger, Postman, seed data, and concurrency tests.

Not implemented: seat assignment, payment gateway, refunds, notifications, refresh tokens, account lockout, rate limiting, Redis, waiting room, dashboards, or deployment infrastructure. The suspicious flag is a demonstration heuristic, not fraud detection. See [assumptions and limitations](docs/assumptions-and-limitations.md).
