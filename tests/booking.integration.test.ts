import request from "supertest";
import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, test } from "@jest/globals";
import app from "../src/app";
import { prisma } from "../src/database/prisma";

const dbUrl = process.env.DATABASE_URL ?? "";
let testDatabase = false;
try {
  testDatabase = /test/i.test(new URL(dbUrl).pathname);
} catch {
  testDatabase = false;
}
const enabled = process.env.RUN_INTEGRATION_TESTS === "true" && testDatabase;
const suite = enabled ? describe : describe.skip;

suite("booking consistency", () => {
  let token: string;
  let otherToken: string;
  let categoryId: string;
  beforeEach(async () => {
    await prisma.voucherUsage.deleteMany();
    await prisma.bookingItem.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.ticketCategory.deleteMany();
    await prisma.concert.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.user.deleteMany();
    const passwordHash = await bcrypt.hash("Assignment123!", 4);
    await prisma.user.createMany({
      data: [
        { email: "one@test.local", passwordHash },
        { email: "two@test.local", passwordHash },
      ],
    });
    token = (
      await request(app)
        .post("/api/auth/login")
        .send({ email: "one@test.local", password: "Assignment123!" })
    ).body.data.token;
    otherToken = (
      await request(app)
        .post("/api/auth/login")
        .send({ email: "two@test.local", password: "Assignment123!" })
    ).body.data.token;
    const concert = await prisma.concert.create({
      data: {
        name: "Test",
        venue: "Test",
        startAt: new Date(Date.now() + 86400000),
        status: "PUBLISHED",
        ticketCategories: {
          create: { name: "VIP", price: 1000, totalQuantity: 10, availableQuantity: 10 },
        },
      },
      include: { ticketCategories: true },
    });
    categoryId = concert.ticketCategories[0].id;
  });
  afterAll(() => prisma.$disconnect());
  const book = (key: string, auth = token, quantity = 1, voucherCode?: string) =>
    request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${auth}`)
      .set("Idempotency-Key", key)
      .send({ items: [{ ticketCategoryId: categoryId, quantity }], voucherCode });

  test("successful booking, validation, invalid category and insufficient inventory", async () => {
    expect((await book("success-key-0001")).status).toBe(201);
    expect(
      (
        await book("invalid-quantity").send({
          items: [{ ticketCategoryId: categoryId, quantity: 0 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/bookings")
          .set("Authorization", `Bearer ${token}`)
          .set("Idempotency-Key", "missing-category")
          .send({
            items: [{ ticketCategoryId: "00000000-0000-4000-8000-000000000000", quantity: 1 }],
          })
      ).status,
    ).toBe(400);
    expect((await book("too-many-00001", token, 10)).status).toBe(409);
  });

  test("idempotent retry returns one booking and decrements once", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => book("same-retry-key")));
    expect(new Set(responses.map((r) => r.body.data.id)).size).toBe(1);
    expect(await prisma.booking.count()).toBe(1);
    expect(
      (await prisma.ticketCategory.findUniqueOrThrow({ where: { id: categoryId } }))
        .availableQuantity,
    ).toBe(9);
  });

  test("20 concurrent requests reserve exactly 10 tickets without going negative", async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) => book(`concurrent-${i}`)),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(10);
    expect(
      (await prisma.ticketCategory.findUniqueOrThrow({ where: { id: categoryId } }))
        .availableQuantity,
    ).toBe(0);
    expect(await prisma.bookingItem.aggregate({ _sum: { quantity: true } })).toMatchObject({
      _sum: { quantity: 10 },
    });
  });

  test("customer cannot view another customer's booking", async () => {
    const created = await book("private-booking");
    expect(
      (
        await request(app)
          .get(`/api/bookings/${created.body.data.id}`)
          .set("Authorization", `Bearer ${otherToken}`)
      ).status,
    ).toBe(404);
  });

  test("voucher limit cannot be exceeded concurrently", async () => {
    const startsAt = new Date(Date.now() - 1000);
    const expiresAt = new Date(Date.now() + 86400000);
    await prisma.voucher.create({
      data: { code: "LIMIT5", type: "PERCENTAGE", value: 10, usageLimit: 5, startsAt, expiresAt },
    });
    const users = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const email = `voucher${i}@test.local`;
        await prisma.user.create({
          data: { email, passwordHash: await bcrypt.hash("Assignment123!", 4) },
        });
        return (
          await request(app).post("/api/auth/login").send({ email, password: "Assignment123!" })
        ).body.data.token as string;
      }),
    );
    const responses = await Promise.all(
      users.map((auth, i) => book(`voucher-${i}`, auth, 1, "LIMIT5")),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(5);
    expect((await prisma.voucher.findUniqueOrThrow({ where: { code: "LIMIT5" } })).usedCount).toBe(
      5,
    );
    expect(await prisma.voucherUsage.count()).toBe(5);
  });
});
