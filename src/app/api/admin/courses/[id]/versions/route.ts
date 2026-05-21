import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadObject, S3_BUCKET } from "@/lib/s3";

const MANIFEST_FILE = "_course_manifest.json";
const ENTRY_FILE = "CBT_Introduction.html";
const MAX_ZIP_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * POST /api/admin/courses/[id]/versions
 * Multipart form with a single field `file` containing the course zip.
 *
 * 1. Validates zip structure (entry + manifest present)
 * 2. Parses manifest for auto-populate metadata
 * 3. Streams every file to S3 at `courses/{courseId}/v{n}/`
 * 4. Creates CourseVersion record
 * 5. Returns { version, manifest }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const canUpload =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("TENANT_ADMIN") ||
    roles.includes("INSTRUCTOR");
  if (!canUpload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: courseId } = await params;
  const course = await db.course.findFirst({
    where: { id: courseId, tenantId: session.user.tenantId },
    include: { _count: { select: { versions: true } } },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // ── Parse multipart ────────────────────────────────────────────────────────
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const zipBuffer = Buffer.from(await file.arrayBuffer());
  if (zipBuffer.length > MAX_ZIP_BYTES)
    return NextResponse.json({ error: "Zip exceeds 500 MB limit" }, { status: 413 });

  // ── Validate zip ───────────────────────────────────────────────────────────
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    return NextResponse.json({ error: "Invalid or corrupt zip file" }, { status: 400 });
  }

  const entries = zip.getEntries();
  const entryNames = entries.map((e) => e.entryName.replace(/^[^/]+\//, "")); // strip root folder

  const hasEntry = entryNames.some((n) => n === ENTRY_FILE);
  const hasManifest = entryNames.some((n) => n === MANIFEST_FILE);

  if (!hasEntry || !hasManifest) {
    return NextResponse.json(
      {
        error: `Invalid course zip. Must contain ${ENTRY_FILE} and ${MANIFEST_FILE}.`,
        found: entryNames.slice(0, 20),
      },
      { status: 422 },
    );
  }

  // ── Parse manifest ─────────────────────────────────────────────────────────
  const manifestEntry = entries.find((e) => e.entryName.replace(/^[^/]+\//, "") === MANIFEST_FILE)!;
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Could not parse _course_manifest.json" }, { status: 422 });
  }

  // ── Determine version number ───────────────────────────────────────────────
  const versionNumber = course._count.versions + 1;
  const s3Prefix = `courses/${courseId}/v${versionNumber}/`;

  // ── Upload files to S3 ────────────────────────────────────────────────────
  const uploadErrors: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Strip the top-level folder name so paths are relative to s3Prefix
    const relativePath = entry.entryName.replace(/^[^/]+\//, "");
    if (!relativePath) continue;

    const key = `${s3Prefix}${relativePath}`;
    const contentType = guessContentType(relativePath);

    try {
      await uploadObject(key, entry.getData(), contentType);
    } catch (err) {
      uploadErrors.push(`${relativePath}: ${String(err)}`);
    }
  }

  if (uploadErrors.length > 0) {
    return NextResponse.json(
      { error: "Some files failed to upload", details: uploadErrors },
      { status: 500 },
    );
  }

  // ── Create DB record ────────────────────────────────────────────────────────
  const version = await db.courseVersion.create({
    data: {
      courseId,
      versionNumber,
      s3Prefix,
      manifestSnapshot: manifest as never,
      originalFileName: file.name ?? null,
      fileSizeBytes: zipBuffer.length,
      uploadedById: session.user.id,
    },
  });

  // Auto-populate course metadata from manifest (only on first upload)
  if (versionNumber === 1) {
    const meta = extractManifestMeta(manifest);
    await db.course.update({
      where: { id: courseId },
      data: {
        ...(meta.title && !course.title ? { title: meta.title } : {}),
        objectives: meta.objectives,
        duration: meta.duration ?? undefined,
      },
    });
  }

  return NextResponse.json({ version, manifest, bucket: S3_BUCKET, prefix: s3Prefix }, { status: 201 });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    pdf: "application/pdf",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

function extractManifestMeta(manifest: Record<string, unknown>) {
  const title = typeof manifest.courseTitle === "string" ? manifest.courseTitle : undefined;
  const duration =
    typeof manifest.estimatedDuration === "number" ? manifest.estimatedDuration : undefined;

  const objectives: string[] = [];
  if (Array.isArray(manifest.objectives)) {
    for (const o of manifest.objectives) {
      if (typeof o === "string") objectives.push(o);
    }
  }

  return { title, duration, objectives };
}
