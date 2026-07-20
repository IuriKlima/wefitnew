import { redirect } from "next/navigation";

import { getOnboardingAvailability } from "../lib/admin-api";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const availability = await getOnboardingAvailability();
  const onboarding = availability.onboarding;

  if (onboarding?.status === "COMPLETED" || onboarding?.organization.lifecycle === "ACTIVE") {
    redirect("/");
  }

  if (onboarding?.organization.lifecycle === "SUSPENDED") {
    redirect("/suspended");
  }

  return (
    <main className="onboarding-page">
      <OnboardingWizard
        initialOnboarding={onboarding}
        selfServiceEnabled={availability.selfServiceEnabled}
      />
    </main>
  );
}
