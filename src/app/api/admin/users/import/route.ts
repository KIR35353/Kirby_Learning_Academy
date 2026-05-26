import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles quoted fields, CRLF, BOM — covers Outlook, Azure AD, and plain exports.
function parseCsv(raw: string): Record<string, string>[] {
  // Strip BOM
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  function splitRow(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ── Column resolver ───────────────────────────────────────────────────────────
// Maps many possible column name spellings to a canonical field.
const COLUMN_MAP: Record<string, string[]> = {
  email:        ["e-mail address", "email address", "email", "mail", "userprincipalname", "upn"],
  name:         ["name", "displayname", "display name", "full name"],
  first_name:   ["first name", "firstname", "givenname", "given name"],
  last_name:    ["last name", "lastname", "surname"],
  department:   ["department"],
  job_title:    ["job title", "jobtitle", "title", "position"],
  location:     ["office", "officelocation", "office location", "business city", "city", "location"],
  phone:        ["business phone", "mobile phone", "mobile", "phone", "telephone", "telephonenumber"],
  hire_date:    ["hire date", "hiredate", "start date", "employeehiredate"],
  is_contractor:["contractor", "iscontractor", "is_contractor", "employment type", "employeetype"],
  is_active:    ["active", "isactive", "is_active", "accountenabled", "account enabled", "enabled"],
};

function resolveColumns(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(COLUMN_MAP)) {
    for (const alias of aliases) {
      if (row[alias] !== undefined) { out[canonical] = row[alias]; break; }
    }
  }
  return out;
}

function parseBool(val: string | undefined, defaultVal: boolean): boolean {
  if (!val) return defaultVal;
  return /^(true|yes|1|y)$/i.test(val.trim());
}

function parseDate(val: string | undefined): Date | null {
  if (!val?.trim()) return null;
  const d = new Date(val.trim());
  return isNaN(d.getTime()) ? null : d;
}

// ── GET /api/admin/users/import — returns template CSV ───────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = [
    "name,email,department,job_title,location,hire_date,role",
    "Jane Smith,jane.smith@example.com,Engineering,Software Engineer,Houston TX,2024-01-15,STUDENT",
    "John Manager,john.manager@example.com,Operations,Team Lead,,2023-06-01,MANAGER",
  ].join("\r\n");

  return new Response(template, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="kla-user-import-template.csv"',
    },
  });
}

