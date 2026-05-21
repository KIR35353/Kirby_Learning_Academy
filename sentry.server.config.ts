// Sentry server-side instrumentation (Node.js / API Routes)
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Don't capture 404s and rate-limit errors as Sentry issues
    ignoreErrors: [
      "Not found",
      "Too many requests",
      "Unauthorized",
      "Forbidden",
    ],

    beforeSend(event) {
      // Strip auth headers from Sentry payloads
      if (event.request?.headers) {
        const headers = { ...event.request.headers };
        delete headers["authorization"];
        delete headers["cookie"];
        event.request.headers = headers;
      }
      return event;
    },
  });
}
