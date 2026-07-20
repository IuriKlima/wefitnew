import type { AccountOrganizationLifecycle, OnboardingAvailability } from "@gym-platform/contracts";

export type HomeDestination = "dashboard" | "no-access" | "/onboarding" | "/suspended";

export function resolveHomeDestination(
  lifecycle: AccountOrganizationLifecycle | null,
  onboardingAvailability: OnboardingAvailability
): HomeDestination {
  if (lifecycle === "SUSPENDED") {
    return "/suspended";
  }
  if (lifecycle === "ONBOARDING") {
    return "/onboarding";
  }
  if (lifecycle === "ACTIVE") {
    return "dashboard";
  }
  if (
    (onboardingAvailability.onboarding &&
      onboardingAvailability.onboarding.status !== "COMPLETED") ||
    onboardingAvailability.selfServiceEnabled
  ) {
    return "/onboarding";
  }
  return "no-access";
}
