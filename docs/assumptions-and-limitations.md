# Assumptions and limitations

| Area       | Implemented                                                        | Not implemented / why                                          |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Inventory  | Category reservation; restore on cancel/expire                     | Assigned seats and hold timers                                 |
| Payments   | Manual status transitions                                          | Gateway, webhooks, refunds                                     |
| Voucher    | One per booking and use per user                                   | Stacking and targeting                                         |
| Concert    | One concert per booking                                            | Cross-concert basket                                           |
| Security   | JWT, bcrypt, RBAC, Helmet, CORS, size limit, Upstash rate limiting | Refresh, lockout, WAF, managed secrets                         |
| Suspicion  | Quantity 8+ flag                                                   | Production fraud; this is only a demonstration heuristic       |
| Operations | Focused create/publish/status/list                                 | Full CRUD adds little assessment value                         |
| Platform   | PostgreSQL modular monolith with optional Upstash Redis cache      | Queues, microservices, notifications, real-time UI, deployment |

VND examples use Decimal values. Authentication is intentionally simple. No email/SMS is sent. Timestamps are expected in ISO-8601.

Redis is an optimization and abuse-control dependency, not the inventory source of truth. Catalogue cache entries expire after 30 seconds and can briefly show stale availability. Booking always performs its atomic inventory check in PostgreSQL. If Redis is unavailable, cache access and rate limiting fail open so the core booking API remains available.
