# Database design

```mermaid
erDiagram
  USER ||--o{ BOOKING : makes
  USER ||--o{ VOUCHER_USAGE : redeems
  CONCERT ||--o{ TICKET_CATEGORY : offers
  BOOKING ||--|{ BOOKING_ITEM : contains
  TICKET_CATEGORY ||--o{ BOOKING_ITEM : snapshots
  VOUCHER o|--o{ BOOKING : discounts
  VOUCHER ||--o{ VOUCHER_USAGE : tracks
  BOOKING ||--o| VOUCHER_USAGE : records
```

Key guarantees are unique user/email, voucher/code, `(userId,idempotencyKey)`, `(voucherId,userId)`, and one usage per booking. Foreign keys preserve relationships. Status, created time, concert status/start, user bookings, and category/concert have targeted indexes.

Money uses `Decimal(12,2)`, never JavaScript floating point. Booking item unit price and booking subtotal/discount/total are commercial snapshots, so later catalogue changes cannot rewrite history.
