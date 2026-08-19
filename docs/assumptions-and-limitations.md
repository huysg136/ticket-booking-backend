# Assumptions, implemented scope, and limitations

## Business assumptions

- A booking contains categories from exactly one concert.
- Inventory is category-level general admission; assigned seats are not modeled.
- Booking reserves inventory immediately; there is no automated unpaid-hold expiry worker.
- One voucher may apply per booking, and one customer may use a campaign once.
- Amount examples use VND-style Decimal values.
- Timestamps are ISO-8601 and evaluated by the server clock.
- CUSTOMER uses public/own-booking APIs; OPERATOR and ADMIN share demonstrated internal permissions.
- Item quantity eight or more is suspicious only as a demonstration heuristic.

## Booking status scope

```text
RECEIVED
  ├── WAITING_FOR_PAYMENT
  │     ├── PAID
  │     ├── CANCELLED
  │     └── EXPIRED
  └── CANCELLED
```

`PAID`, `CANCELLED`, and `EXPIRED` are terminal. Cancellation/expiry restores inventory once. Reverse transitions, partial cancellation, refunds, and reconciliation are absent.

## Feature scope matrix

| Area             | Implemented                                                                                                        | Intentionally not implemented / reason                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Customer auth    | Register, login, JWT                                                                                               | Refresh, recovery, verification, lockout                  |
| Concert browsing | Published list/detail, categories, prices, availability                                                            | Search, media, recommendations                            |
| Booking          | Multi-category single-concert reservation, totals, own history/detail                                              | Cross-concert basket, seats, partial cancellation         |
| Idempotency      | Required key and database uniqueness                                                                               | Generic idempotency for every endpoint                    |
| Inventory        | Atomic decrement and cancel/expire restoration                                                                     | Redis inventory lock, waiting room, automatic hold expiry |
| Voucher          | Create/list, percentage/fixed, limits, one use/customer                                                            | Update/delete, stacking, segmentation                     |
| Payment          | Manual waiting/paid transition                                                                                     | Gateway, checkout session, webhook, refund/reconciliation |
| Operations       | Monitor/detail/filter bookings, suspicious flag, status, concert create/publish, availability, voucher create/list | Full CRUD, audit log, bulk actions, dashboard UI          |
| Security         | JWT, bcrypt, RBAC, Zod, Helmet, CORS, body limit, Upstash quotas                                                   | WAF, managed secrets, MFA                                 |
| Performance      | k6 at 8 booking requests/second                                                                                    | Production certification or multi-region test             |
| Platform         | Modular monolith, PostgreSQL, optional Upstash cache/quota                                                         | Queue, microservices, Kubernetes, deployment pipeline     |
| Notifications    | None                                                                                                               | Email/SMS and retry worker are outside priority scope     |

## Redis assumptions

Redis is optional and outside the booking correctness boundary. Catalogue entries expire after 30 seconds, so displayed availability can briefly be stale. Booking always validates PostgreSQL atomically. If Upstash fails, cache reads fall back to PostgreSQL and rate limiting fails open with a warning.

Normal quotas are 10 auth attempts per minute per IP and 10 booking attempts per minute per user. Controlled k6 testing disables the application quota because one seeded customer intentionally exceeds normal usage.

## Known limitations and production follow-up

- No real payment gateway, webhook idempotency, refunds, or reconciliation.
- No automatic expiry worker; inventory remains reserved until an operator changes status.
- No durable operator audit trail.
- No outbox/event queue for notifications or analytics side effects.
- No bot fingerprinting, WAF, CAPTCHA, or fraud model.
- No cache stampede protection.
- No dependency health breakdown, metrics exporter, tracing, or alerting.
- No deployment, backup, disaster recovery, or secret-rotation automation.
- Local k6 results are evidence for one configuration, not a production SLA.

These omissions are deliberate: scope focuses on overselling, retries, voucher abuse, authorization, operation visibility, and explainable design.
