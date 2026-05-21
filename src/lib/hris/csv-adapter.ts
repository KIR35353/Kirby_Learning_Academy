/**
 * Generic CSV adapter for HRIS systems without a REST API.
 *
 * Accepts a UTF-8 CSV string (e.g. read from disk or fetched via SFTP).
 * Expected columns (case-insensitive, order irrelevant):
 *   hris_id, email, name, hire_date, termination_date,
 *   department, business_unit, location, job_title,
 *   employee_type, manager_id
 *
 * Usage:
 *   const csv = fs.readFileSync("employees.csv", "utf8");
 *   const adapter = new CsvAdapter(csv);
 *   const users = await adapter.fetchAll();
 */
import type { HrisAdapter, HrisUser } from "./types";

function parseRow(
  headers: string[],
  values: string[],
): Record<string, string> {
  return Object.fromEntries(
    headers.map((h, i) => [h.trim().toLowerCase(), (values[i] ?? "").trim()]),
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export class CsvAdapter implements HrisAdapter {
  readonly source = "csv" as const;
  private readonly csvContent: string;

  constructor(csvContent: string) {
    this.csvContent = csvContent;
  }

  async fetchAll(): Promise<HrisUser[]> {
    const lines = this.csvContent
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, "_"),
    );
    const users: HrisUser[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseRow(headers, parseCsvLine(lines[i]));

      const email = row["email"];
      const hrisId = row["hris_id"] || row["employee_id"] || row["id"];
      if (!email || !hrisId) continue;

      const terminationRaw = row["termination_date"] || row["terminated_at"];
      const terminatedAt = terminationRaw ? new Date(terminationRaw) : undefined;

      const hireRaw = row["hire_date"] || row["start_date"];

      const employeeType = row["employee_type"] || "";

      users.push({
        hrisId,
        email: email.toLowerCase(),
        name: row["name"] || row["full_name"] || email,
        hireDate: hireRaw ? new Date(hireRaw) : undefined,
        terminatedAt: terminatedAt && !isNaN(terminatedAt.getTime()) ? terminatedAt : undefined,
        departmentName: row["department"],
        businessUnitName: row["business_unit"],
        locationName: row["location"],
        jobTitleName: row["job_title"],
        isContractor: ["contractor", "contingent", "external"].includes(
          employeeType.toLowerCase(),
        ),
        managerId: row["manager_id"],
      });
    }

    return users;
  }
}
