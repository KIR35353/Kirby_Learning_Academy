export type CourseStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface CourseTag {
  id: string;
  tag: string;
}

export interface CourseActiveVersion {
  versionNumber: number;
}

export interface CourseTenantRef {
  tenantId: string;
}

export interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: CourseStatus;
  objectives: string[];
  duration: number | null;
  thumbnailUrl: string | null;
  targetAudience: string | null;
  complianceTags: string[];
  isContractorVisible: boolean;
  activeVersionId: string | null;
  activeVersion: CourseActiveVersion | null;
  tags: CourseTag[];
  courseTenants?: CourseTenantRef[];
  createdAt: Date | string;
  updatedAt: Date | string;
  _count: { versions: number };
}
