import { isFeatureEnabled, type ActiveAccountContext } from "@gym-platform/contracts";
import type { IconName, NavigationSection } from "@gym-platform/ui";

export type AdminPlan = "PERSONAL" | "GYM" | "NETWORK";
export type AdminModuleGroup =
  "overview" | "operation" | "commercial" | "training" | "management" | "access" | "administration";
export type AdminModuleState = "available" | "preview" | "locked";
export type AdminModuleScope = "organization" | "unit";
export type AdminModuleId =
  | "dashboard"
  | "students"
  | "team"
  | "units"
  | "crm"
  | "plans"
  | "finance"
  | "schedule"
  | "exercises"
  | "workouts"
  | "assessments"
  | "access-control"
  | "integrations"
  | "settings"
  | "audit";

export type AdminModuleDefinition = {
  id: AdminModuleId;
  label: string;
  description: string;
  route: string;
  icon: IconName;
  group: AdminModuleGroup;
  compatiblePlans: AdminPlan[];
  requiredPermissions: string[];
  entitlement?: string;
  scope: AdminModuleScope;
  baseState: Exclude<AdminModuleState, "locked">;
  requiresSelectedUnit?: boolean;
  primaryAction?: string;
  previewSections?: string[];
};

export type AdminModuleAccess = {
  definition: AdminModuleDefinition;
  visible: boolean;
  state: AdminModuleState;
  reason?: string;
};

const allPlans: AdminPlan[] = ["PERSONAL", "GYM", "NETWORK"];
const businessPlans: AdminPlan[] = ["GYM", "NETWORK"];

