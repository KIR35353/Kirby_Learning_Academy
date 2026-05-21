export interface BusinessUnitRow {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  sortOrder: number;
  hrisId: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    departments: number;
  };
}
