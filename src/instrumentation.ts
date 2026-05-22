// Next.js instrumentation hook — runs once on server startup
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Ensure Meilisearch course index has correct settings (idempotent)
    const { initCourseIndex } = await import("./lib/meili");
    await initCourseIndex().catch(() => {
      // Non-fatal: Meilisearch may not be running in all envs
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
