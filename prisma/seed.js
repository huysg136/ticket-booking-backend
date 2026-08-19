require("dotenv/config");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../dist/generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const passwordHash = await bcrypt.hash("Assignment123!", 12);
  for (const [email, role] of [
    ["customer@example.com", "CUSTOMER"],
    ["operator@example.com", "OPERATOR"],
    ["admin@example.com", "ADMIN"],
  ]) {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role },
      create: { email, passwordHash, role },
    });
  }

  const existing = await prisma.concert.findFirst({
    where: { name: "GEEK Up Summer Concert", venue: "Ho Chi Minh City" },
  });
  const concert =
    existing ||
    (await prisma.concert.create({
      data: {
        name: "GEEK Up Summer Concert",
        description: "Flash sale concert",
        venue: "Ho Chi Minh City",
        startAt: new Date("2030-12-20T19:00:00+07:00"),
        status: "PUBLISHED",
        ticketCategories: {
          create: [
            { name: "VIP", price: 1500000, totalQuantity: 100, availableQuantity: 100 },
            { name: "STANDARD", price: 500000, totalQuantity: 500, availableQuantity: 500 },
          ],
        },
      },
    }));

  const now = Date.now();
  const startsAt = new Date(now - 86400000);
  const expiresAt = new Date(now + 365 * 86400000);
  await prisma.voucher.upsert({
    where: { code: "FLASH20" },
    update: { type: "PERCENTAGE", value: 20, usageLimit: 100, startsAt, expiresAt, active: true },
    create: {
      code: "FLASH20",
      type: "PERCENTAGE",
      value: 20,
      usageLimit: 100,
      startsAt,
      expiresAt,
    },
  });
  await prisma.voucher.upsert({
    where: { code: "WELCOME100" },
    update: {
      type: "FIXED_AMOUNT",
      value: 100000,
      usageLimit: 500,
      startsAt,
      expiresAt,
      active: true,
      minOrderAmount: 500000,
    },
    create: {
      code: "WELCOME100",
      type: "FIXED_AMOUNT",
      value: 100000,
      usageLimit: 500,
      startsAt,
      expiresAt,
      minOrderAmount: 500000,
    },
  });
  console.log(JSON.stringify({ event: "seed_complete", concertId: concert.id }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
