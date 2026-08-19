# Coding guidelines and API development workflow

## Conventions

- Keep routes declarative, controllers thin, and business rules in services.
- Validate every external boundary with Zod before calling a controller.
- Use authenticated JWT context (`req.user`) for identity; never trust a user ID supplied by a customer body.
- Protect operation routes with both `authenticate` and `requireRole(OPERATOR, ADMIN)`.
- Return successful resources as `{ data: ... }`. Paginated operation lists return `data` and `pagination`.
- Throw an `AppError` helper for expected failures. The shared error middleware produces `{ error: { code, message, details? } }`.
- Use stable machine-readable error codes such as `INSUFFICIENT_INVENTORY`; do not make clients parse prose.
- Put multi-record invariants in a PostgreSQL transaction and keep database constraints as the final guarantee.
- Use parameterized Prisma APIs. Raw SQL is reserved for capabilities such as `SELECT ... FOR UPDATE`.
- Store money as Prisma/PostgreSQL Decimal, never JavaScript floating-point arithmetic.
- Redis may optimize reads or enforce distributed quotas, but it must not become the inventory source of truth.
- Format with Prettier and keep imports relative within the application.

## Module layout

Each business module under `src/modules/<feature>` normally contains:

```text
<feature>.schema.ts      Zod request boundary
<feature>.service.ts     Business rules and persistence
<feature>.controller.ts  HTTP status and response shape
<feature>.routes.ts      URL, middleware, RBAC, controller wiring
```

Shared HTTP middleware lives in `src/middleware`, infrastructure clients in `src/infrastructure`, and reusable errors/helpers in `src/utils`.

## How to add a new API

The following example describes adding `GET /api/operations/concerts/:id`. Follow the same sequence for other APIs.

### 1. Define scope and authorization

Before coding, write down the actor, input, success response, expected errors, and whether the operation needs a transaction, idempotency, cache invalidation, or rate limiting. For this example, only OPERATOR/ADMIN can read the operation view; no transaction or cache mutation is needed.

### 2. Add a Zod schema

Every request schema represents body, params, query, and headers:

```ts
import { z } from "zod";

export const concertIdSchema = z.object({
  body: z.any(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}),
  headers: z.any(),
});
```

Use coercion only for HTTP string inputs such as query numbers or ISO dates. Add bounds for arrays, pagination, quantity, and text length.

### 3. Implement the service

The service owns Prisma access and business behavior:

```ts
export async function getConcertForOperations(id: string) {
  const concert = await prisma.concert.findUnique({
    where: { id },
    include: { ticketCategories: true },
  });
  if (!concert) throw notFound("Concert not found");
  return concert;
}
```

Do not pass Express `Request` or `Response` into a service. For writes spanning multiple records, use `prisma.$transaction`. For concurrent counters, prefer a conditional atomic update over read-check-write.

### 4. Add a thin controller

```ts
export async function getConcert(req: Request, res: Response) {
  const result = await service.getConcertForOperations(String(req.params.id));
  res.status(200).json({ data: result });
}
```

Do not duplicate validation or business rules in the controller.

### 5. Register the route and middleware

```ts
router.get("/concerts/:id", validate(concertIdSchema), asyncHandler(controller.getConcert));
```

The operation router already applies authentication and OPERATOR/ADMIN RBAC to all child routes. Customer routes must add the appropriate authentication and rate-limit middleware. Always wrap async controllers with `asyncHandler`.

### 6. Update Swagger

Add the path, security, parameters, request schema, success response, and expected `400/401/403/404/409/429` responses to `src/config/swagger.ts`. If the route is rate-limited, document quota headers and `429`. Start the server and execute the new API at `http://localhost:3000/api/docs`.

### 7. Update Postman

Add a request to `postman/Concert-Ticket-Booking.postman_collection.json` using `{{baseUrl}}` and the appropriate bearer variable. Capture IDs/tokens into the local environment when later requests depend on them. Never store real secrets in the collection.

### 8. Add tests

Use unit tests for isolated validation, business branches, authorization, cache, and rate-limit behavior. Mock PostgreSQL and Upstash and cover the happy path, boundary/invalid input, rejection, and relevant dependency failure.

Use a real dedicated PostgreSQL test database for transactions, constraints, row locks, conditional updates, overselling, idempotent retries, and voucher concurrency. Do not mock the database for a claim that database concurrency is safe.

### 9. Verify

```bash
npm run test:unit
npm run build
npm run prisma:validate
npm run format:check
```

For a transaction or constraint change, point `.env` to a dedicated database whose name contains `test`, apply migrations, and run:

```bash
npx prisma migrate deploy
npm run test:integration
```

The integration runner refuses any database name without `test` because setup deletes records.

## Database change workflow

1. Update `prisma/schema.prisma`.
2. Point `DATABASE_URL` to a development database.
3. Run `npm run prisma:migrate -- --name <descriptive_name>`.
4. Review the generated SQL; do not blindly accept destructive changes.
5. Regenerate the client with `npm run prisma:generate`.
6. Update seed data, Swagger, Postman, and tests if the contract changed.
7. Commit the schema and complete migration directory. Reviewers use `npx prisma migrate deploy`.

Never rewrite an already-shared migration to represent a new production change; create a new migration.

## New API review checklist

- Scope and actor are explicit.
- Zod validates all untrusted input.
- Authentication and RBAC are correct.
- Controller is thin; service owns business logic.
- Transaction, idempotency, concurrency, cache, and quota needs were considered.
- Response and error formats follow convention.
- Swagger and Postman are updated.
- Unit tests pass; database invariants have integration tests.
- Assumptions/limitations are updated if scope changed.
