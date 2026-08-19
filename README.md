# Concert Ticket Booking Platform

Backend assignment for a concert ticket booking platform with customer-facing booking APIs and role-protected internal operation APIs. The implementation prioritizes transactional correctness under concurrent flash-sale traffic: overselling prevention, database-backed idempotency, voucher usage protection, explicit booking transitions, and testability.

## What is implemented

### Customer workflows

- Register and login with JWT authentication.
- Browse published concerts and ticket categories.
- View price and current category availability.
- Reserve tickets using a required `Idempotency-Key`.
- Apply one optional promotional voucher.
- List and inspect only the authenticated customer's bookings.

### Operation workflows

- OPERATOR/ADMIN role protection.
- Paginated booking monitoring with status and suspicious-booking filters.
- Booking detail inspection.
- Valid manual booking status transitions.
- Inventory restoration when a booking becomes `CANCELLED` or `EXPIRED`.
- Draft concert creation and publishing.
- Ticket-category availability inspection.
- Voucher creation and listing.

### Correctness guarantees

- Conditional atomic inventory decrement prevents overselling.
- All inventory, voucher, booking, and booking-item writes share one PostgreSQL transaction.
- `UNIQUE(userId, idempotencyKey)` is the final duplicate-booking guarantee.
- Voucher capacity is incremented conditionally and cannot exceed `usageLimit`.
- `UNIQUE(voucherId, userId)` prevents the same customer from reusing a voucher.
- Ticket categories are processed in deterministic UUID order to reduce deadlock risk.
- Booking items persist unit-price snapshots.
- Monetary values use PostgreSQL `DECIMAL` and Prisma `Decimal`.

## Architecture and technology

This project is a modular monolith built with:

- Node.js and TypeScript
- Express 5
- PostgreSQL
- Prisma ORM 7 with the PostgreSQL driver adapter
- Zod
- JWT and bcryptjs
- Upstash Redis for optional catalogue caching and distributed rate limiting
- Swagger/OpenAPI
- Jest and Supertest
- Postman
- k6 for optional performance testing

At the expected peak of 300–500 booking requests per minute—approximately 5–8.3 requests/second—the primary challenge is consistency under contention rather than raw throughput. A PostgreSQL-backed modular monolith provides a clear transaction boundary without unnecessary distributed-system complexity.

Detailed documentation:

- [System design](docs/system-design.md)
- [Database design](docs/database-design.md)
- [Concurrency and consistency](docs/concurrency-and-consistency.md)
- [Assumptions and limitations](docs/assumptions-and-limitations.md)
- [Coding guidelines](docs/coding-guidelines.md)
- [Recorded performance result](docs/performance-test-results.md)

### Assignment deliverables map

| Requested deliverable                                       | Location                                              |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| Source code                                                 | `src/`                                                |
| System architecture, analysis, trade-offs, failure behavior | `docs/system-design.md`                               |
| ERD, constraints, indexes, transaction and migration design | `docs/database-design.md`                             |
| Overselling, idempotency, voucher and status concurrency    | `docs/concurrency-and-consistency.md`                 |
| Implemented/not-implemented scope and assumptions           | `docs/assumptions-and-limitations.md`                 |
| How to code a new API, conventions, migrations, and tests   | `docs/coding-guidelines.md`                           |
| Local clone/setup/run instructions                          | This README                                           |
| OpenAPI documentation                                       | `http://localhost:3000/api/docs` after local startup  |
| Executable API collection/environment                       | `postman/`                                            |
| Unit and concurrency tests                                  | `tests/`                                              |
| Peak-traffic script and recorded result                     | `performance/` and `docs/performance-test-results.md` |

## Repository structure

```text
src/
├── config/
├── database/
├── infrastructure/
├── middleware/
├── modules/
│   ├── auth/
│   ├── bookings/
│   ├── concerts/
│   └── operations/
├── types/
├── utils/
├── app.ts
└── server.ts

prisma/
├── migrations/
├── schema.prisma
└── seed.js

tests/
docs/
postman/
performance/
scripts/
```

## Local setup for reviewers

### Prerequisites

Install:

- Node.js 20.19+ or Node.js 22.12+
- npm
- PostgreSQL
- Git
- k6 only if the optional performance test will be run

Confirm the main tools:

```bash
node --version
npm --version
git --version
psql --version
```

### 1. Clone the repository

```bash
git clone <repository-url>
cd ticket-booking
```

Use the cloned project root for all subsequent commands.

### 2. Install dependencies

```bash
npm ci
```

`npm ci` installs the exact dependency tree committed in `package-lock.json`. Use `npm install` only when intentionally changing dependencies.

