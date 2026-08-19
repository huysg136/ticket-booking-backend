# Coding guidelines

- Keep routes declarative, controllers thin, Zod at boundaries, and business rules in services.
- Use `{ data }` success and `{ error: { code, message } }` errors.
- Never trust customer identity from request bodies; use JWT context.
- Put multi-record invariants in a transaction and make database constraints the final guarantee.
- Use parameterized Prisma APIs; reserve raw SQL for capabilities such as row locking.
- Add an API through schema, service, controller, route/RBAC, OpenAPI, and tests.
- Concurrency tests must inspect persisted counts and inventory, not only status codes.
- Run `npm run build`, `npm run prisma:validate`, and isolated-database `npm test`.
