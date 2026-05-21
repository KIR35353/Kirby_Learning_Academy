/**
 * Canonical HRIS user record — the normalised shape every adapter must return.
 * All adapters (Workday, SAP SuccessFactors, CSV) map their source data to this.
 */
export interface HrisUser {
  hrisId: string;          // unique identifier in the HRIS system
  email: string;
  name: string;
  hireDate?: Date;
  terminatedAt?: Date;     // truthy → employee has been terminated
  departmentName?: string;
  businessUnitName?: string;
  locationName?: string;
  jobTitleName?: string;
  isContractor?: boolean;
  managerId?: string;      // hrisId of their manager (future use)
}

export interface HrisAdapterConfig {
  tenantId: string;
  source: "workday" | "successfactors" | "csv";
}

export interface HrisAdapter {
  readonly source: "workday" | "successfactors" | "csv";
  /**
   * Fetch the full workforce snapshot from the HRIS system.
   * Must return all active AND recently terminated employees so the sync
   * job can deactivate terminated users.
   */
  fetchAll(): Promise<HrisUser[]>;
}
