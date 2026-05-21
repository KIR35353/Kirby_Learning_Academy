import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

// ── Logger singleton ──────────────────────────────────────────────────────────
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {
        // Production: structured JSON for log aggregation (CloudWatch / Datadog)
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

// ── Child loggers ─────────────────────────────────────────────────────────────
export const authLogger = logger.child({ module: "auth" });
export const apiLogger = logger.child({ module: "api" });
export const workerLogger = logger.child({ module: "worker" });
export const dbLogger = logger.child({ module: "db" });
