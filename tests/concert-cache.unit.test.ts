import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockFindMany = jest.fn<(...args: unknown[]) => Promise<any>>();
const mockFindFirst = jest.fn<(...args: unknown[]) => Promise<any>>();
const mockCacheGet = jest.fn<(...args: unknown[]) => Promise<any>>();
const mockCacheSet = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock("../src/database/prisma", () => ({
  prisma: {
    concert: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
  },
}));

jest.mock("../src/infrastructure/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

import { getConcertById, getPublishedConcerts } from "../src/modules/concerts/concert.service";

describe("concert catalogue cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns a cache hit without querying PostgreSQL", async () => {
    const cached = [{ id: "concert-1", name: "Cached concert" }];
    mockCacheGet.mockResolvedValue(cached);

    await expect(getPublishedConcerts()).resolves.toEqual(cached);
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  test("queries PostgreSQL and caches a list miss for 30 seconds", async () => {
    const concerts = [{ id: "concert-1", name: "Database concert" }];
    mockCacheGet.mockResolvedValue(null);
    mockFindMany.mockResolvedValue(concerts);

    await expect(getPublishedConcerts()).resolves.toEqual(concerts);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } }),
    );
    expect(mockCacheSet).toHaveBeenCalledWith("concerts:published", concerts, 30);
  });

  test("uses a concert-specific cache key and does not cache not-found", async () => {
    mockCacheGet.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(null);

    await expect(getConcertById("concert-404")).resolves.toBeNull();
    expect(mockCacheGet).toHaveBeenCalledWith("concerts:published:concert-404");
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});
