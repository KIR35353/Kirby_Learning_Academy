/**
 * Shared ioredis connection for BullMQ.
 * BullMQ requires a connection options object (not an ioredis instance)
 * for Queue / Worker constructors.
 */
import type { ConnectionOptions } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

// Parse the URL so BullMQ gets host/port/password explicitly
const parsed = new URL(redisUrl);

export const redisConnection: ConnectionOptions = {
  host: parsed.hostname,
  port: parseInt(parsed.port || "6379", 10),
  ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
  ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
};
