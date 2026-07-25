import { notFound } from "next/navigation";

import { Breadcrumb, Card, ErrorState } from "@gym-platform/ui";

import { AdminApiError, getAdminAccountState, getStudent } from "../../../lib/admin-api";
import { canManageStudents } from "../../../lib/navigation";
import { updateStudentAction } from "../../actions";
import { displayStudentName } from "../../student-format";
import { StudentForm } from "../../student-form";

export const dynamic = "force-dynamic";

type EditStudentPageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function EditStudentPage({ params }: EditStudentPageProps) {
  const { studentId } = await params;

  try {
    const { active } = await getAdminAccountState();
    if (!active || !canManageStudents(active)) {
      return (
        <main className="content">
          <ErrorState
            title="Edição não autorizada"
            description="Seu acesso atual permite consultar alunos, mas não editar cadastros."
          />
        </main>
      );
    }

    const student = await getStudent(studentId, active);
    const action = updateStudentAction.bind(null, student.id);

    return (
      <main className="content content-narrow">
        <Breadcrumb
          items={[
            { label: "Alunos", href: "/students" },
            { label: displayStudentName(student), href: `/students/${student.id}` },
            { label: "Editar" }
          ]}
        />
        <div className="page-heading">
          <div>
            <span className="eyebrow">Cadastro</span>
            <h1>Editar aluno</h1>
          </div>
        </div>
        <Card className="form-surface">
          <StudentForm action={action} student={student} submitLabel="Salvar alterações" />
        </Card>
      </main>
    );
  } catch (error) {
    if (error instanceof AdminApiError && error.statusCode === 404) {
      notFound();
    }

    return (
      <main className="content">
        <ErrorState
          title="Edição indisponível"
          description={
            error instanceof Error ? error.message : "Não foi possível carregar o aluno."
          }
        />
      </main>
    );
  }
}
