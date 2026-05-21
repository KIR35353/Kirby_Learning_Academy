/**
 * SAP SuccessFactors adapter (OData v2).
 *
 * Uses the PerPerson / EmpEmployment / EmpJob entities via the
 * SuccessFactors OData API.
 *
 * Required env vars:
 *   SF_BASE_URL      — e.g. https://api4.successfactors.com/odata/v2
 *   SF_COMPANY_ID
 *   SF_USERNAME      — API user (apiUsername@companyId)
 *   SF_PASSWORD
 */
import type { HrisAdapter, HrisUser } from "./types";

interface SFEmployeeRecord {
  userId: string;
  defaultFullName?: string;
  email?: string;
  hireDate?: string;       // /Date(ms)/ format
  endDate?: string;
  department?: string;
  businessUnit?: string;
  location?: string;
  jobTitle?: string;
  employeeType?: string;
  managerId?: string;
}

interface SFODataResponse {
  d: {
    results: SFEmployeeRecord[];
    __next?: string;
  };
}

function parseSfDate(value?: string): Date | undefined {
  if (!value) return undefined;
  // OData /Date(ms)/ or ISO string
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1], 10));
  return new Date(value);
}

export class SuccessFactorsAdapter implements HrisAdapter {
  readonly source = "successfactors" as const;

  private readonly baseUrl: string;
  private readonly companyId: string;
  private readonly authHeader: string;

  constructor() {
    const baseUrl = process.env.SF_BASE_URL;
    const companyId = process.env.SF_COMPANY_ID;
    const username = process.env.SF_USERNAME;
    const password = process.env.SF_PASSWORD;

    if (!baseUrl || !companyId || !username || !password) {
      throw new Error(
        "SuccessFactors adapter: missing env vars (SF_BASE_URL, SF_COMPANY_ID, SF_USERNAME, SF_PASSWORD)",
      );
    }

    this.baseUrl = baseUrl;
    this.companyId = companyId;
    this.authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  }

  async fetchAll(): Promise<HrisUser[]> {
    const users: HrisUser[] = [];

    const select = [
      "userId", "defaultFullName", "email",
      "hireDate", "endDate", "department", "businessUnit",
      "location", "jobTitle", "employeeType", "managerId",
    ].join(",");

    let url: string | undefined =
      `${this.baseUrl}/PerPersonal?$format=json&$select=${select}&$top=200&companyId='${this.companyId}'`;

    while (url) {
      const res = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`SuccessFactors OData failed: ${res.status} ${res.statusText}`);
      }

      const page = (await res.json()) as SFODataResponse;

      for (const emp of page.d.results) {
        if (!emp.email) continue;

        const terminatedAt = parseSfDate(emp.endDate);

        users.push({
          hrisId: emp.userId,
          email: emp.email.toLowerCase(),
          name: emp.defaultFullName ?? emp.email,
          hireDate: parseSfDate(emp.hireDate),
          terminatedAt,
          departmentName: emp.department,
          businessUnitName: emp.businessUnit,
          locationName: emp.location,
          jobTitleName: emp.jobTitle,
          isContractor: emp.employeeType?.toUpperCase() === "CONTRACTOR",
          managerId: emp.managerId,
        });
      }

      // OData pagination
      url = page.d.__next;
    }

    return users;
  }
}
