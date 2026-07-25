import type {
  ActiveAccountContext,
  CurrentAccountContext,
  ListStudentsInput,
  OnboardingAvailability,
  OrganizationOnboardingPayload,
  OrganizationOnboardingView,
  PaginatedStudents,
  Student,
  StudentAuditEvent,
  StudentDashboardSummary,
  StudentDetailsPayload,
  StudentPayload,
  UnitSummary
} from "@gym-platform/contracts";

import { readActiveContextSelection, resolveActiveAccountContext } from "./active-context";
import {
  readAdminAuthAdapter,
  requireSupabasePublicConfig,
  type AdminAuthAdapter
} from "./admin-auth";
import { createClient } from "./supabase/server";

type AdminTransportConfig = {
  authAdapter: AdminAuthAdapter;
  apiBaseUrl: string;
  devUserId?: string;
};

type AdminRequestOptions = {
  activeContext?: ActiveAccountContext;
  includeUnitContext?: boolean;
};

export type AdminAccountState = {
  context: CurrentAccountContext;
  active: ActiveAccountContext | null;
};

export type OnboardingStep =
  "businessType" | "company" | "unit" | "responsible" | "operation" | "plan";

export type OnboardingStepPayload = {
  businessType: NonNullable<OrganizationOnboardingPayload["businessType"]>;
  company: NonNullable<OrganizationOnboardingPayload["company"]>;
  unit: NonNullable<OrganizationOnboardingPayload["unit"]>;
  responsible: NonNullable<OrganizationOnboardingPayload["responsible"]>;
  operation: NonNullable<OrganizationOnboardingPayload["operation"]>;
  plan: NonNullable<OrganizationOnboardingPayload["plan"]>;
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number
  ) {
    super(message);
  }
}

export async function getCurrentAccountContext(): Promise<CurrentAccountContext> {
  return apiRequest<CurrentAccountContext>("/me/context");
}

export async function getOnboardingAvailability(): Promise<OnboardingAvailability> {
  return apiRequest<OnboardingAvailability>("/onboarding/current");
}

export async function startOnboarding(): Promise<OrganizationOnboardingView> {
  return apiRequest<OrganizationOnboardingView>("/onboarding/start", { method: "POST" });
}

export async function saveOnboardingStep<TStep extends OnboardingStep>(
  step: TStep,
  version: number,
  payload: OnboardingStepPayload[TStep]
): Promise<OrganizationOnboardingView> {
  const path = step === "businessType" ? "business-type" : step;
  return apiRequest<OrganizationOnboardingView>("/onboarding/current/steps/" + path, {
    method: "PATCH",
    body: JSON.stringify({ version, ...payload })
  });
}

export async function completeOnboarding(version: number): Promise<OrganizationOnboardingView> {
  return apiRequest<OrganizationOnboardingView>("/onboarding/current/complete", {
    method: "POST",
    body: JSON.stringify({ version, confirmAccuracy: true })
  });
}

export async function cancelOnboarding(
  version: number,
  reason?: string
): Promise<OrganizationOnboardingView> {
  return apiRequest<OrganizationOnboardingView>("/onboarding/current/cancel", {
    method: "POST",
    body: JSON.stringify({ version, ...(reason ? { reason } : {}) })
  });
}

export async function getAdminAccountState(): Promise<AdminAccountState> {
  const [context, selection] = await Promise.all([
    getCurrentAccountContext(),
    readActiveContextSelection()
  ]);

  return {
    context,
    active: resolveActiveAccountContext(context, selection)
  };
}

export async function listStudents(
  input: ListStudentsInput,
  activeContext?: ActiveAccountContext
): Promise<PaginatedStudents> {
  const active = activeContext ?? (await requireActiveContext());
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return apiRequest<PaginatedStudents>(
    `/organizations/${active.organization.id}/students${query ? `?${query}` : ""}`,
    {},
    {
      activeContext: active,
      includeUnitContext: !active.organization.isGlobalMember
    }
  );
}

export async function getStudentDashboardSummary(
  activeContext?: ActiveAccountContext
): Promise<StudentDashboardSummary> {
  const active = activeContext ?? (await requireActiveContext());

  return apiRequest<StudentDashboardSummary>(
    `/organizations/${active.organization.id}/students/summary`,
    {},
    { activeContext: active }
  );
}

