import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
const rate = Number(__ENV.RATE || 8);
const duration = __ENV.DURATION || "1m";
const createdBookings = new Counter("created_bookings");
const idempotentReplays = new Counter("idempotent_replays");
const businessConflicts = new Counter("business_conflicts");
const unexpectedErrors = new Rate("unexpected_errors");
const bookingLatency = new Trend("booking_latency", true);

export const options = {
  scenarios: {
    continuous_booking: {
      executor: "constant-arrival-rate",
      rate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: Math.max(20, rate * 2),
      maxVUs: Math.max(100, rate * 10),
    },
  },
  thresholds: {
    booking_latency: ["p(95)<1000"],
    unexpected_errors: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

function parseJson(response, label) {
  try {
    return response.json();
  } catch (_) {
    throw new Error(`${label} returned non-JSON response (HTTP ${response.status})`);
  }
}

export function setup() {
  const loginResponse = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({
      email: __ENV.CUSTOMER_EMAIL || "customer@example.com",
      password: __ENV.CUSTOMER_PASSWORD || "Assignment123!",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (loginResponse.status !== 200) {
    throw new Error(`Login failed (HTTP ${loginResponse.status}): ${loginResponse.body}`);
  }

  const concertsResponse = http.get(`${baseUrl}/api/concerts`);
  if (concertsResponse.status !== 200) {
    throw new Error(`Concert lookup failed (HTTP ${concertsResponse.status})`);
  }
  const categories = parseJson(concertsResponse, "Concert lookup").data.flatMap(
    (concert) => concert.ticketCategories || [],
  );
  const selected = __ENV.TICKET_CATEGORY_ID
    ? categories.find((category) => category.id === __ENV.TICKET_CATEGORY_ID)
    : categories.sort((a, b) => b.availableQuantity - a.availableQuantity)[0];
  if (!selected) {
    throw new Error(
      "No published ticket category found. Run the seed or provide TICKET_CATEGORY_ID.",
    );
  }

  console.log(
    `Target ${selected.name} (${selected.id}), available=${selected.availableQuantity}, rate=${rate}/s, duration=${duration}`,
  );
  return {
    token: parseJson(loginResponse, "Login").data.token,
    ticketCategoryId: selected.id,
    runId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}

export default function (data) {
  const response = http.post(
    `${baseUrl}/api/bookings`,
    JSON.stringify({
      items: [{ ticketCategoryId: data.ticketCategoryId, quantity: 1 }],
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`,
        "Idempotency-Key": `k6-${data.runId}-${__VU}-${__ITER}`,
      },
      tags: { endpoint: "create_booking" },
    },
  );

  bookingLatency.add(response.timings.duration);
  const expected = response.status === 201 || response.status === 200 || response.status === 409;
  unexpectedErrors.add(!expected);
  if (response.status === 201) createdBookings.add(1);
  else if (response.status === 200) idempotentReplays.add(1);
  else if (response.status === 409) businessConflicts.add(1);

  check(response, {
    "response is an expected business result": () => expected,
    "server does not return 5xx": (res) => res.status < 500,
  });
}

export function handleSummary(data) {
  return {
    stdout: "\nSaved detailed result to performance/results/latest-summary.json\n",
    "performance/results/latest-summary.json": JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        target: baseUrl,
        configuredRatePerSecond: rate,
        configuredDuration: duration,
        metrics: data.metrics,
      },
      null,
      2,
    ),
  };
}
