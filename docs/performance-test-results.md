# Performance test results

## Local peak-load run

The booking API was tested locally with k6 at the upper end of the assignment estimate.

| Metric | Result |
|---|---:|
| Configured arrival rate | 8 requests/second |
| Duration | 1 minute |
| Completed booking iterations | 480 |
| Interrupted iterations | 0 |
| Created bookings | 480 |
| Unexpected error rate | 0% |
| Checks | 960/960 passed |
| Booking latency average | 12.02 ms |
| Booking latency p95 | 21.17 ms |
| Booking latency maximum | 57.86 ms |

Both configured thresholds passed: booking p95 below 1 second and unexpected errors below 1%.

This result demonstrates that the local environment sustained approximately 480 booking requests per minute. It is not presented as a production capacity claim: production results depend on compute resources, networking, PostgreSQL sizing, connection pooling, and deployment topology. Database concurrency tests separately verify overselling, idempotency, and voucher invariants.
