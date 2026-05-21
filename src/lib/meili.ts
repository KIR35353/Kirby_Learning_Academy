/**
 * Meilisearch client
 *
 * Local dev: Meilisearch in Docker (http://localhost:7700, master key = kla_meili_dev_key)
 * Production: set MEILI_HOST and MEILI_MASTER_KEY env vars.
 */
import { Meilisearch } from "meilisearch";

export const meili = new Meilisearch({
  host: process.env.MEILI_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILI_MASTER_KEY ?? "kla_meili_dev_key",
});

export const COURSE_INDEX = "courses";

/** Ensure the courses index exists with the correct settings. */
export async function initCourseIndex(): Promise<void> {
  const index = meili.index(COURSE_INDEX);

  await meili.createIndex(COURSE_INDEX, { primaryKey: "id" }).catch(() => {
    // Index may already exist — that's fine
  });

  await index.updateSettings({
    searchableAttributes: [
      "title",
      "description",
      "objectives",
      "tags",
      "category",
      "targetAudience",
    ],
    filterableAttributes: ["status", "category", "tags", "tenantId"],
    sortableAttributes: ["publishedAt", "title"],
    displayedAttributes: [
      "id", "title", "description", "category", "tags",
      "durationMinutes", "status", "thumbnailUrl", "tenantId", "publishedAt",
    ],
  });
}

/** Upsert a single course document into the Meilisearch index. */
export async function indexCourse(doc: {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  objectives: string[];
  targetAudience: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  status: string;
  publishedAt: string | null;
}): Promise<void> {
  const index = meili.index(COURSE_INDEX);
  await index.addDocuments([doc], { primaryKey: "id" });
}

/** Remove a course from the Meilisearch index. */
export async function deindexCourse(id: string): Promise<void> {
  const index = meili.index(COURSE_INDEX);
  await index.deleteDocument(id);
}