### 3. Create the environment file

Windows PowerShell or Command Prompt:

```powershell
copy .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

Default local configuration:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/concert_ticket"
JWT_SECRET="replace-with-any-local-secret"
JWT_EXPIRES_IN="1d"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
RATE_LIMIT_ENABLED=true
```

Change the PostgreSQL username, password, host, port, or database name if the local installation differs. Never commit `.env`; only `.env.example` belongs in source control.

Upstash Redis is optional. Without both Upstash variables, the API continues to work using PostgreSQL, but catalogue caching and distributed rate limiting are disabled. To enable them, create a Redis database in the Upstash console and copy its REST URL and REST token into `.env`. Never commit the real token.

When enabled:

- Published concert lists and details are cached for 30 seconds. Inventory is still validated against PostgreSQL when booking, so cached availability is only informational and may briefly be stale.
- Login and registration are limited to 10 requests per minute per IP.
- Booking creation is limited to 10 requests per minute per authenticated user.
- Redis failures use fail-open behavior: the request falls back to PostgreSQL or proceeds without rate limiting, and a structured warning is logged.
- Set `RATE_LIMIT_ENABLED=false` only for controlled performance testing. Do not disable it in a normal deployment.

### 4. Create the PostgreSQL database

Using `psql`:

```bash
psql -U postgres
```

Then execute:

```sql
CREATE DATABASE concert_ticket;
```

Exit with:

```text
\q
```

The database can alternatively be created with pgAdmin. Ensure `DATABASE_URL` points to the created database and PostgreSQL is running.

### 5. Generate Prisma Client

```bash
npm run prisma:generate
```

The generated client is written under `src/generated/prisma` and is intentionally excluded from Git because it is reproducibly generated from `prisma/schema.prisma`.

### 6. Apply committed migrations

For a reviewer setting up a fresh local database, apply the migrations already committed to `prisma/migrations`:

```bash
npx prisma migrate deploy
```

Expected outcome:

```text
All migrations have been successfully applied.
```

For schema development, contributors may instead run:

```bash
npm run prisma:migrate
```

This uses `prisma migrate dev` and may create new migrations when the schema changes. Reviewers should prefer `prisma migrate deploy` because the assignment migrations are already committed.

### 7. Seed deterministic review data

```bash
npm run prisma:seed
```

Expected output contains:

```text
"event":"seed_complete"
```

The seed uses upsert/reuse behavior so repeated execution does not create duplicate users or vouchers.

### 8. Start the API

Development mode with file watching:

```bash
npm run dev
```

Local URLs:

```text
API:         http://localhost:3000
Health:      http://localhost:3000/health
Swagger UI:  http://localhost:3000/api/docs
```

