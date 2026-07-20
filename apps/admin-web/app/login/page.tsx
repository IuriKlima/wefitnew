import Link from "next/link";
import { redirect } from "next/navigation";

import {
  readAdminAuthAdapter,
  readSafeNextPath,
  requireSupabasePublicConfig
} from "../lib/admin-auth";
import { createClient } from "../lib/supabase/server";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (readAdminAuthAdapter() === "temporary-header") {
    redirect("/");
  }

  requireSupabasePublicConfig();
  const {
    data: { user }
  } = await (await createClient()).auth.getUser();

  if (user) {
    redirect("/");
  }

  const nextPath = readSafeNextPath((await searchParams).next);

  return (
    <main className="login-page">
      <section className="login-surface" aria-labelledby="login-title">
        <span className="eyebrow">Administrativo</span>
        <h1 id="login-title">Entrar na plataforma</h1>
        <p>Use as credenciais fornecidas para a sua organizacao.</p>
        <LoginForm nextPath={nextPath} />
        <div className="auth-links">
          <Link href="/signup">Criar uma conta</Link>
          <span aria-hidden="true">/</span>
          <Link href="/legal/privacy">Privacidade</Link>
        </div>
      </section>
    </main>
  );
}
