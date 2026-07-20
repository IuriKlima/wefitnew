import { redirect } from "next/navigation";

import { getAdminAccountState } from "../lib/admin-api";

export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const { active } = await getAdminAccountState();

  if (active?.organization.lifecycle !== "SUSPENDED") {
    redirect("/");
  }

  return (
    <main className="state-page">
      <section className="state-surface" aria-labelledby="suspended-title">
        <span className="eyebrow">Acesso restrito</span>
        <h1 id="suspended-title">Organizacao suspensa</h1>
        <p>
          Os modulos operacionais estao temporariamente indisponiveis. Fale com o responsavel pela
          conta ou com o suporte Wefit para revisar a situacao.
        </p>
      </section>
    </main>
  );
}
