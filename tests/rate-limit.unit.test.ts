import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

const mockLimit = jest.fn<(identifier: string) => Promise<any>>();
const mockSlidingWindow = jest.fn(() => "window");
const mockRatelimit = jest.fn().mockImplementation(() => ({ limit: mockLimit }));
Object.assign(mockRatelimit, { slidingWindow: mockSlidingWindow });

jest.mock("@upstash/ratelimit", () => ({ Ratelimit: mockRatelimit }));
jest.mock("../src/infrastructure/redis", () => ({ redis: { mocked: true } }));

import { authRateLimit, bookingRateLimit } from "../src/middleware/rate-limit";

function responseDouble() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return { res: res as unknown as Response, headers, status: res.status, json: res.json };
}

describe("distributed rate limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RATE_LIMIT_ENABLED;
  });

  test("allows a request and exposes quota headers", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    });
    const req = { ip: "127.0.0.1" } as Request;
    const { res, headers } = responseDouble();
    const next = jest.fn() as NextFunction;

    await authRateLimit(req, res, next);

    expect(mockLimit).toHaveBeenCalledWith("127.0.0.1");
    expect(headers).toMatchObject({ "X-RateLimit-Limit": "10", "X-RateLimit-Remaining": "9" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("returns 429 after a user exceeds the booking quota", async () => {
    mockLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30_000,
    });
    const req = { ip: "127.0.0.1", user: { id: "user-1", role: "CUSTOMER" } } as Request;
    const { res, status, json, headers } = responseDouble();
    const next = jest.fn() as NextFunction;

    await bookingRateLimit(req, res, next);

    expect(mockLimit).toHaveBeenCalledWith("user-1");
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED" }) }),
    );
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
    expect(next).not.toHaveBeenCalled();
  });

  test("fails open when Upstash is temporarily unavailable", async () => {
    mockLimit.mockRejectedValue(new Error("Upstash unavailable"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const req = { ip: "127.0.0.1" } as Request;
    const { res } = responseDouble();
    const next = jest.fn() as NextFunction;

    await authRateLimit(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("redis_rate_limit_failed_open"));
    warn.mockRestore();
  });

  test("can be explicitly disabled for a controlled load test", async () => {
    process.env.RATE_LIMIT_ENABLED = "false";
    const req = { ip: "127.0.0.1" } as Request;
    const { res } = responseDouble();
    const next = jest.fn() as NextFunction;

    await authRateLimit(req, res, next);

    expect(mockLimit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
