/**
 * Workday REST adapter.
 *
 * Workday exposes its workforce data via the "Workers" resource in its
 * REST API (Workday REST API — Human Capital Management, v42+).
 *
 * Required env vars:
 *   WORKDAY_BASE_URL   — e.g. https://wd2-impl-services1.workday.com/ccx/api/v1/{tenant}
 *   WORKDAY_CLIENT_ID
 *   WORKDAY_CLIENT_SECRET
 *   WORKDAY_TOKEN_URL  — OAuth2 token endpoint
 */
import type { HrisAdapter, HrisUser } from "./types";

interface WorkdayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface WorkdayWorker {
  id: string;
  descriptor: string;
  primaryWorkEmail?: string;
  hireDate?: string;
  terminationDate?: string;
  primaryJob?: {
    jobTitle?: { descriptor?: string };
    businessSiteName?: string;
    department?: { descriptor?: string };
    businessUnit?: { descriptor?: string };
    workerType?: { id?: string };
  };
  manager?: { id?: string };
}

interface WorkdayWorkersResponse {
  data: WorkdayWorker[];
  total: number;
  offset: number;
  limit: number;
}

export class WorkdayAdapter implements HrisAdapter {
  readonly source = "workday" as const;

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenUrl: string;

  constructor() {
    const baseUrl = process.env.WORKDAY_BASE_URL;
    const clientId = process.env.WORKDAY_CLIENT_ID;
    const clientSecret = process.env.WORKDAY_CLIENT_SECRET;
    const tokenUrl = process.env.WORKDAY_TOKEN_URL;

    if (!baseUrl || !clientId || !clientSecret || !tokenUrl) {
      throw new Error(
        "Workday adapter: missing env vars (WORKDAY_BASE_URL, WORKDAY_CLIENT_ID, WORKDAY_CLIENT_SECRET, WORKDAY_TOKEN_URL)",
      );
    }

    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenUrl = tokenUrl;
  }

  private async getAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`Workday token request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as WorkdayTokenResponse;
    return data.access_token;
  }

  async fetchAll(): Promise<HrisUser[]> {
    const token = await this.getAccessToken();
    const users: HrisUser[] = [];
    const limit = 100;
    let offset = 0;
    let total = Infinity;

    while (offset < total) {
      const url = `${this.baseUrl}/workers?limit=${limit}&offset=${offset}&format=simpleCompact`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Workday /workers failed: ${res.status} ${res.statusText}`);
      }

      const page = (await res.json()) as WorkdayWorkersResponse;
      total = page.total;

      for (const w of page.data) {
        if (!w.primaryWorkEmail) continue;

        users.push({
          hrisId: w.id,
          email: w.primaryWorkEmail.toLowerCase(),
          name: w.descriptor,
          hireDate: w.hireDate ? new Date(w.hireDate) : undefined,
          terminatedAt: w.terminationDate ? new Date(w.terminationDate) : undefined,
          departmentName: w.primaryJob?.department?.descriptor,
          businessUnitName: w.primaryJob?.businessUnit?.descriptor,
          locationName: w.primaryJob?.businessSiteName,
          jobTitleName: w.primaryJob?.jobTitle?.descriptor,
          isContractor: w.primaryJob?.workerType?.id === "CONTINGENT_WORKER",
          managerId: w.manager?.id,
        });
      }

      offset += page.data.length;
      if (page.data.length === 0) break;
    }

    return users;
  }
}
