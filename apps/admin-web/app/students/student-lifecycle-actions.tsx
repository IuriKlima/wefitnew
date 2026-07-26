"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { StudentStatus } from "@gym-platform/contracts";
import { Button, ConfirmDialog } from "@gym-platform/ui";

type StudentLifecycleActionsProps = {
  inactivateAction: () => Promise<void>;
  reactivateAction: () => Promise<void>;
  status: StudentStatus;
};

export function StudentLifecycleActions({
  inactivateAction,
  reactivateAction,
  status
}: StudentLifecycleActionsProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isActive = status === "ACTIVE";

  const confirm = () => {
    setError(undefined);
    startTransition(async () => {
      try {
        await (isActive ? inactivateAction() : reactivateAction());
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível alterar o status.");
      }
    });
  };

  return (
    <div className="student-lifecycle-controls">
      <Button tone={isActive ? "danger" : "primary"} onClick={() => setOpen(true)}>
        {isActive ? "Inativar aluno" : "Reativar aluno"}
      </Button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        pending={pending}
        tone={isActive ? "danger" : "primary"}
        title={isActive ? "Inativar aluno?" : "Reativar aluno?"}
        description={
          isActive
            ? "O cadastro continuará disponível no filtro de alunos inativos."
            : "O aluno voltará a aparecer como ativo nas consultas operacionais."
        }
        confirmLabel={isActive ? "Confirmar inativação" : "Confirmar reativação"}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      />
    </div>
  );
}
