import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminApiError, getStudent, listUnits } from "../../lib/admin-api";
import { archiveStudentAction, inactivateStudentAction, updateStudentAction } from "../actions";
import { displayStudentName } from "../student-format";
import { UnitSelector } from "../unit-selector";

export const dynamic = "force-dynamic";

type StudentProfilePageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function StudentProfilePage({ params }: StudentProfilePageProps) {
  const { studentId } = await params;

  try {
    const [student, units] = await Promise.all([getStudent(studentId), listUnits()]);
    const updateAction = updateStudentAction.bind(null, student.id);
    const inactivateAction = inactivateStudentAction.bind(null, student.id);
    const archiveConfirmation = `ARQUIVAR ${displayStudentName(student)}`;
    const archiveAction = archiveStudentAction.bind(null, student.id, archiveConfirmation);

    return (
      <main className="content content-narrow">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Perfil</span>
            <h1>{displayStudentName(student)}</h1>
          </div>
          <Link className="button" href="/students">
            Voltar
          </Link>
        </div>

        <section className="profile-summary">
          <div>
            <span>Status</span>
            <strong>{student.status === "ACTIVE" ? "Ativo" : "Inativo"}</strong>
          </div>
          <div>
            <span>Unidades</span>
            <strong>
              {student.units.length > 0
                ? student.units.map((unit) => unit.name).join(", ")
                : "Sem vinculo"}
            </strong>
          </div>
        </section>

        <section className="form-surface">
          <form className="student-form" action={updateAction}>
            <div className="form-grid">
              <label>
                <span>Nome</span>
                <input name="name" required maxLength={160} defaultValue={student.name} />
              </label>
              <label>
                <span>Nome social</span>
                <input name="socialName" maxLength={160} defaultValue={student.socialName ?? ""} />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  defaultValue={student.email ?? ""}
                />
              </label>
              <label>
                <span>Telefone</span>
                <input name="phone" maxLength={40} defaultValue={student.phone ?? ""} />
              </label>
              <label>
                <span>Nascimento</span>
                <input name="birthDate" type="date" defaultValue={student.birthDate ?? ""} />
              </label>
              <label className="span-2">
                <span>Observacao operacional</span>
                <textarea
                  name="operationalNote"
                  maxLength={500}
                  rows={4}
                  defaultValue={student.operationalNote ?? ""}
                />
              </label>
              <UnitSelector units={units} selectedUnitIds={student.units.map((unit) => unit.id)} />
            </div>
            <div className="form-actions">
              <button className="button button-primary" type="submit">
                Salvar alteracoes
              </button>
            </div>
          </form>
        </section>

        <section className="lifecycle-surface">
          <h2>Ciclo de vida</h2>
          <div className="lifecycle-action">
            <div>
              <h3>Inativar aluno</h3>
              <p>
                O cadastro continuará pesquisável no filtro de alunos inativos e poderá ser
                consultado normalmente.
              </p>
            </div>
            <form action={inactivateAction}>
              <button className="button" type="submit" disabled={student.status === "INACTIVE"}>
                {student.status === "INACTIVE" ? "Aluno inativo" : "Inativar aluno"}
              </button>
            </form>
          </div>

          <div className="lifecycle-action lifecycle-danger">
            <div>
              <h3>Arquivar aluno</h3>
              <p>
                O cadastro deixará as listagens e seus vínculos com unidades serão encerrados. Esta
                ação exige acesso organizacional.
              </p>
            </div>
            <form className="archive-form" action={archiveAction}>
              <label>
                <span>
                  Digite <strong>{archiveConfirmation}</strong> para confirmar
                </span>
                <input name="confirmation" required autoComplete="off" />
              </label>
              <button className="button button-danger" type="submit">
                Arquivar aluno
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AdminApiError && error.statusCode === 404) {
      notFound();
    }

    return (
      <main className="content">
        <section className="empty-state">
          <h1>Aluno indisponivel</h1>
          <p>{error instanceof Error ? error.message : "Nao foi possivel carregar o aluno."}</p>
        </section>
      </main>
    );
  }
}
