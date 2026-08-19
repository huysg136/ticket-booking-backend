import { prisma } from "../../database/prisma";
import { cacheGet, cacheSet } from "../../infrastructure/redis";

const LIST_CACHE_KEY = "concerts:published";
const CACHE_TTL_SECONDS = 30;

type PublishedConcerts = Awaited<ReturnType<typeof queryPublishedConcerts>>;

function queryPublishedConcerts() {
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

export async function getPublishedConcerts() {
  const cached = await cacheGet<PublishedConcerts>(LIST_CACHE_KEY);
  if (cached) return cached;

  const concerts = await queryPublishedConcerts();
  await cacheSet(LIST_CACHE_KEY, concerts, CACHE_TTL_SECONDS);
  return concerts;
}

export async function getConcertById(id: string) {
  const cacheKey = `concerts:published:${id}`;
  const cached = await cacheGet<PublishedConcerts[number]>(cacheKey);
  if (cached) return cached;

  const concert = await prisma.concert.findFirst({
    where: {
      id,
      status: "PUBLISHED",
    },
    include: {
      ticketCategories: true,
    },
  });

  if (concert) await cacheSet(cacheKey, concert, CACHE_TTL_SECONDS);
  return concert;
}
