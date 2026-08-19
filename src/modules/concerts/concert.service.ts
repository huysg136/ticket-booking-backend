import { prisma } from "../../database/prisma";

export async function getPublishedConcerts() {
  return prisma.concert.findMany({
    where: {
      status: "PUBLISHED",
    },
    include: {
      ticketCategories: true,
    },
    orderBy: {
      startAt: "asc",
    },
  });
}

export async function getConcertById(id: string) {
  return prisma.concert.findFirst({
    where: {
      id,
      status: "PUBLISHED",
    },
    include: {
      ticketCategories: true,
    },
  });
}