Verify health:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "concert-ticket-platform"
}
```

Production-style local execution:

```bash
npm run build
npm start
```

## Seeded review data

All assignment-only accounts use this password:

```text
Assignment123!
```

| Email                  | Role     |
| ---------------------- | -------- |
| `customer@example.com` | CUSTOMER |
| `operator@example.com` | OPERATOR |
| `admin@example.com`    | ADMIN    |

Seeded catalogue data:

- Published `GEEK Up Summer Concert` in Ho Chi Minh City.
- VIP category: VND 1,500,000 with 100 tickets.
- STANDARD category: VND 500,000 with 500 tickets.
- `FLASH20`: 20% voucher.
- `WELCOME100`: VND 100,000 fixed discount with a minimum order amount.

## Testing through Swagger

Open:

```text
http://localhost:3000/api/docs
```

### Customer booking walkthrough

1. Call `POST /api/auth/login` with:

```json
{
  "email": "customer@example.com",
  "password": "Assignment123!"
}
```

2. Copy `data.token` from the response.
3. Select **Authorize** in Swagger and paste the token.
4. Call `GET /api/concerts`.
5. Copy a `ticketCategories[].id` value.
6. Call `POST /api/bookings`.
7. Add a unique header such as:

```text
Idempotency-Key: swagger-review-booking-001
```

8. Use a request body such as:

```json
{
  "items": [
    {
      "ticketCategoryId": "replace-with-category-uuid",
      "quantity": 1
    }
  ],
  "voucherCode": "FLASH20"
}
```

9. Retry the same request with the same idempotency key. It returns the existing booking and does not decrement inventory again.
10. Call `GET /api/bookings/me` and `GET /api/bookings/{id}`.

### Operation walkthrough

1. Login again using `operator@example.com` and `Assignment123!`.
2. Replace the Swagger authorization token with the operator token.
3. Call `GET /api/operations/bookings?page=1&limit=20`.
4. Inspect a booking through `GET /api/operations/bookings/{id}`.
5. Apply valid transitions through `PATCH /api/operations/bookings/{id}/status`:

```text
RECEIVED → WAITING_FOR_PAYMENT
RECEIVED → CANCELLED
WAITING_FOR_PAYMENT → PAID
WAITING_FOR_PAYMENT → CANCELLED
WAITING_FOR_PAYMENT → EXPIRED
```

Terminal states are `PAID`, `CANCELLED`, and `EXPIRED`. Reverse or arbitrary transitions are rejected.

## Testing through Postman

Import both files:

```text
postman/Concert-Ticket-Booking.postman_collection.json
postman/Local.postman_environment.json
```

Select the `Concert Ticket Local` environment. Recommended order:

```text
Auth / Login Customer
Concerts / List Concerts
Concerts / Concert Detail
Bookings / Create Booking
Bookings / My Bookings
Bookings / Booking Detail
Bookings / Retry Same Booking
Auth / Login Operator
Operations / List Bookings
Operations / Booking Detail
Operations / Update Booking Status
Operations / Create Concert
Operations / Publish Concert
Operations / Ticket Category Availability
Operations / Create Voucher
Operations / List Vouchers
```

Postman scripts automatically capture the customer/operator token, concert ID, ticket-category ID, and booking ID where applicable. `Create Concert` replaces `concertId` and `ticketCategoryId` with the newly created draft so the following publish and availability requests work in sequence. Change `idempotencyKey` before creating an unrelated booking and change the voucher code before repeating voucher creation.

## Automated verification

### Formatting, build, and schema

```bash
npm run format:check
npm run build
npm run prisma:validate
```

### Jest

Run only fast unit tests (no PostgreSQL or Upstash connection required):

```bash
npm run test:unit
```

The unit suites cover:

- Authentication registration/login behavior and non-disclosing credential errors.
- JWT authentication and customer/operator/admin authorization.
- Booking validation, idempotency-key requirements, quantity bounds, and duplicate categories.
- Voucher normalization, percentage limits, and campaign date validation.
- Concert and operation request validation and pagination.
- Concert cache hits, misses, TTL, key isolation, and not-found behavior.
- Distributed rate-limit success, `429` rejection, user/IP identifiers, explicit load-test bypass, and fail-open behavior when Upstash is unavailable.

Run every Jest suite that is enabled for the current environment:

```bash
npm test
```

The database integration suite is intentionally disabled unless explicitly enabled because its setup deletes booking, catalogue, voucher, and user records from the configured test database.

### Integration and concurrency tests

Create a separate database:

```sql
CREATE DATABASE concert_ticket_test;
```

Point `DATABASE_URL` to it:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/concert_ticket_test"
```

Apply migrations:

```bash
npx prisma migrate deploy
```

Run the dedicated cross-platform command:

```bash
npm run test:integration
```

The command automatically enables the integration suite and refuses to run unless the database name in `DATABASE_URL` contains `test`. This protects the normal development database from the suite's destructive cleanup.

The suite covers:

- Successful booking.
- Invalid quantity and category.
- Insufficient inventory.
- Customer booking ownership.
- Concurrent idempotent retries creating one booking and one decrement.
- Twenty concurrent requests competing for ten tickets, producing exactly ten reservations and zero remaining inventory.
- Ten concurrent eligible users competing for a voucher with a usage limit of five.

Never enable this suite against a database containing data that must be preserved.

## Optional performance test

Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/). The script deliberately uses one seeded customer, while normal booking rate limiting allows 10 requests per minute per user. Therefore, run a dedicated performance API process with rate limiting disabled so the test measures booking and database throughput rather than abuse-control policy.

Windows PowerShell, terminal 1:

```powershell
$env:RATE_LIMIT_ENABLED = "false"
npm run dev
```

macOS or Linux, terminal 1:

```bash
RATE_LIMIT_ENABLED=false npm run dev
```

In terminal 2, run the default assignment peak of eight booking requests per second for one minute:

```bash
npm run perf:booking
```

PowerShell example for a longer run:

```powershell
$env:RATE = "8"
$env:DURATION = "5m"
npm run perf:booking
```

The script:

- Logs in with the seeded customer.
- Discovers published inventory.
- Selects the category with the highest availability unless `TICKET_CATEGORY_ID` is supplied.
- Generates a unique idempotency key per booking.
- Separates expected HTTP 409 business conflicts from unexpected server errors.
- Measures booking latency and checks configured thresholds.
- Writes a detailed JSON summary under `performance/results`.