// ── POST /api/admin/users/import ──────────────────────────────────────────────
// Body: multipart/form-data   file=<csv>
// Query: ?preview=true   → dry-run, returns preview rows but does not write
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string;

  const preview = new URL(req.url).searchParams.get("preview") === "true";

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const text = await (file as File).text();
  if (!text.trim()) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  const rawRows = parseCsv(text);
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
  }

  // Resolve default role
  const studentRole = await db.role.findFirst({ where: { name: "STUDENT" } });

  // Caches for org records (avoid redundant DB hits)
  const deptCache = new Map<string, string>();
  const locCache  = new Map<string, string>();
  const jtCache   = new Map<string, string>();

  /** Strip BOM, invisible Unicode, and control chars that `.trim()` misses. */
  function sanitizeOrgName(raw: string): string {
    return raw
      .replace(/[\uFEFF\u200B\u200C\u200D\u00AD\u2060\uFFFE]/g, "")
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim();
  }

  async function getDeptId(name: string) {
    const clean = sanitizeOrgName(name);
    if (!clean) return undefined;
    const key = clean.toLowerCase();
    if (deptCache.has(key)) return deptCache.get(key)!;
    const existing = await db.department.findFirst({ where: { tenantId, name: { equals: clean, mode: "insensitive" } } });
    const id = existing?.id ?? (preview ? `preview-dept-${key}` :
      (await db.department.create({ data: { name: clean, tenantId } })).id);
    deptCache.set(key, id);
    return id;
  }
  async function getLocId(name: string) {
    const clean = sanitizeOrgName(name);
    if (!clean) return undefined;
    const key = clean.toLowerCase();
    if (locCache.has(key)) return locCache.get(key)!;
    const existing = await db.location.findFirst({ where: { tenantId, name: { equals: clean, mode: "insensitive" } } });
    const id = existing?.id ?? (preview ? `preview-loc-${key}` :
      (await db.location.create({ data: { name: clean, tenantId } })).id);
    locCache.set(key, id);
    return id;
  }
  async function getJtId(name: string) {
    const clean = sanitizeOrgName(name);
    if (!clean) return undefined;
    const key = clean.toLowerCase();
    if (jtCache.has(key)) return jtCache.get(key)!;
    const existing = await db.jobTitle.findFirst({ where: { tenantId, name: { equals: clean, mode: "insensitive" } } });
    const id = existing?.id ?? (preview ? `preview-jt-${key}` :
      (await db.jobTitle.create({ data: { name: clean, tenantId } })).id);
    jtCache.set(key, id);
    return id;
  }

  // ── Process rows ──────────────────────────────────────────────────────────
  const results = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const previewRows: object[] = [];
  const errorRows: { row: number; email: string; error: string }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const r = resolveColumns(raw);

    // Build email — required
    const email = (r.email ?? "").toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorRows.push({ row: i + 2, email: email || "(empty)", error: "Invalid or missing email" });
      results.errors++;
      continue;
    }

    // Build display name — prefer explicit name, fall back to first+last, then email prefix
    const firstName = r.first_name?.trim() ?? "";
    const lastName  = r.last_name?.trim()  ?? "";
    const name = r.name?.trim()
      || (firstName || lastName ? `${firstName} ${lastName}`.trim() : null)
      || email.split("@")[0];

    const isContractor = parseBool(r.is_contractor, false);
    const isActive     = parseBool(r.is_active, true);
    const hireDate     = parseDate(r.hire_date);

    // Org IDs (create if new)
    let departmentId: string | undefined;
    let locationId:   string | undefined;
    let jobTitleId:   string | undefined;

    try {
      if (r.department?.trim()) departmentId = await getDeptId(r.department.trim());
      if (r.location?.trim())   locationId   = await getLocId(r.location.trim());
      if (r.job_title?.trim())  jobTitleId   = await getJtId(r.job_title.trim());
    } catch (e) {
      errorRows.push({ row: i + 2, email, error: `Org lookup failed: ${(e as Error).message}` });
      results.errors++;
      continue;
    }

    // Determine role to assign — default is STUDENT
    const roleRow = (r.role ?? "").toUpperCase().trim();
    const desiredRole =
      roleRow && roleRow !== "STUDENT" && roleRow !== "EMPLOYEE"
        ? await db.role.findFirst({ where: { name: roleRow } }) ?? studentRole
        : studentRole;

    if (preview) {
      previewRows.push({
        row: i + 2, email, name,
        department: r.department?.trim() || null,
        job_title: r.job_title?.trim() || null,
        location: r.location?.trim() || null,
        hire_date: hireDate?.toISOString().split("T")[0] ?? null,
        is_contractor: isContractor,
        is_active: isActive,
        role: desiredRole?.name ?? "STUDENT",
        action: "create", // will be refined below
      });
      continue;
    }

    // Upsert user
    try {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        await db.user.update({
          where: { email },
          data: {
            name,
            isContractor,
            isActive,
            ...(hireDate && { hireDate }),
            ...(departmentId && { departmentId }),
            ...(locationId   && { locationId }),
            ...(jobTitleId   && { jobTitleId }),
            hrisSource: "csv",
            lastHrisSyncAt: new Date(),
          },
        });
        results.updated++;
      } else {
        const tempHash = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
        const user = await db.user.create({
          data: {
            email, name, isContractor, isActive,
            passwordHash: tempHash,
            tenantId,
            hrisSource: "csv",
            lastHrisSyncAt: new Date(),
            ...(hireDate      && { hireDate }),
            ...(departmentId  && { departmentId }),
            ...(locationId    && { locationId }),
            ...(jobTitleId    && { jobTitleId }),
          },
        });
        if (desiredRole) {
          await db.userRole.create({ data: { userId: user.id, roleId: desiredRole.id } });
        }
        results.created++;
      }
    } catch (e) {
      errorRows.push({ row: i + 2, email, error: (e as Error).message });
      results.errors++;
    }
  }

  // For preview, annotate action based on existing emails
  if (preview) {
    const previewEmails = previewRows.map((r) => (r as { email: string }).email);
    const existingEmails = new Set(
      (await db.user.findMany({ where: { email: { in: previewEmails } }, select: { email: true } }))
        .map((u) => u.email)
    );
    for (const row of previewRows) {
      const r = row as Record<string, unknown>;
      r.action = existingEmails.has(r.email as string) ? "update" : "create";
    }
    return NextResponse.json({
      preview: true,
      total: rawRows.length,
      rows: previewRows,
      errors: errorRows,
    });
  }

  return NextResponse.json({ ...results, errors: results.errors, errorDetails: errorRows });
}
