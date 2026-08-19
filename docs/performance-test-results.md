# Performance test results

## Local peak-load run

The booking API was tested locally with k6 at the upper end of the assignment estimate.

Application rate limiting was disabled for this controlled run because the script uses one seeded customer and is intended to measure the booking transaction/database path. Rate limiting is tested separately and remains enabled during normal API usage.

| Metric                       |            Result |
| ---------------------------- | ----------------: |
| Configured arrival rate      | 8 requests/second |
| Duration                     |          1 minute |
| Completed booking iterations |               481 |
| Interrupted iterations       |                 0 |
| Created bookings             |               481 |
| Unexpected error rate        |                0% |
| Checks                       |    962/962 passed |
| Booking latency average      |          17.42 ms |
| Booking latency p95          |          30.01 ms |
| Booking latency maximum      |          79.87 ms |

Both configured thresholds passed: booking p95 below 1 second and unexpected errors below 1%.

This result demonstrates that the local environment sustained the configured eight booking requests per second and completed 481 bookings during the one-minute arrival window. A one-iteration boundary difference is normal for a time-based constant-arrival-rate executor. It is not presented as a production capacity claim: production results depend on compute resources, networking, PostgreSQL sizing, connection pooling, and deployment topology. Database concurrency tests separately verify overselling, idempotency, and voucher invariants.

Across local runs, booking p95 latency ranged from approximately 21–30 ms, with zero unexpected errors at eight requests per second.