The recorded local run sustained the configured eight booking requests per second and completed 481 bookings in the one-minute arrival window, with zero unexpected errors, 17.42 ms average booking latency, and 30.01 ms at p95. The one-iteration boundary difference is normal for a time-based constant-arrival-rate executor. This is a local reference result, not a production capacity claim. See [performance test results](docs/performance-test-results.md).

The recorded throughput result was produced with application rate limiting disabled. Stop the dedicated API after the run. In PowerShell, restore the current terminal before normal use:

```powershell
Remove-Item Env:RATE_LIMIT_ENABLED -ErrorAction SilentlyContinue
```

Use a dedicated performance database or replenish inventory before repeated runs.

## Verification evidence

The following screenshots were captured from the documented local setup. They are supporting evidence rather than a substitute for reproducible commands and automated assertions.

### Concurrency and consistency tests

The PostgreSQL integration suite verifies idempotent retries, overselling prevention, booking ownership, and concurrent voucher capacity.

![Concurrency and consistency tests passed](docs/images/concurrency-tests-passed.png)

### Assignment peak traffic

k6 drives the upper assignment target of eight booking requests per second for one minute. Rate limiting is disabled only for this controlled throughput run.

![k6 peak-traffic result](docs/images/performance-k6.png)

### Distributed rate limiting

Upstash-backed middleware permits the configured quota and returns HTTP `429` after the limit is exceeded.

![Rate limiting returns HTTP 429](docs/images/rate-limit-429.png)

### Redis catalogue cache

The Upstash Data Browser shows the short-lived published-concert cache key. PostgreSQL remains the inventory source of truth.

![Upstash Redis catalogue cache](docs/images/upstash-redis.png)

### Swagger/OpenAPI

Swagger UI exposes the customer and operation API contracts for local execution.

![Swagger API documentation](docs/images/swagger-api.png)

### Unit tests

Fast isolated tests cover schemas, authentication, RBAC, catalogue caching, and rate-limit behavior without external services.

![Unit tests passed](docs/images/unit-tests-passed.png)

## Package scripts

| Command                    | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `npm run dev`              | Start the development server with file watching   |
| `npm run build`            | Compile TypeScript to `dist`                      |
| `npm start`                | Run the compiled server                           |
| `npm test`                 | Run all enabled Jest suites                       |
| `npm run test:unit`        | Run unit tests without PostgreSQL or Upstash      |
| `npm run test:integration` | Run destructive tests against a `*test*` database |
| `npm run format`           | Format source files                               |
| `npm run format:check`     | Check source formatting                           |
| `npm run prisma:generate`  | Generate Prisma Client                            |
| `npm run prisma:migrate`   | Run development migrations                        |
| `npm run prisma:seed`      | Build and seed deterministic review data          |
| `npm run prisma:validate`  | Validate the Prisma schema                        |
| `npm run perf:booking`     | Run the k6 booking load test                      |

## Troubleshooting

### PostgreSQL connection failure

Confirm PostgreSQL is running and verify every `DATABASE_URL` component. Test connectivity with:

```bash
psql "postgresql://postgres:postgres@localhost:5432/concert_ticket"
```

### Prisma Client is missing or stale

```bash
npm run prisma:generate
npm run build
```

### Database tables do not exist

```bash
npx prisma migrate deploy
```

### Seed login returns unauthorized

Run the repeatable seed again:

```bash
npm run prisma:seed
```

Then login with the documented seed password.

### Port 3000 is already in use

Change `PORT` in `.env`, for example:

```env
PORT=3001
```

Swagger's documented server URL is configured for port 3000, so port 3000 is recommended for the review walkthrough.

### k6 reports inventory conflicts

HTTP 409 can be an expected business outcome after inventory is exhausted. Re-seed into a clean performance database or create additional inventory before another throughput run.

## Scope and limitations

Implemented scope focuses on the highest-value assignment risks: correct booking transactions, overselling prevention, retry idempotency, voucher concurrency, authorization, operation visibility, status transitions, documentation, and tests.

Intentionally not implemented:

- Seat-level assignment.
- Real payment gateway, webhook, refund, or reconciliation.
- Voucher stacking or campaign segmentation.
- Email/SMS notifications.
- Refresh tokens and account lockout.
- WAF and production secret management.
- Redis-based inventory locking; PostgreSQL remains the inventory source of truth.
- Queues, microservices, or Kubernetes.
- Real-time operation dashboard UI.
- Production deployment configuration.

The suspicious-booking indicator—quantity of eight or more—is only a demonstration heuristic, not a production fraud-detection system. See [assumptions and limitations](docs/assumptions-and-limitations.md) for the complete scope statement.
