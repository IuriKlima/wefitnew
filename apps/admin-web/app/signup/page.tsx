import { redirect } from "next/navigation";

import {
  readAdminAuthAdapter,
  readAdminSelfServiceEnabled,
  requireSupabasePublicConfig
} from "../lib/admin-auth";
import { createClient } from "../lib/supabase/server";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (readAdminAuthAdapter() !== "supabase-jwt") {
    redirect("/");
  }

  requireSupabasePublicConfig();

  const {
    data: { session }
  } = await (await createClient()).auth.getSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="login-page">
      <section className="login-surface signup-surface" aria-labelledby="signup-title">
        <span className="eyebrow">Comece com seguranca</span>
        <h1 id="signup-title">Crie sua conta Wefit</h1>
        <p>
          Use seus dados profissionais. Depois da confirmacao, vamos orientar a configuracao da
          academia em sete etapas.
        </p>
        <SignupForm enabled={readAdminSelfServiceEnabled()} />
      </section>
    </main>
  );
}
