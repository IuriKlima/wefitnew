"use server";

import type { OrganizationOnboardingView } from "@gym-platform/contracts";
import { revalidatePath } from "next/cache";

import { writeActiveContextSelection } from "../lib/active-context";
import {
  AdminApiError,
  cancelOnboarding,
  completeOnboarding,
  saveOnboardingStep,
  startOnboarding,
  type OnboardingStep,
  type OnboardingStepPayload
} from "../lib/admin-api";

export type OnboardingActionResult =
  | { ok: true; onboarding: OrganizationOnboardingView }
  | { ok: false; message: string; statusCode?: number };

export async function startOnboardingAction(): Promise<OnboardingActionResult> {
  return runOnboardingAction(() => startOnboarding());
}

export async function saveOnboardingStepAction<TStep extends OnboardingStep>(
  step: TStep,
  version: number,
  payload: OnboardingStepPayload[TStep]
): Promise<OnboardingActionResult> {
  return runOnboardingAction(() => saveOnboardingStep(step, version, payload));
}

export async function completeOnboardingAction(version: number): Promise<OnboardingActionResult> {
  const result = await runOnboardingAction(() => completeOnboarding(version));
  if (result.ok) {
    await writeActiveContextSelection(result.onboarding.organizationId);
    revalidatePath("/", "layout");
  }
  return result;
}

export async function cancelOnboardingAction(
  version: number,
  reason?: string
): Promise<OnboardingActionResult> {
  return runOnboardingAction(() => cancelOnboarding(version, reason));
}

async function runOnboardingAction(
  action: () => Promise<OrganizationOnboardingView>
): Promise<OnboardingActionResult> {
  try {
    return { ok: true, onboarding: await action() };
  } catch (error) {
    if (error instanceof AdminApiError) {
      return {
        ok: false,
        message: error.message,
        ...(error.statusCode ? { statusCode: error.statusCode } : {})
      };
    }

    return {
      ok: false,
      message: "Nao foi possivel salvar agora. Tente novamente em alguns instantes."
    };
  }
}
