import type {
  ListStudentsInput,
  SortDirection,
  StudentSortField,
  StudentStatus
} from "@gym-platform/contracts";

export type StudentSearchParams = Record<string, string | string[] | undefined>;

export function parseStudentListQuery(params: StudentSearchParams): ListStudentsInput {
  return {
    page: positiveInteger(readParam(params.page), "1"),
    pageSize: pageSize(readParam(params.pageSize)),
    search: trimmed(readParam(params.search)),
    status: studentStatus(readParam(params.status)),
    unitId: trimmed(readParam(params.unitId)),
    sortBy: sortField(readParam(params.sortBy)),
    sortDirection: sortDirection(readParam(params.sortDirection))
  };
}

export function buildStudentsHref(input: ListStudentsInput, page: number): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...input, page: String(page) })) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/students?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function trimmed(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function positiveInteger(value: string | undefined, fallback: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : fallback;
}

function pageSize(value: string | undefined): string {
  return ["10", "20", "50", "100"].includes(value ?? "") ? value! : "20";
}

function studentStatus(value: string | undefined): StudentStatus | undefined {
  return value === "ACTIVE" || value === "INACTIVE" ? value : undefined;
}

function sortField(value: string | undefined): StudentSortField {
  return ["name", "status", "createdAt", "updatedAt"].includes(value ?? "")
    ? (value as StudentSortField)
    : "name";
}

function sortDirection(value: string | undefined): SortDirection {
  return value === "desc" ? "desc" : "asc";
}
