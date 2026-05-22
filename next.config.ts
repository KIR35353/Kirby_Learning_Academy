import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// ── Security headers applied to every response ───────────────────────────────
const isDev = process.env.NODE_ENV === "development";
// In dev, MinIO runs at http://localhost:9000 (HTTP). In prod the S3/CDN is HTTPS.
const localMinioOrigin = isDev ? "http://localhost:9000" : "";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // unsafe-eval needed for Next.js dev
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https: ${localMinioOrigin}`.trim(),
      "font-src 'self' data:",
      "connect-src 'self' https://api.resend.com https://*.sentry.io",
      `frame-src 'self' ${localMinioOrigin}`.trim(),       // CBT iframe: MinIO in dev, S3/CDN in prod
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Ensure server-only code is not bundled for client
  serverExternalPackages: ["pino", "pino-pretty", "@react-pdf/renderer"],

  // Suppress noisy hydration warnings from development
  reactStrictMode: true,

  // Hide the Next.js dev toolbar (N icon)
  devIndicators: false,
};

// ── Sentry build-time config (disabled when no DSN is set) ───────────────────
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      sourcemaps: { disable: true },
      disableLogger: true,
    })
  : nextConfig;

