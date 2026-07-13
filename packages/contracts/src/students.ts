export type StudentStatus = "ACTIVE" | "INACTIVE";

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

export type StudentPayload = {
  name: string;
  socialName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  operationalNote?: string | null;
  status?: StudentStatus;
  unitIds?: string[];
};

export type ListStudentsInput = {
  page?: string | undefined;
  search?: string | undefined;
  status?: StudentStatus | undefined;
};
