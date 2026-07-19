import type {
  ListStudentsInput,
  PaginatedStudents,
  Student,
  StudentPayload,
  UnitSummary
} from "@gym-platform/contracts";

import {
  readAdminAuthAdapter,
  requireSupabasePublicConfig,
  type AdminAuthAdapter
} from "./admin-auth";
import { createClient } from "./supabase/server";

type AdminConfig = {
  authAdapter: AdminAuthAdapter;
  apiBaseUrl: string;
  organizationId: string;
  devUserId?: string;
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
  const authAdapter = readAdminAuthAdapter();

  if (authAdapter === "supabase-jwt") {
    requireSupabasePublicConfig();
  }

  const apiBaseUrl = process.env.ADMIN_API_BASE_URL ?? "http://localhost:3333";
  const organizationId = process.env.ADMIN_ORGANIZATION_ID;
  const devUserId = process.env.ADMIN_DEV_USER_ID;
  const unitId = process.env.ADMIN_UNIT_ID?.trim();

  if (!organizationId || (authAdapter === "temporary-header" && !devUserId)) {
    throw new AdminApiError(
      authAdapter === "temporary-header"
        ? "Configure ADMIN_ORGANIZATION_ID e ADMIN_DEV_USER_ID no servidor do admin."
        : "Configure ADMIN_ORGANIZATION_ID no servidor do admin."
    );
  }

  return {
    authAdapter,
    apiBaseUrl,
    organizationId,
    ...(devUserId ? { devUserId } : {}),
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
      ...(await readAuthHeaders(config)),
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

async function readAuthHeaders(config: AdminConfig): Promise<Record<string, string>> {
  if (config.authAdapter === "temporary-header") {
    return { "x-dev-user-id": config.devUserId! };
  }

  const {
    data: { session }
  } = await (await createClient()).auth.getSession();

  if (!session?.access_token) {
    throw new AdminApiError("Sua sessão expirou. Entre novamente para continuar.", 401);
  }

  return { authorization: `Bearer ${session.access_token}` };
}

async function readErrorPayload(response: Response): Promise<{ message?: string }> {
  try {
    return (await response.json()) as { message?: string };
  } catch {
    return {};
  }
}
