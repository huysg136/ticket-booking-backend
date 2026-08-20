# Concurrency and consistency

The unsafe inventory pattern is read, check, then update: concurrent transactions can both observe the same stock. This project uses a conditional atomic update equivalent to:

```sql
UPDATE "TicketCategory"
SET "availableQuantity" = "availableQuantity" - :quantity
WHERE id = :id AND "availableQuantity" >= :quantity;
```

Zero changed rows means insufficient inventory. Categories are processed by sorted UUID to reduce deadlocks. Every decrement, snapshot, voucher reservation, booking item, and usage shares the transaction; any exception rolls back all work.

An early idempotency lookup speeds normal retries, but `UNIQUE(userId,idempotencyKey)` is the guarantee. A concurrent `P2002` loser reloads and returns the winner. Voucher capacity similarly uses `usedCount < usageLimit` in an atomic increment, while `(voucherId,userId)` prevents per-user reuse. Exhaustion fails the whole booking.

Status changes lock the booking row with `FOR UPDATE`, validate the transition graph, restore inventory on cancellation/expiry, and update status in one transaction. Terminal states prevent double restoration.

## Concurrency-control decision matrix

| Risk                                           | Selected mechanism                                         | Purpose                                                          | Why this mechanism                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Ticket overselling                             | Conditional atomic `UPDATE` inside the booking transaction | Decrement only when sufficient inventory remains                 | Validation and mutation happen in one database statement; no unsafe gap exists between reading and writing               |
| Voucher campaign oversubscription              | Conditional atomic increment                               | Increment `usedCount` only while it is below `usageLimit`        | The voucher counter has the same compare-and-update shape as ticket inventory                                            |
| Duplicate booking caused by retry/double-click | Idempotency key plus `UNIQUE(userId, idempotencyKey)`      | Return one logical booking for repeated requests                 | The early lookup is fast, while the database constraint resolves simultaneous first attempts                             |
| One customer reusing a voucher                 | `UNIQUE(voucherId, userId)`                                | Permit at most one usage per campaign/customer                   | An application lookup alone can race; uniqueness is enforced at commit time                                              |
| Concurrent cancel/expire/status changes        | Pessimistic booking-row lock with `SELECT ... FOR UPDATE`  | Serialize the read–validate–restore–transition workflow          | The decision depends on current state and may restore several inventory rows, so the booking must not be processed twice |
| Multi-category booking deadlock                | Deterministic category UUID ordering                       | Acquire update locks in the same order                           | Consistent ordering reduces circular waits between transactions reserving overlapping categories                         |
| Catalogue read pressure and request spam       | Upstash cache and distributed quotas                       | Reduce repeated reads and share rate limits across API instances | These are optimization/abuse-control concerns, not inventory correctness guarantees                                      |

## Why a transaction alone is not enough

A transaction makes its writes commit or roll back together, but this pattern is still unsafe if the availability check and update are separate operations without an appropriate lock:

```text
Transaction A reads available = 1
Transaction B reads available = 1
Transaction A writes available = 0
Transaction B writes available = 0
Both applications may believe they reserved the final ticket
```

The booking transaction therefore combines atomicity with a concurrency-safe conditional statement. Transaction boundaries protect the multi-record workflow; the conditional predicate protects the inventory decision.

## Why inventory does not use an explicit pessimistic pre-lock

An alternative implementation would execute `SELECT ... FOR UPDATE`, return availability to Node.js, check it, and then issue a second `UPDATE`. That can be correct, but it holds the row lock across more application work and requires an additional database round trip.

For a counter invariant that can be represented in one predicate, the selected statement is shorter and safer:

```sql
UPDATE "TicketCategory"
SET "availableQuantity" = "availableQuantity" - :quantity
WHERE id = :id
  AND "availableQuantity" >= :quantity;
```

PostgreSQL still acquires the required row-level update lock internally. If another transaction changes the row first, PostgreSQL evaluates the condition against the current row version; zero affected rows becomes `INSUFFICIENT_INVENTORY`. The design avoids an explicit pre-lock—it does not claim that an `UPDATE` is lock-free.

## Why status transitions use `SELECT FOR UPDATE`

Cancellation and expiration are not a single counter operation. The service must:

1. Read the current booking status.
2. Validate the transition graph.
3. Load all booking items.
4. Restore each category quantity when required.
5. Write the terminal status.

Two operators performing this workflow concurrently could otherwise restore inventory twice. Locking the booking row serializes the entire decision. After the first transaction commits, the second observes a terminal state and the transition is rejected.

## Why lookup-based idempotency still needs a unique constraint

The initial lookup handles ordinary retries efficiently, but two simultaneous first requests can both observe no booking. `UNIQUE(userId, idempotencyKey)` is the final arbiter. One transaction wins; the other receives Prisma `P2002`, reloads the winner, and returns it as an idempotent replay. The same principle applies to per-user voucher usage.

## Why Redis distributed locking is not used for inventory

Inventory, voucher usage, and booking records share one PostgreSQL transaction. PostgreSQL already owns the data and provides the row locks and constraints required to protect it. Adding a Redis lock would create two coordination systems without removing serialization on the database row.

A Redis lock also introduces failure modes that the current design does not need:

- The lock TTL can expire before the PostgreSQL transaction commits.
- A paused process can continue after another process acquires the expired lock.
- Redis/network failure requires a fail-open or fail-closed decision.
- Correct release requires ownership tokens; stronger protection requires fencing tokens accepted by the database.
- The database must still enforce its invariant if Redis and PostgreSQL disagree.

Upstash is therefore used for catalogue caching and distributed rate limiting only. It is not the inventory source of truth and its failure does not weaken PostgreSQL booking invariants.

## Scale limitations and evolution

The atomic update remains correct with multiple stateless API instances using one PostgreSQL primary. At extremely high contention, a single category row can become a throughput hot spot because updates must serialize. A Redis lock would also serialize that work and would not solve the hot-row bottleneck.

If measurements show that the assignment traffic has grown into sustained high-contention traffic, the evolution path is:

1. Add admission control/waiting-room behavior before the database.
2. Use queue-based backpressure for asynchronous booking commands when the product permits a `PROCESSING` state.
3. Partition workers by concert/category to control ordering.
4. Partition very hot inventory into multiple database buckets only when query/lock metrics justify the added reconciliation complexity.
5. Keep the reservation ledger, database constraints, and idempotency as the final correctness layer.

## Verification

The integration suite sends 20 concurrent booking requests against 10 available tickets and asserts all three persisted outcomes:

- Exactly 10 responses create bookings.
- Final `availableQuantity` is zero, never negative.
- Persisted booking-item quantity totals exactly 10.

Separate concurrent tests verify that repeated idempotency keys create one booking/decrement and that a voucher with capacity five is consumed exactly five times by ten competing users. The k6 test measures throughput and latency; it is not used as proof of overselling prevention.
