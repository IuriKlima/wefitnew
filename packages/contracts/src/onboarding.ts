export type OrganizationLifecycle = "ONBOARDING" | "ACTIVE" | "SUSPENDED";
export type OrganizationOnboardingStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELED";
export type OnboardingPlanCode = "PERSONAL" | "GYM" | "NETWORK";
export type OnboardingModality =
  "STRENGTH" | "FUNCTIONAL" | "CROSS_TRAINING" | "PILATES" | "DANCE" | "SWIMMING" | "OTHER";
export type OnboardingOperationPreference = "OPEN_GYM" | "CLASSES" | "MIXED";
export type OnboardingWeekday =
  "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export type OnboardingOpeningHours = {
  version: 1;
  days: Array<{
    day: OnboardingWeekday;
    enabled: boolean;
    periods: Array<{ opensAt: string; closesAt: string }>;
  }>;
};

export type OrganizationOnboardingPayload = {
  schemaVersion: 1;
  businessType?: {
    type: "PERSONAL" | "GYM" | "NETWORK";
  };
  company?: {
    legalName: string;
    tradeName?: string;
    cnpj?: string;
    businessEmail: string;
    businessPhone: string;
    timezone: string;
  };
  unit?: {
    name: string;
    code: string;
    phone: string;
    postalCode: string;
    street: string;
    streetNumber: string;
    addressExtra?: string;
    neighborhood: string;
    city: string;
    state: string;
    country: string;
    timezone: string;
  };
  responsible?: {
    name: string;
    email: string;
    phone: string;
    title?: string;
  };
  operation?: {
    modalities: OnboardingModality[];
    openingHours: OnboardingOpeningHours;
    preference: OnboardingOperationPreference;
  };
  plan?: { selectedPlanCode: OnboardingPlanCode };
  review?: { confirmAccuracy: true };
};

export type OrganizationOnboardingView = {
  id: string;
  organizationId: string;
  status: OrganizationOnboardingStatus;
  currentStep: number;
  selectedPlanCode: OnboardingPlanCode | null;
  payload: OrganizationOnboardingPayload;
  payloadVersion: 1;
  version: number;
  completedAt: string | null;
  authenticatedUser: {
    name: string | null;
    email: string;
  };
  organization: {
    id: string;
    name: string;
    lifecycle: OrganizationLifecycle;
  };
  unit: {
    id: string;
    name: string;
  };
};

export type OnboardingAvailability = {
  selfServiceEnabled: boolean;
  onboarding: OrganizationOnboardingView | null;
};

export const onboardingPlans = [
  {
    code: "PERSONAL",
    name: "Personal",
    description: "Configuracao para o profissional independente e sua operacao principal.",
    features: ["Gestao essencial", "Uma unidade principal", "Acesso do proprietario"]
  },
  {
    code: "GYM",
    name: "Academia",
    description: "Estrutura inicial para uma academia com equipe e uma unidade.",
    features: ["Gestao de alunos", "Equipe e permissoes", "Operacao da unidade"]
  },
  {
    code: "NETWORK",
    name: "Rede",
    description: "Base para gestao centralizada e expansao para multiplas unidades.",
    features: ["Gestao central", "Multiplas unidades", "Permissoes por escopo"]
  }
] as const;
