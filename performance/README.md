# Performance testing

The k6 script logs in with the seeded customer, discovers published concerts, selects the ticket category with the highest availability, and sends a unique idempotency key for every booking.

Start PostgreSQL, prepare data, and confirm `k6 version` works:

```powershell
npm run prisma:migrate
npm run prisma:seed
```

The load script uses one seeded customer, so the normal 10-bookings-per-minute user limit would intentionally return HTTP 429. Start a dedicated API process with rate limiting disabled to measure booking/database throughput.

Windows PowerShell:

```powershell
$env:RATE_LIMIT_ENABLED = "false"
npm run dev
```

macOS or Linux:

```bash
RATE_LIMIT_ENABLED=false npm run dev
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

Stop the dedicated API after testing. For normal usage, keep `RATE_LIMIT_ENABLED=true`. If PowerShell was used, clear the terminal override with:

```powershell
Remove-Item Env:RATE_LIMIT_ENABLED -ErrorAction SilentlyContinue
```
