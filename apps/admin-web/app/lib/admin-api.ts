import type {
  ListStudentsInput,
  PaginatedStudents,
  Student,
  StudentPayload,
  UnitSummary
} from "@gym-platform/contracts";

type AdminConfig = {
  apiBaseUrl: string;
  organizationId: string;
  devUserId: string;
  unitId?: string;
};

type AdminRequestOptions = {
  includeUnitContext?: boolean;
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number
  ) {
    super(message);
  }
}

export async function listStudents(input: ListStudentsInput): Promise<PaginatedStudents> {
  const config = readAdminConfig();
  const params = new URLSearchParams();

  if (input.page) {
    params.set("page", input.page);
  }

  if (input.search) {
    params.set("search", input.search);
  }

  if (input.status) {
    params.set("status", input.status);
  }

  const query = params.toString();

  return apiRequest<PaginatedStudents>(
    config,
    `/organizations/${config.organizationId}/students${query ? `?${query}` : ""}`
  );
}

export async function getStudent(studentId: string): Promise<Student> {
  const config = readAdminConfig();

  return apiRequest<Student>(
    config,
    `/organizations/${config.organizationId}/students/${studentId}`,
    {},
    { includeUnitContext: false }
  );
}

export async function listUnits(): Promise<UnitSummary[]> {
  const config = readAdminConfig();

  return apiRequest<UnitSummary[]>(
    config,
    `/organizations/${config.organizationId}/units`,
    {},
    { includeUnitContext: false }
  );
}

export async function createStudent(payload: StudentPayload): Promise<Student> {
  const config = readAdminConfig();

  return apiRequest<Student>(
    config,
    `/organizations/${config.organizationId}/students`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { includeUnitContext: false }
  );
}

export async function updateStudent(
  studentId: string,
  payload: Partial<StudentPayload>
): Promise<Student> {
  const config = readAdminConfig();

  return apiRequest<Student>(
    config,
    `/organizations/${config.organizationId}/students/${studentId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    { includeUnitContext: false }
  );
}

export async function inactivateStudent(studentId: string): Promise<Student> {
  return updateStudent(studentId, { status: "INACTIVE" });
}

export async function archiveStudent(studentId: string): Promise<Student> {
  const config = readAdminConfig();

  return apiRequest<Student>(
    config,
    `/organizations/${config.organizationId}/students/${studentId}`,
    {
      method: "DELETE"
    },
    { includeUnitContext: false }
  );
}

function readAdminConfig(): AdminConfig {
  const authAdapter = process.env.ADMIN_AUTH_ADAPTER ?? "temporary-header";

  if (process.env.NODE_ENV === "production" && authAdapter === "temporary-header") {
    throw new AdminApiError("Autenticacao administrativa temporaria bloqueada em producao.");
  }

  if (authAdapter === "supabase-jwt") {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      throw new AdminApiError(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para usar supabase-jwt."
      );
    }
  }

  const apiBaseUrl = process.env.ADMIN_API_BASE_URL ?? "http://localhost:3333";
  const organizationId = process.env.ADMIN_ORGANIZATION_ID;
  const devUserId = process.env.ADMIN_DEV_USER_ID;
  const unitId = process.env.ADMIN_UNIT_ID?.trim();

  // Se estivermos usando supabase-jwt, o devUserId não é mais estritamente obrigatório no header
  // pois o Auth passará a injetar via Bearer token (isso será implementado nas próximas fases).
  // Porém para manter retrocompatibilidade com testes temporários, mantemos o check para temporary-header.
  if (authAdapter === "temporary-header" && (!organizationId || !devUserId)) {
    throw new AdminApiError(
      "Configure ADMIN_ORGANIZATION_ID e ADMIN_DEV_USER_ID no servidor do admin."
    );
  }

  return {
    apiBaseUrl,
    organizationId: organizationId || "",
    devUserId: devUserId || "",
    ...(unitId ? { unitId } : {})
  };
}

async function apiRequest<T>(
  config: AdminConfig,
  path: string,
  init: RequestInit = {},
  options: AdminRequestOptions = {}
): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-dev-user-id": config.devUserId,
      ...(config.unitId && options.includeUnitContext !== false
        ? { "x-unit-id": config.unitId }
        : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new AdminApiError(
      payload.message ?? "Falha ao chamar API administrativa.",
      response.status
    );
  }

  return (await response.json()) as T;
}

async function readErrorPayload(response: Response): Promise<{ message?: string }> {
  try {
    return (await response.json()) as { message?: string };
  } catch {
    return {};
  }
}
