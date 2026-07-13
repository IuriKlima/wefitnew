import Link from "next/link";

import type { UnitSummary } from "@gym-platform/contracts";

import { AdminApiError, listUnits } from "../../lib/admin-api";
import { createStudentAction } from "../actions";
import { UnitSelector } from "../unit-selector";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  try {
    const units = await listUnits();

    return (
      <main className="content content-narrow">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Cadastro</span>
            <h1>Novo aluno</h1>
          </div>
          <Link className="button" href="/students">
            Voltar
          </Link>
        </div>

        <section className="form-surface">
          <StudentForm action={createStudentAction} submitLabel="Cadastrar aluno" units={units} />
        </section>
      </main>
    );
  } catch (error) {
    const message =
      error instanceof AdminApiError || error instanceof Error
        ? error.message
        : "Nao foi possivel carregar as unidades.";

    return (
      <main className="content">
        <section className="empty-state">
          <h1>Cadastro indisponivel</h1>
          <p>{message}</p>
        </section>
      </main>
    );
  }
}

function StudentForm({
  action,
  submitLabel,
  units
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  units: UnitSummary[];
}) {
  return (
    <form className="student-form" action={action}>
      <div className="form-grid">
        <label>
          <span>Nome</span>
          <input name="name" required maxLength={160} />
        </label>
        <label>
          <span>Nome social</span>
          <input name="socialName" maxLength={160} />
        </label>
        <label>
          <span>E-mail</span>
          <input name="email" type="email" maxLength={254} />
        </label>
        <label>
          <span>Telefone</span>
          <input name="phone" maxLength={40} />
        </label>
        <label>
          <span>Nascimento</span>
          <input name="birthDate" type="date" />
        </label>
        <label>
          <span>Status</span>
          <select name="status" defaultValue="ACTIVE">
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </label>
        <label className="span-2">
          <span>Observacao operacional</span>
          <textarea name="operationalNote" maxLength={500} rows={4} />
        </label>
        <UnitSelector units={units} />
      </div>
      <div className="form-actions">
        <button className="button button-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
