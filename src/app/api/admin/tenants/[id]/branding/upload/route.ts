import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadObject, getPublicFileUrl } from "@/lib/s3";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const VALID_ASSET_TYPES = new Set(["logo", "favicon", "loginBanner"]);

// POST /api/admin/tenants/[id]/branding/upload?type=logo|favicon|loginBanner
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const assetType = req.nextUrl.searchParams.get("type") ?? "logo";
  if (!VALID_ASSET_TYPES.has(assetType)) {
    return NextResponse.json({ error: "Invalid type. Use logo, favicon, or loginBanner." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const f = file as File;

  if (f.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 413 });
  }

  if (!ALLOWED_TYPES.has(f.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PNG, JPG, GIF, WebP, SVG, or ICO." },
      { status: 415 },
    );
  }

  // Derive a clean extension from the MIME type (don't trust the filename)
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  const ext = extMap[f.type] ?? "png";

  // Overwrite-friendly fixed key per asset type (no timestamp suffix)
  const key = `tenants/${id}/branding/${assetType}.${ext}`;

  const buffer = Buffer.from(await f.arrayBuffer());
  await uploadObject(key, buffer, f.type);

  const url = `${getPublicFileUrl(key)}?v=${Date.now()}`;
  return NextResponse.json({ url });
}
