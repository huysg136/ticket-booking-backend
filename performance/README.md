# Performance testing

The k6 script logs in with the seeded customer, discovers published concerts, selects the ticket category with the highest availability, and sends a unique idempotency key for every booking.

Start PostgreSQL and the API, then confirm `k6 version` works:

```powershell
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

In another terminal, run the assignment peak load—8 requests/second for one minute:

```powershell
npm run perf:booking
```

Run for five minutes or override the target:

```powershell
$env:RATE = "8"
$env:DURATION = "5m"
$env:BASE_URL = "http://localhost:3000"
$env:TICKET_CATEGORY_ID = "optional-category-uuid"
npm run perf:booking
```

HTTP 409 is an expected inventory/voucher business conflict and is reported separately from unexpected errors. Thresholds require p95 booking latency below one second and unexpected responses below one percent. Results are saved to `performance/results/latest-summary.json`.

Use a dedicated database or replenish inventory before repeated runs. At 8 requests/second, a one-minute run needs approximately 480 available tickets to mostly measure successful booking transactions.
