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

const FAVICON_ALLOWED_TYPES = new Set([
  "image/png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const VALID_ASSET_TYPES = new Set(["logo", "favicon", "loginBanner"]);

function validatePng16x16(buffer: Buffer): boolean {
  // PNG IHDR width/height are 4-byte big-endian at offsets 16 and 20.
  if (buffer.length < 24) return false;
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i += 1) {
    if (buffer[i] !== pngSig[i]) return false;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width === 16 && height === 16;
}

function validateIcoHas16x16(buffer: Buffer): boolean {
  // ICO header: reserved(2), type(2), count(2), then count entries of 16 bytes.
  if (buffer.length < 22) return false;
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1 || count < 1) return false;

  for (let i = 0; i < count; i += 1) {
    const entryOffset = 6 + i * 16;
    if (entryOffset + 16 > buffer.length) break;
    const widthRaw = buffer.readUInt8(entryOffset);
    const heightRaw = buffer.readUInt8(entryOffset + 1);
    const width = widthRaw === 0 ? 256 : widthRaw;
    const height = heightRaw === 0 ? 256 : heightRaw;
    if (width === 16 && height === 16) return true;
  }

  return false;
}

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

  if (assetType === "favicon" && !FAVICON_ALLOWED_TYPES.has(f.type)) {
    return NextResponse.json(
      { error: "Favicon must be PNG or ICO." },
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

  if (assetType === "favicon") {
    const isValidSize =
      f.type === "image/png"
        ? validatePng16x16(buffer)
        : validateIcoHas16x16(buffer);

    if (!isValidSize) {
      return NextResponse.json(
        { error: "Favicon must be exactly 16x16 pixels." },
        { status: 400 },
      );
    }
  }

  await uploadObject(key, buffer, f.type);

  const url = `${getPublicFileUrl(key)}?v=${Date.now()}`;
  return NextResponse.json({ url });
}