export async function getStudent(
  studentId: string,
  activeContext?: ActiveAccountContext
): Promise<Student> {
  const active = activeContext ?? (await requireActiveContext());

  return apiRequest<Student>(
    `/organizations/${active.organization.id}/students/${studentId}`,
    {},
    {
      activeContext: active,
      includeUnitContext: !active.organization.isGlobalMember
    }
  );
}

export async function getStudentHistory(
  studentId: string,
  activeContext?: ActiveAccountContext
): Promise<StudentAuditEvent[]> {
  const active = activeContext ?? (await requireActiveContext());

  return apiRequest<StudentAuditEvent[]>(
    `/organizations/${active.organization.id}/students/${studentId}/history`,
    {},
    {
      activeContext: active,
      includeUnitContext: !active.organization.isGlobalMember
    }
  );
}

export async function listUnits(activeContext?: ActiveAccountContext): Promise<UnitSummary[]> {
  const active = activeContext ?? (await requireActiveContext());

  return active.organization.units.map(({ id, name, code }) => ({ id, name, code }));
}

export async function createStudent(payload: StudentPayload): Promise<Student> {
  const active = await requireActiveContext();

  return apiRequest<Student>(
    `/organizations/${active.organization.id}/students`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { activeContext: active, includeUnitContext: false }
  );
}

export async function updateStudent(
  studentId: string,
  payload: StudentDetailsPayload
): Promise<Student> {
  const active = await requireActiveContext();

  return apiRequest<Student>(
    `/organizations/${active.organization.id}/students/${studentId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    { activeContext: active, includeUnitContext: false }
  );
}

export async function inactivateStudent(studentId: string): Promise<Student> {
  return executeStudentLifecycle(studentId, "inactivate");
}

export async function reactivateStudent(studentId: string): Promise<Student> {
  return executeStudentLifecycle(studentId, "reactivate");
}

export async function replaceStudentUnits(studentId: string, unitIds: string[]): Promise<Student> {
  const active = await requireActiveContext();

  return apiRequest<Student>(
    `/organizations/${active.organization.id}/students/${studentId}/units`,
    {
      method: "PUT",
      body: JSON.stringify({ unitIds })
    },
    { activeContext: active, includeUnitContext: false }
  );
}

async function executeStudentLifecycle(
  studentId: string,
  action: "inactivate" | "reactivate"
): Promise<Student> {
  const active = await requireActiveContext();

  return apiRequest<Student>(
    `/organizations/${active.organization.id}/students/${studentId}/${action}`,
    { method: "POST" },
    { activeContext: active, includeUnitContext: false }
  );
}

async function requireActiveContext(): Promise<ActiveAccountContext> {
  const { active } = await getAdminAccountState();

  if (!active) {
    throw new AdminApiError("Sua conta nao possui acesso ativo a uma organizacao.", 403);
  }

  return active;
}

function readAdminTransportConfig(): AdminTransportConfig {
  const authAdapter = readAdminAuthAdapter();

  if (authAdapter === "supabase-jwt") {
    requireSupabasePublicConfig();
  }

  const devUserId = process.env.ADMIN_DEV_USER_ID?.trim();
  if (authAdapter === "temporary-header" && !devUserId) {
    throw new AdminApiError("Configure ADMIN_DEV_USER_ID apenas no ambiente local.");
  }

  return {
    authAdapter,
    apiBaseUrl: process.env.ADMIN_API_BASE_URL ?? "http://localhost:3333",
    ...(devUserId ? { devUserId } : {})
  };
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: AdminRequestOptions = {}
): Promise<T> {
  const config = readAdminTransportConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(await readAuthHeaders(config)),
      ...(options.activeContext?.unit && options.includeUnitContext !== false
        ? { "x-unit-id": options.activeContext.unit.id }
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

async function readAuthHeaders(config: AdminTransportConfig): Promise<Record<string, string>> {
  if (config.authAdapter === "temporary-header") {
    return { "x-dev-user-id": config.devUserId! };
  }

  const {
    data: { session }
  } = await (await createClient()).auth.getSession();

  if (!session?.access_token) {
    throw new AdminApiError("Sua sessao expirou. Entre novamente para continuar.", 401);
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