export const adminModuleCatalog: AdminModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Visão geral",
    description: "Indicadores reais e atalhos do contexto ativo.",
    route: "/",
    icon: "home",
    group: "overview",
    compatiblePlans: allPlans,
    requiredPermissions: [],
    scope: "organization",
    baseState: "available"
  },
  {
    id: "students",
    label: "Alunos",
    description: "Cadastros, unidades, status e histórico auditável.",
    route: "/students",
    icon: "students",
    group: "operation",
    compatiblePlans: allPlans,
    requiredPermissions: ["student:read"],
    entitlement: "students.manage",
    scope: "organization",
    baseState: "available",
    primaryAction: "Novo aluno"
  },
  {
    id: "team",
    label: "Equipe",
    description: "Pessoas, papéis e escopos de acesso.",
    route: "/team",
    icon: "team",
    group: "management",
    compatiblePlans: businessPlans,
    requiredPermissions: ["membership:manage"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Convidar pessoa",
    previewSections: ["Pessoas e convites", "Papéis por organização", "Acesso por unidade"]
  },
  {
    id: "units",
    label: "Unidades",
    description: "Estrutura física e contexto operacional.",
    route: "/units",
    icon: "building",
    group: "management",
    compatiblePlans: businessPlans,
    requiredPermissions: ["unit:read"],
    entitlement: "units.manage",
    scope: "organization",
    baseState: "preview",
    primaryAction: "Nova unidade",
    previewSections: ["Lista de unidades", "Dados operacionais", "Status da unidade"]
  },
  {
    id: "crm",
    label: "CRM",
    description: "Jornada comercial antes da matrícula.",
    route: "/crm",
    icon: "crm",
    group: "commercial",
    compatiblePlans: businessPlans,
    requiredPermissions: ["student:read"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Novo contato",
    previewSections: [
      "Funil de oportunidades",
      "Responsáveis e próximas ações",
      "Origem dos contatos"
    ]
  },
  {
    id: "plans",
    label: "Planos",
    description: "Catálogo comercial e regras de contratação.",
    route: "/plans",
    icon: "plans",
    group: "commercial",
    compatiblePlans: businessPlans,
    requiredPermissions: ["subscription:read"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Novo plano",
    previewSections: ["Planos ativos", "Benefícios e duração", "Compatibilidade por unidade"]
  },
  {
    id: "finance",
    label: "Financeiro",
    description: "Visão financeira sem números simulados.",
    route: "/finance",
    icon: "finance",
    group: "commercial",
    compatiblePlans: businessPlans,
    requiredPermissions: ["subscription:read"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Registrar cobrança",
    previewSections: ["Recebimentos", "Inadimplência", "Conciliação"]
  },
  {
    id: "schedule",
    label: "Agenda",
    description: "Aulas e atendimentos no escopo da unidade.",
    route: "/schedule",
    icon: "calendar",
    group: "operation",
    compatiblePlans: allPlans,
    requiredPermissions: ["student:read"],
    scope: "unit",
    baseState: "preview",
    requiresSelectedUnit: true,
    primaryAction: "Novo evento",
    previewSections: ["Calendário da unidade", "Profissionais e capacidade", "Lista de presença"]
  },
  {
    id: "exercises",
    label: "Exercícios",
    description: "Biblioteca para prescrição de treinos.",
    route: "/exercises",
    icon: "exercises",
    group: "training",
    compatiblePlans: allPlans,
    requiredPermissions: ["student:read"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Novo exercício",
    previewSections: ["Biblioteca de exercícios", "Grupos musculares", "Orientações técnicas"]
  },
  {
    id: "workouts",
    label: "Treinos",
    description: "Prescrições e acompanhamento por aluno.",
    route: "/workouts",
    icon: "workouts",
    group: "training",
    compatiblePlans: allPlans,
    requiredPermissions: ["student:read"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Novo treino",
    previewSections: ["Modelos de treino", "Prescrições individuais", "Histórico de evolução"]
  },
  {
    id: "assessments",
    label: "Avaliações",
    description: "Avaliações físicas e evolução do aluno.",
    route: "/assessments",
    icon: "assessments",
    group: "training",
    compatiblePlans: allPlans,
    requiredPermissions: ["student:read"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Nova avaliação",
    previewSections: ["Protocolos", "Medidas e resultados", "Evolução por período"]
  },
  {
    id: "access-control",
    label: "Controle de acesso",
    description: "Dispositivos e eventos de entrada por unidade.",
    route: "/access-control",
    icon: "access",
    group: "access",
    compatiblePlans: businessPlans,
    requiredPermissions: ["student:read"],
    entitlement: "access.devices",
    scope: "unit",
    baseState: "preview",
    requiresSelectedUnit: true,
    primaryAction: "Novo dispositivo",
    previewSections: ["Dispositivos da unidade", "Eventos de acesso", "Políticas de entrada"]
  },
  {
    id: "integrations",
    label: "Integrações",
    description: "Conexões externas governadas pela organização.",
    route: "/integrations",
    icon: "integrations",
    group: "administration",
    compatiblePlans: businessPlans,
    requiredPermissions: ["organization:manage"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Nova integração",
    previewSections: ["Catálogo de integrações", "Credenciais protegidas", "Saúde das conexões"]
  },
  {
    id: "settings",
    label: "Configurações",
    description: "Preferências e dados da organização.",
    route: "/settings",
    icon: "settings",
    group: "administration",
    compatiblePlans: allPlans,
    requiredPermissions: ["organization:manage"],
    scope: "organization",
    baseState: "preview",
    primaryAction: "Salvar alterações",
    previewSections: [
      "Dados da organização",
      "Preferências operacionais",
      "Políticas administrativas"
    ]
  },
  {
    id: "audit",
    label: "Auditoria",
    description: "Rastreabilidade das operações sensíveis.",
    route: "/audit",
    icon: "audit",
    group: "administration",
    compatiblePlans: businessPlans,
    requiredPermissions: ["audit:read"],
    scope: "organization",
    baseState: "preview",
    previewSections: [
      "Eventos administrativos",
      "Filtros por ator e recurso",
      "Contexto de organização e unidade"
    ]
  }
];

const groupLabels: Record<AdminModuleGroup, string> = {
  overview: "Visão geral",
  operation: "Operação",
  commercial: "Comercial",
  training: "Treinos e saúde",
  management: "Gestão",
  access: "Acesso",
  administration: "Administração"
};

const groupOrder: AdminModuleGroup[] = [
  "overview",
  "operation",
  "commercial",
  "training",
  "management",
  "access",
  "administration"
];

export function getAdminModule(moduleId: AdminModuleId): AdminModuleDefinition {
  const definition = adminModuleCatalog.find(({ id }) => id === moduleId);

  if (!definition) {
    throw new Error(`Módulo administrativo desconhecido: ${moduleId}`);
  }

  return definition;
}

export function resolveAdminPlan(active: ActiveAccountContext): AdminPlan {
  const subscriptionPlan = active.organization.subscription?.planCode.toUpperCase();

  if (
    subscriptionPlan === "PERSONAL" ||
    subscriptionPlan === "GYM" ||
    subscriptionPlan === "NETWORK"
  ) {
    return subscriptionPlan;
  }

  return active.organization.type;
}

export function resolveAdminModuleAccess(
  definition: AdminModuleDefinition,
  active: ActiveAccountContext
): AdminModuleAccess {
  const plan = resolveAdminPlan(active);

  if (!definition.compatiblePlans.includes(plan)) {
    return {
      definition,
      visible: false,
      state: "locked",
      reason: `O módulo não faz parte do plano ${plan}.`
    };
  }

  if (
    definition.requiredPermissions.length > 0 &&
    !definition.requiredPermissions.every((permission) =>
      hasPermissionInActiveScope(active, permission)
    )
  ) {
    return {
      definition,
      visible: false,
      state: "locked",
      reason: "Seu perfil não possui as permissões exigidas neste contexto."
    };
  }

  if (
    definition.entitlement &&
    active.organization.subscription &&
    !isFeatureEnabled(active.organization.subscription.features, definition.entitlement)
  ) {
    return {
      definition,
      visible: true,
      state: "locked",
      reason: "O recurso não está habilitado na assinatura atual da organização."
    };
  }

  if (definition.requiresSelectedUnit && !active.unit) {
    return {
      definition,
      visible: true,
      state: "locked",
      reason: "Selecione uma unidade permitida para acessar este módulo."
    };
  }

  return {
    definition,
    visible: true,
    state: definition.baseState
  };
}

export function buildModuleNavigation(
  active: ActiveAccountContext,
  pathname: string
): NavigationSection[] {
  return groupOrder
    .map((group) => ({
      id: group,
      label: groupLabels[group],
      items: adminModuleCatalog
        .filter((definition) => definition.group === group)
        .map((definition) => resolveAdminModuleAccess(definition, active))
        .filter(({ visible }) => visible)
        .map(({ definition, state }) => ({
          href: definition.route,
          icon: definition.icon,
          isActive:
            definition.route === "/"
              ? pathname === "/"
              : pathname === definition.route || pathname.startsWith(`${definition.route}/`),
          label: definition.label,
          ...(state === "preview" ? { badge: "Preview", badgeTone: "info" as const } : {}),
          ...(state === "locked" ? { badge: "Bloqueado", badgeTone: "warning" as const } : {})
        }))
    }))
    .filter(({ items }) => items.length > 0);
}

export function hasPermissionInActiveScope(
  active: ActiveAccountContext,
  permission: string
): boolean {
  const organizationPermissions = active.organization.permissions.organization;
  const unitPermissions = active.unit
    ? (active.organization.permissions.units[active.unit.id] ?? [])
    : [];

  return organizationPermissions.includes(permission) || unitPermissions.includes(permission);
}
