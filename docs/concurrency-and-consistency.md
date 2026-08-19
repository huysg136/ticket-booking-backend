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
