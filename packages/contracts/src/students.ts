export type StudentStatus = "ACTIVE" | "INACTIVE";
export type StudentSortField = "name" | "status" | "createdAt" | "updatedAt";
export type SortDirection = "asc" | "desc";

export type UnitSummary = {
  id: string;
  name: string;
  code: string | null;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  pagination: Pagination;
};

export type Student = {
  id: string;
  organizationId: string;
  userId: string | null;
  name: string;
  socialName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  operationalNote: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
  units: UnitSummary[];
};

export type PaginatedStudents = Paginated<Student>;

export type StudentDetailsPayload = {
  name: string;
  socialName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  operationalNote?: string | null;
};

export type StudentPayload = StudentDetailsPayload & {
  status?: StudentStatus;
  unitIds?: string[];
};

export type ListStudentsInput = {
  page?: string | undefined;
  pageSize?: string | undefined;
  search?: string | undefined;
  status?: StudentStatus | undefined;
  unitId?: string | undefined;
  sortBy?: StudentSortField | undefined;
  sortDirection?: SortDirection | undefined;
};

export type StudentAuditAction =
  | "student.created"
  | "student.updated"
  | "student.inactivated"
  | "student.reactivated"
  | "student.unit_linked"
  | "student.unit_unlinked";

export type StudentAuditMetadata = {
  changedFields?: string[];
  statusBefore?: StudentStatus;
  statusAfter?: StudentStatus;
  unitId?: string;
  unitIds?: string[];
};

export type StudentAuditEvent = {
  id: string;
  action: StudentAuditAction;
  occurredAt: string;
  metadata: StudentAuditMetadata;
};
