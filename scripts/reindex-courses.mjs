/**
 * reindex-courses.mjs
 * Pushes all PUBLISHED courses for every tenant into the Meilisearch index.
 * Safe to run repeatedly — upserts documents.
 *
 * Uses raw pg (no TypeScript/Prisma needed) so it works as a plain .mjs script.
 * Usage: node scripts/reindex-courses.mjs
 */
import pg from 'pg';

const DB_URL    = process.env.DATABASE_URL  ?? 'postgresql://kla:kla_dev_password@localhost:5432/kla_dev?schema=public';
const MEILI_URL = process.env.MEILI_URL     ?? 'http://localhost:7700';
const MEILI_KEY = process.env.MEILI_KEY     ?? 'kla_meili_dev_key';
const INDEX     = 'courses';

async function meiliPost(path, body) {
  const res = await fetch(`${MEILI_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MEILI_KEY}` },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Meilisearch ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function meiliPatch(path, body) {
  const res = await fetch(`${MEILI_URL}${path}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MEILI_KEY}` },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Meilisearch PATCH ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

// Ensure index exists with correct settings
async function ensureIndex() {
  const res = await fetch(`${MEILI_URL}/indexes/${INDEX}`, {
    headers: { 'Authorization': `Bearer ${MEILI_KEY}` },
  });
  if (res.status === 404) {
    await meiliPost('/indexes', { uid: INDEX, primaryKey: 'id' });
  }
  await meiliPatch(`/indexes/${INDEX}/settings`, {
    searchableAttributes: ['title', 'description', 'objectives', 'tags', 'category', 'targetAudience'],
    filterableAttributes: ['status', 'category', 'tags', 'tenantId'],
    sortableAttributes:   ['publishedAt', 'title'],
    displayedAttributes:  ['id', 'title', 'description', 'category', 'tags', 'durationMinutes',
                           'status', 'thumbnailUrl', 'tenantId', 'publishedAt', 'duration', 'targetAudience'],
  });
}

async function main() {
  await ensureIndex();

  // Use raw pg — Prisma generated client is TypeScript-only
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  const { rows: courses } = await client.query(`
    SELECT c.id, c."tenantId", c.title, c.description, c.category,
           c.objectives, c."targetAudience", c.duration, c."thumbnailUrl",
           c."updatedAt",
           COALESCE(
             json_agg(t.tag) FILTER (WHERE t.tag IS NOT NULL),
             '[]'
           ) AS tags
    FROM   courses c
    LEFT   JOIN course_tags t ON t."courseId" = c.id
    WHERE  c.status = 'PUBLISHED'
    GROUP  BY c.id
  `);

  await client.end();

  if (courses.length === 0) {
    console.log('  Reindex  no published courses found.');
    return;
  }

  const docs = courses.map((c) => ({
    id:             c.id,
    tenantId:       c.tenantId,
    title:          c.title,
    description:    c.description,
    category:       c.category,
    tags:           Array.isArray(c.tags) ? c.tags : [],
    objectives:     Array.isArray(c.objectives) ? c.objectives : [],
    targetAudience: c.targetAudience,
    duration:       c.duration,
    thumbnailUrl:   c.thumbnailUrl,
    status:         'PUBLISHED',
    publishedAt:    c.updatedAt?.toISOString() ?? new Date().toISOString(),
  }));

  await meiliPost(`/indexes/${INDEX}/documents`, docs);
  console.log(`  Reindex  indexed ${courses.length} course(s) into Meilisearch.`);
}

main().catch((err) => {
  console.error('  Reindex  ERROR:', err.message);
  process.exit(1);
});
