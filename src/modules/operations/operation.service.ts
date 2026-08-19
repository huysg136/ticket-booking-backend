import { BookingStatus, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../database/prisma";
import { conflict, notFound } from "../../utils/errors";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  RECEIVED: ["WAITING_FOR_PAYMENT", "CANCELLED"],
  WAITING_FOR_PAYMENT: ["PAID", "CANCELLED", "EXPIRED"],
  PAID: [],
  CANCELLED: [],
  EXPIRED: [],
};
export async function listBookings(
  page: number,
  limit: number,
  status?: BookingStatus,
  suspicious?: string,
) {
  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : {}),
    ...(suspicious === "true" ? { items: { some: { quantity: { gte: 8 } } } } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: { user: { select: { id: true, email: true } }, items: true, voucher: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);
  return {
    data: data.map((b) => ({ ...b, isSuspicious: b.items.some((i) => i.quantity >= 8) })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
export async function getBooking(id: string) {
  const result = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      items: { include: { ticketCategory: true } },
      voucher: true,
    },
  });
  if (!result) throw notFound("Booking not found");
  return result;
}
export async function changeStatus(id: string, next: BookingStatus) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { status: BookingStatus }[]
    >`SELECT status FROM "Booking" WHERE id = ${id} FOR UPDATE`;
    const current = rows[0]?.status;
    if (!current) throw notFound("Booking not found");
    if (!transitions[current].includes(next))
      throw conflict(
        "INVALID_BOOKING_TRANSITION",
        `Cannot transition booking from ${current} to ${next}`,
      );
    if (next === "CANCELLED" || next === "EXPIRED") {
      const items = await tx.bookingItem.findMany({ where: { bookingId: id } });
      for (const item of items)
        await tx.ticketCategory.update({
          where: { id: item.ticketCategoryId },
          data: { availableQuantity: { increment: item.quantity } },
        });
    }
    return tx.booking.update({ where: { id }, data: { status: next }, include: { items: true } });
  });
}
export const createConcert = (data: {
  name: string;
  description?: string;
  venue: string;
  startAt: Date;
  ticketCategories?: { name: string; price: number; totalQuantity: number }[];
}) =>
  prisma.concert.create({
    data: {
      name: data.name,
      description: data.description,
      venue: data.venue,
      startAt: data.startAt,
      ticketCategories: data.ticketCategories
        ? {
            create: data.ticketCategories.map((c) => ({
              ...c,
              availableQuantity: c.totalQuantity,
            })),
          }
        : undefined,
    },
    include: { ticketCategories: true },
  });
export async function publishConcert(id: string) {
  const concert = await prisma.concert.findUnique({
    where: { id },
    include: { ticketCategories: true },
  });
  if (!concert) throw notFound("Concert not found");
  if (
    concert.status !== "DRAFT" ||
    concert.ticketCategories.length === 0 ||
    concert.startAt <= new Date()
  )
    throw conflict(
      "CONCERT_NOT_PUBLISHABLE",
      "Only a future draft concert with ticket categories can be published",
    );
  return prisma.concert.update({
    where: { id },
    data: { status: "PUBLISHED" },
    include: { ticketCategories: true },
  });
}
export async function availability(id: string) {
  const value = await prisma.ticketCategory.findUnique({
    where: { id },
    include: { concert: { select: { id: true, name: true, status: true } } },
  });
  if (!value) throw notFound("Ticket category not found");
  return value;
}
export const createVoucher = (data: Parameters<typeof prisma.voucher.create>[0]["data"]) =>
  prisma.voucher.create({ data });
export const listVouchers = () => prisma.voucher.findMany({ orderBy: { createdAt: "desc" } });
