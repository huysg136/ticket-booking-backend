import "dotenv/config";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redisEnabled = Boolean(url && token) && process.env.NODE_ENV !== "test";

export const redis = redisEnabled
  ? new Redis({
      url: url!,
      token: token!,
    })
  : null;

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    return await redis.get<T>(key);
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "redis_cache_read_failed",
        key,
        message: error instanceof Error ? error.message : "Unknown Redis error",
      }),
    );
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "redis_cache_write_failed",
        key,
        message: error instanceof Error ? error.message : "Unknown Redis error",
      }),
    );
  }
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;

  try {
    await redis.del(...keys);
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "redis_cache_delete_failed",
        keys,
        message: error instanceof Error ? error.message : "Unknown Redis error",
      }),
    );
  }
}
