import { describe, expect, test } from "@jest/globals";
import { loginSchema } from "../src/modules/auth/auth.schema";
import { createBookingSchema } from "../src/modules/bookings/booking.schema";
import {
  concertSchema,
  listSchema,
  statusSchema,
  voucherSchema,
} from "../src/modules/operations/operation.schema";

const emptyRequest = { params: {}, query: {}, headers: {} };
const categoryId = "00000000-0000-4000-8000-000000000001";

describe("request schemas", () => {
  test("normalizes login email and rejects a short password", () => {
    const parsed = loginSchema.parse({
      ...emptyRequest,
      body: { email: "CUSTOMER@EXAMPLE.COM", password: "Assignment123!" },
    });
    expect(parsed.body.email).toBe("customer@example.com");

    expect(() =>
      loginSchema.parse({
        ...emptyRequest,
        body: { email: "customer@example.com", password: "short" },
      }),
    ).toThrow();
  });

  test("accepts a valid booking and normalizes its voucher code", () => {
    const parsed = createBookingSchema.parse({
      ...emptyRequest,
      headers: { "idempotency-key": "booking-key-0001" },
      body: {
        items: [{ ticketCategoryId: categoryId, quantity: 2 }],
        voucherCode: " launch10 ",
      },
    });

    expect(parsed.body.voucherCode).toBe("LAUNCH10");
  });

  test("rejects duplicate ticket categories, invalid quantity and missing idempotency key", () => {
    const duplicateItems = [
      { ticketCategoryId: categoryId, quantity: 1 },
      { ticketCategoryId: categoryId, quantity: 1 },
    ];

    expect(() =>
      createBookingSchema.parse({
        ...emptyRequest,
        headers: { "idempotency-key": "booking-key-0002" },
        body: { items: duplicateItems },
      }),
    ).toThrow("Duplicate ticket categories");

    expect(() =>
      createBookingSchema.parse({
        ...emptyRequest,
        headers: { "idempotency-key": "booking-key-0003" },
        body: { items: [{ ticketCategoryId: categoryId, quantity: 0 }] },
      }),
    ).toThrow();

    expect(() =>
      createBookingSchema.parse({
        ...emptyRequest,
        body: { items: [{ ticketCategoryId: categoryId, quantity: 1 }] },
      }),
    ).toThrow();
  });

  test("validates voucher dates and percentage bounds", () => {
    const validBody = {
      code: " launch20 ",
      type: "PERCENTAGE" as const,
      value: 20,
      usageLimit: 100,
      startsAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-09-01T00:00:00.000Z",
    };
    const parsed = voucherSchema.parse({ ...emptyRequest, body: validBody });
    expect(parsed.body).toMatchObject({ code: "LAUNCH20", active: true, value: 20 });

    expect(() =>
      voucherSchema.parse({ ...emptyRequest, body: { ...validBody, value: 101 } }),
    ).toThrow("Percentage cannot exceed 100");
    expect(() =>
      voucherSchema.parse({
        ...emptyRequest,
        body: { ...validBody, expiresAt: "2026-07-01T00:00:00.000Z" },
      }),
    ).toThrow("expiresAt must be after startsAt");
  });

  test("coerces operation pagination and enforces its maximum", () => {
    const parsed = listSchema.parse({
      ...emptyRequest,
      body: undefined,
      query: { page: "2", limit: "50", suspicious: "true" },
    });
    expect(parsed.query).toEqual({ page: 2, limit: 50, suspicious: "true" });

    expect(() =>
      listSchema.parse({ ...emptyRequest, body: undefined, query: { limit: "101" } }),
    ).toThrow();
  });

  test("validates concert input and supported booking transitions", () => {
    expect(() =>
      concertSchema.parse({
        ...emptyRequest,
        body: {
          name: "Flash Sale Concert",
          venue: "HCMC",
          startAt: "2027-01-01T12:00:00.000Z",
          ticketCategories: [{ name: "VIP", price: 1_000_000, totalQuantity: 100 }],
        },
      }),
    ).not.toThrow();

    expect(() =>
      statusSchema.parse({
        ...emptyRequest,
        params: { id: categoryId },
        body: { status: "UNKNOWN" },
      }),
    ).toThrow();
  });
});
