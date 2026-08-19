# Concert Ticket Booking Platform

A modular-monolith backend for concert browsing, ticket reservation, vouchers, and internal operations. The design prioritizes transactional correctness under flash-sale concurrency over feature breadth.

## Stack and architecture

Node.js, TypeScript, Express 5, PostgreSQL, Prisma 7, Zod, JWT, bcryptjs, Swagger/OpenAPI, Jest, and Supertest. Express modules separate HTTP concerns from business rules, while PostgreSQL remains the single consistency boundary. At 300–500 bookings/minute (about 5–8.3/second), this is simpler and more appropriate than microservices or queues.

## Setup

### Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Windows PowerShell or Command Prompt:

```powershell
copy .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

Update `.env` for the local PostgreSQL instance:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/concert_ticket"
JWT_SECRET="replace-with-a-local-secret"
JWT_EXPIRES_IN="1d"
```

Do not commit `.env`. Only `.env.example` belongs in the repository.

### 3. Create the PostgreSQL database

Using `psql`:

```sql
CREATE DATABASE concert_ticket;
```

Alternatively, create a database named `concert_ticket` with pgAdmin and update `DATABASE_URL` if the username, password, host, port, or database name differs.

### 4. Generate Prisma Client and apply migrations

All migration files are committed under `prisma/migrations` and must remain in the repository.

For local development:

```bash
npm run prisma:generate
npm run prisma:migrate
```

`npm run prisma:migrate` runs `prisma migrate dev`, applies committed migrations, and checks development schema consistency. For a non-development environment, apply existing migrations without creating new ones:

```bash
npx prisma migrate deploy
```

### 5. Seed deterministic review data

```bash
npm run prisma:seed
```

The seed is repeatable and creates or updates the assignment accounts, published concert, ticket categories, and voucher examples.

### 6. Start the API

Development mode with file watching:

```bash
npm run dev
```

The API is available at:

```text
API:     http://localhost:3000
Health:  http://localhost:3000/health
Swagger: http://localhost:3000/api/docs
```

Production-style local build:

```bash
npm run build
npm start
```

### 7. Verify the project

```bash
npm run build
npm run prisma:validate
npm test
```

The database integration suite is disabled unless explicitly enabled because it deletes test data during setup. Create and use a separate database such as `concert_ticket_test`, update `DATABASE_URL`, then run:

Windows PowerShell:

```powershell
$env:RUN_INTEGRATION_TESTS = "true"
npm test
```

Windows Command Prompt:

```cmd
set RUN_INTEGRATION_TESTS=true
npm test
```

macOS or Linux:

```bash
RUN_INTEGRATION_TESTS=true npm test
```

Never enable the integration suite against a database containing data that must be preserved.

## Reviewer walkthrough

1. Run the setup, migrations, seed, and development server commands above.
2. Open Swagger at `http://localhost:3000/api/docs`.
3. Call `POST /api/auth/login` with `customer@example.com` and `Assignment123!`.
4. Copy the returned token and select Swagger **Authorize**.
5. List concerts, copy a ticket category UUID, create a booking with a unique `Idempotency-Key`, and retrieve the booking.
6. Login as `operator@example.com`, authorize with the operator token, list operation bookings, and apply a valid status transition.

For Postman, import both files:

```text
postman/Concert-Ticket-Booking.postman_collection.json
postman/Local.postman_environment.json
```

Select the local environment and run the login requests before authenticated customer or operation requests.

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
