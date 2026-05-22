import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadObject, getCourseBaseUrl } from "@/lib/s3";

const MANIFEST_FILE = "_course_manifest.json";
const ENTRY_FILE    = "CBT_Introduction.html";
const MAX_ZIP_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * POST /api/admin/courses/import
 * Accepts a CBT zip, reads _course_manifest.json for metadata, creates the
 * Course record and CourseVersion (v1) in one shot — no manual form required.
 *
 * Manifest fields used:
 *   course.title              → title
 *   intro.audience_badge      → targetAudience
 *   intro.duration_badge      → duration (minutes parsed from "45-minute course")
 *   intro.objectives[].text   → objectives[]
 *   kla.description           → description
 *   kla.category              → category
 *   kla.tags[]                → tags
 *   kla.compliance_tags[]     → complianceTags
 *   kla.contractor_visible    → isContractorVisible
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles: string[] = (session.user as { roles?: string[] }).roles ?? [];
  const canImport =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("TENANT_ADMIN") ||
    roles.includes("INSTRUCTOR");
  if (!canImport) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── Parse multipart ──────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not parse form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const zipBuffer = Buffer.from(await (file as File).arrayBuffer());
  if (zipBuffer.length > MAX_ZIP_BYTES)
    return NextResponse.json({ error: "Zip exceeds 500 MB limit" }, { status: 413 });

  // ── Validate zip ─────────────────────────────────────────────────────────
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    return NextResponse.json({ error: "Invalid or corrupt zip file" }, { status: 400 });
  }

  const entries    = zip.getEntries();
  const normalize  = (name: string) => name.replace(/^[^/]+\//, ""); // strip root folder
  const entryNames = entries.map((e) => normalize(e.entryName));

  if (!entryNames.some((n) => n === ENTRY_FILE) || !entryNames.some((n) => n === MANIFEST_FILE)) {
    return NextResponse.json(
      { error: `Zip must contain ${ENTRY_FILE} and ${MANIFEST_FILE}.`, found: entryNames.slice(0, 20) },
      { status: 422 },
    );
  }

  // ── Parse manifest ───────────────────────────────────────────────────────
  const manifestEntry = entries.find((e) => normalize(e.entryName) === MANIFEST_FILE)!;
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Could not parse _course_manifest.json" }, { status: 422 });
  }

  const meta = extractManifestMeta(manifest);

  // ── Create Course record ─────────────────────────────────────────────────
  const course = await db.course.create({
    data: {
      title:                meta.title,
      description:          meta.description ?? null,
      category:             meta.category ?? null,
      targetAudience:       meta.targetAudience ?? null,
      objectives:           meta.objectives,
      duration:             meta.duration ?? null,
      isContractorVisible:  meta.contractorVisible,
      complianceTags:       meta.complianceTags,
      status:               "DRAFT",
      tenantId:             session.user.tenantId,
      createdById:          session.user.id,
      tags:      { create: meta.tags.map((tag) => ({ tag })) },
      languages: { create: [{ language: "en", isDefault: true }] },
    },
    include: {
      tags: true,
      activeVersion: { select: { versionNumber: true } },
      _count: { select: { versions: true } },
    },
  });

  // ── Upload files to S3 ───────────────────────────────────────────────────
  const s3Prefix     = `courses/${course.id}/v1/`;
  const uploadErrors: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const relativePath = normalize(entry.entryName);
    if (!relativePath) continue;

    try {
      await uploadObject(
        `${s3Prefix}${relativePath}`,
        entry.getData(),
        guessContentType(relativePath),
      );
    } catch (err) {
      uploadErrors.push(`${relativePath}: ${String(err)}`);
    }
  }

  if (uploadErrors.length > 0) {
    // Roll back the course record — content is unusable without S3
    await db.course.delete({ where: { id: course.id } });
    return NextResponse.json(
      { error: "Some files failed to upload to S3", details: uploadErrors },
      { status: 500 },
    );
  }

  // ── Detect thumbnail from zip ─────────────────────────────────────────────
  const thumbnailRelativePath = detectThumbnail(entries, normalize, meta.thumbnailPath);
  const thumbnailUrl = thumbnailRelativePath
    ? getCourseBaseUrl(s3Prefix) + thumbnailRelativePath
    : null;

  // ── Create CourseVersion and set as active ───────────────────────────────
  const version = await db.courseVersion.create({
    data: {
      courseId:          course.id,
      versionNumber:     1,
      s3Prefix,
      manifestSnapshot:  manifest as never,
      originalFileName:  (file as File).name ?? null,
      fileSizeBytes:     zipBuffer.length,
      uploadedById:      session.user.id,
      releaseDate:       meta.releaseDate ?? null,
      revisionNotes:     meta.revisionNotes ?? null,
    },
  });

  await db.course.update({
    where: { id: course.id },
    data:  { activeVersionId: version.id, ...(thumbnailUrl ? { thumbnailUrl } : {}) },
  });

  return NextResponse.json(
    { course: { ...course, activeVersionId: version.id }, version },
    { status: 201 },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract LMS-relevant fields from _course_manifest.json.
 * Uses the correct nested paths: course.title, intro.*, kla.*
 */
function extractManifestMeta(manifest: Record<string, unknown>) {
  const course = manifest.course as Record<string, unknown> | undefined;
  const intro  = manifest.intro  as Record<string, unknown> | undefined;
  const kla    = manifest.kla    as Record<string, unknown> | undefined;

  // Title — from course.title; fall back to legacy flat courseTitle field
  const title =
    (course?.title as string | undefined) ??
    (typeof manifest.courseTitle === "string" ? manifest.courseTitle : "Untitled Course");

  // Duration — parse "45-minute course" → 45
  const durationBadge  = intro?.duration_badge as string | undefined;
  const durationMinutes = durationBadge ? parseInt(durationBadge.match(/(\d+)/)?.[1] ?? "", 10) : NaN;
  const duration        = isNaN(durationMinutes) ? undefined : durationMinutes;

  // Target audience — from intro.audience_badge
  const targetAudience = intro?.audience_badge as string | undefined;

  // Objectives — from intro.objectives[].text
  const objectives: string[] = [];
  if (Array.isArray(intro?.objectives)) {
    for (const o of intro!.objectives as unknown[]) {
      if (typeof o === "object" && o && "text" in o && typeof (o as Record<string,unknown>).text === "string") {
        objectives.push((o as Record<string,unknown>).text as string);
      }
    }
  }

  // KLA-specific fields — strip TODO placeholder values
  const isTodo = (v: unknown): boolean =>
    typeof v === "string" && (v.startsWith("TODO:") || v.trim() === "");

  const description    = isTodo(kla?.description)    ? undefined : (kla?.description as string | undefined);
  const category       = isTodo(kla?.category)       ? undefined : (kla?.category    as string | undefined);
  const contractorVisible = typeof kla?.contractor_visible === "boolean" ? kla.contractor_visible : false;

  const tags = Array.isArray(kla?.tags)
    ? (kla!.tags as unknown[]).filter((t): t is string => typeof t === "string" && !isTodo(t))
    : [];

  const complianceTags = Array.isArray(kla?.compliance_tags)
    ? (kla!.compliance_tags as unknown[]).filter((t): t is string => typeof t === "string" && !isTodo(t))
    : [];

  const releaseDate = !isTodo(kla?.release_date)
    ? (kla?.release_date ? new Date(kla.release_date as string) : undefined)
    : undefined;

  const revisionNotes = !isTodo(kla?.revision_notes)
    ? (kla?.revision_notes as string | undefined)
    : undefined;

  // Thumbnail — manifest hint path (relative to zip root)
  const thumbnailPath = !isTodo(kla?.thumbnail)
    ? (kla?.thumbnail as string | undefined)
    : !isTodo(kla?.cover_image)
    ? (kla?.cover_image as string | undefined)
    : undefined;

  return { title, description, category, targetAudience, objectives, duration, tags, complianceTags, contractorVisible, releaseDate, revisionNotes, thumbnailPath };
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const THUMBNAIL_NAMES = ["thumbnail", "cover", "preview", "hero", "banner"];

/**
 * Find the best thumbnail candidate in a zip.
 * Priority: manifest hint → common name → first top-level image → any image.
 */
function detectThumbnail(
  entries: AdmZip.IZipEntry[],
  normalize: (name: string) => string,
  manifestHint?: string,
): string | null {
  const imageFiles = entries
    .filter((e) => !e.isDirectory)
    .map((e) => normalize(e.entryName))
    .filter((name) => IMAGE_EXTS.has(name.split(".").pop()?.toLowerCase() ?? ""));

  if (imageFiles.length === 0) return null;

  // 1. Manifest hint — exact or basename match
  if (manifestHint) {
    const hint = manifestHint.replace(/^\//, "");
    if (imageFiles.includes(hint)) return hint;
    const hintBase = hint.split("/").pop() ?? "";
    const found = imageFiles.find((e) => e.split("/").pop() === hintBase);
    if (found) return found;
  }

  // 2. Common thumbnail names (case-insensitive stem match)
  for (const name of THUMBNAIL_NAMES) {
    const found = imageFiles.find(
      (e) => e.split("/").pop()?.split(".")[0]?.toLowerCase() === name,
    );
    if (found) return found;
  }

  // 3. First top-level image
  const topLevel = imageFiles.find((e) => !e.includes("/"));
  if (topLevel) return topLevel;

  // 4. Any image at all
  return imageFiles[0];
}

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html",
    css:  "text/css",
    js:   "application/javascript",
    json: "application/json",
    png:  "image/png",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    gif:  "image/gif",
    svg:  "image/svg+xml",
    webp: "image/webp",
    mp3:  "audio/mpeg",
    mp4:  "video/mp4",
    woff: "font/woff",
    woff2:"font/woff2",
    ttf:  "font/ttf",
    pdf:  "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
