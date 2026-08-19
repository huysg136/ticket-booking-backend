import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, conflict, notFound } from "../../utils/errors";

const include = {
  items: { include: { ticketCategory: { select: { name: true, concertId: true } } } },
  voucher: true,
} as const;
type Input = {
  userId: string;
  idempotencyKey: string;
  items: { ticketCategoryId: string; quantity: number }[];
  voucherCode?: string;
};

export async function createBooking(input: Input) {
  const key = {
    userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey },
  };
  const existing = await prisma.booking.findUnique({ where: key, include });
  if (existing) return { booking: existing, created: false };
  try {
    const booking = await prisma.$transaction(async (tx) => {
      const ids = input.items.map((i) => i.ticketCategoryId).sort();
      const categories = await tx.ticketCategory.findMany({
        where: { id: { in: ids } },
        include: { concert: true },
      });
      if (categories.length !== ids.length)
        throw badRequest("INVALID_TICKET_CATEGORY", "One or more ticket categories do not exist");
      if (new Set(categories.map((c) => c.concertId)).size !== 1)
        throw badRequest(
          "MULTIPLE_CONCERTS",
          "All ticket categories must belong to the same concert",
        );
      const concert = categories[0].concert;
      if (concert.status !== "PUBLISHED" || concert.startAt <= new Date())
        throw conflict("CONCERT_NOT_BOOKABLE", "Concert is not available for booking");
      const byId = new Map(categories.map((c) => [c.id, c]));
      let subtotal = new Prisma.Decimal(0);
      const lines: { ticketCategoryId: string; quantity: number; unitPrice: Prisma.Decimal }[] = [];
      for (const id of ids) {
        const item = input.items.find((i) => i.ticketCategoryId === id)!;
        const category = byId.get(id)!;
        const changed = await tx.ticketCategory.updateMany({
          where: { id, availableQuantity: { gte: item.quantity } },
          data: { availableQuantity: { decrement: item.quantity } },
        });
        if (changed.count !== 1)
          throw conflict("INSUFFICIENT_INVENTORY", `Not enough ${category.name} tickets available`);
        subtotal = subtotal.add(category.price.mul(item.quantity));
        lines.push({ ticketCategoryId: id, quantity: item.quantity, unitPrice: category.price });
      }
      let voucherId: string | undefined;
      let discount = new Prisma.Decimal(0);
      if (input.voucherCode) {
        const now = new Date();
        const voucher = await tx.voucher.findUnique({ where: { code: input.voucherCode } });
        if (!voucher || !voucher.active || voucher.startsAt > now || voucher.expiresAt <= now)
          throw conflict("INVALID_VOUCHER", "Voucher is invalid or outside its validity period");
        if (voucher.minOrderAmount && subtotal.lt(voucher.minOrderAmount))
          throw conflict(
            "VOUCHER_MINIMUM_NOT_MET",
            "Booking does not meet the voucher minimum amount",
          );
        if (
          await tx.voucherUsage.findUnique({
            where: { voucherId_userId: { voucherId: voucher.id, userId: input.userId } },
          })
        )
          throw conflict(
            "VOUCHER_ALREADY_USED",
            "This voucher has already been used by this customer",
          );
        const reserved = await tx.voucher.updateMany({
          where: { id: voucher.id, usedCount: { lt: voucher.usageLimit } },
          data: { usedCount: { increment: 1 } },
        });
        if (reserved.count !== 1)
          throw conflict("VOUCHER_EXHAUSTED", "Voucher usage limit has been reached");
        discount =
          voucher.type === "PERCENTAGE" ? subtotal.mul(voucher.value).div(100) : voucher.value;
        if (voucher.maxDiscountAmount)
          discount = Prisma.Decimal.min(discount, voucher.maxDiscountAmount);
        discount = Prisma.Decimal.min(discount, subtotal);
        voucherId = voucher.id;
      }
      const created = await tx.booking.create({
        data: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
          voucherId,
          subtotalAmount: subtotal,
          discountAmount: discount,
          totalAmount: subtotal.sub(discount),
          items: { create: lines },
        },
      });
      if (voucherId)
        await tx.voucherUsage.create({
          data: { voucherId, userId: input.userId, bookingId: created.id },
        });
      return tx.booking.findUniqueOrThrow({ where: { id: created.id }, include });
    });
    return { booking, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const booking = await prisma.booking.findUnique({ where: key, include });
      if (booking) return { booking, created: false };
      throw conflict("CONCURRENT_CONFLICT", "A concurrent request conflicted with this booking");
    }
    throw error;
  }
}
export const getMyBookings = (userId: string) =>
  prisma.booking.findMany({ where: { userId }, include, orderBy: { createdAt: "desc" } });
export async function getOwnBooking(id: string, userId: string) {
  const booking = await prisma.booking.findFirst({ where: { id, userId }, include });
  if (!booking) throw notFound("Booking not found");
  return booking;
}
