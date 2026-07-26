import { Breadcrumb, Card, ErrorState } from "@gym-platform/ui";

import { AdminApiError, getAdminAccountState, listUnits } from "../../lib/admin-api";
import { canManageStudents } from "../../lib/navigation";
import { createStudentAction } from "../actions";
import { StudentForm } from "../student-form";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  try {
    const { active } = await getAdminAccountState();
    if (!active || !canManageStudents(active)) {
      return (
        <main className="content">
          <ErrorState
            title="Cadastro não autorizado"
            description="Seu acesso atual permite consultar alunos, mas não gerenciar cadastros."
          />
        </main>
      );
    }
    const units = await listUnits(active);

    return (
      <main className="content content-narrow">
        <Breadcrumb items={[{ label: "Alunos", href: "/students" }, { label: "Novo aluno" }]} />
        <div className="page-heading">
          <div>
            <span className="eyebrow">Cadastro</span>
            <h1>Novo aluno</h1>
          </div>
        </div>

        <Card className="form-surface">
          <StudentForm
            action={createStudentAction}
            organizationType={active.organization.type}
            submitLabel="Cadastrar aluno"
            units={units}
          />
        </Card>
      </main>
    );
  } catch (error) {
    const message =
      error instanceof AdminApiError || error instanceof Error
        ? error.message
        : "Nao foi possivel carregar as unidades.";

    return (
      <main className="content">
        <ErrorState title="Cadastro indisponível" description={message} />
      </main>
    );
  }
}
