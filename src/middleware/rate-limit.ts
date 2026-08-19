import { Ratelimit } from "@upstash/ratelimit";
import { RequestHandler } from "express";
import { redis } from "../infrastructure/redis";

type Identifier = "ip" | "user";

function createRateLimit(
  prefix: string,
  requests: number,
  window: `${number} ${"s" | "m" | "h"}`,
  identifier: Identifier,
): RequestHandler {
  const limiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window),
        prefix: `ticket-booking:${prefix}`,
      })
    : null;

  return async (req, res, next) => {
    if (!limiter || process.env.RATE_LIMIT_ENABLED === "false") return next();

    const key = identifier === "user" ? (req.user?.id ?? req.ip) : req.ip;

    try {
      const result = await limiter.limit(key ?? "unknown");
      res.setHeader("X-RateLimit-Limit", String(result.limit));
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader("X-RateLimit-Reset", String(result.reset));

      if (!result.success) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
        );
        res.status(429).json({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "redis_rate_limit_failed_open",
          prefix,
          message: error instanceof Error ? error.message : "Unknown Redis error",
        }),
      );
      next();
    }
  };
}

export const authRateLimit = createRateLimit("auth", 10, "1 m", "ip");
export const bookingRateLimit = createRateLimit("booking", 10, "1 m", "user");
