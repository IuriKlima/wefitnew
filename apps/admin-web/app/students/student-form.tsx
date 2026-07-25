import Link from "next/link";

import type { AccountOrganizationType, Student, UnitSummary } from "@gym-platform/contracts";
import { Button, FormField, Input, Select } from "@gym-platform/ui";

import { UnitSelector } from "./unit-selector";

type StudentFormProps = {
  action: (formData: FormData) => Promise<void>;
  organizationType?: AccountOrganizationType;
  student?: Student;
  submitLabel: string;
  units?: UnitSummary[];
};

export function StudentForm({
  action,
  organizationType,
  student,
  submitLabel,
  units
}: StudentFormProps) {
  return (
    <form className="student-form" action={action}>
      <div className="form-grid">
        <FormField id="student-name" label="Nome" required>
          <Input
            id="student-name"
            name="name"
            required
            maxLength={160}
            autoComplete="name"
            defaultValue={student?.name}
          />
        </FormField>
        <FormField id="student-social-name" label="Nome social">
          <Input
            id="student-social-name"
            name="socialName"
            maxLength={160}
            defaultValue={student?.socialName ?? ""}
          />
        </FormField>
        <FormField id="student-email" label="E-mail">
          <Input
            id="student-email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            defaultValue={student?.email ?? ""}
          />
        </FormField>
        <FormField id="student-phone" label="Telefone">
          <Input
            id="student-phone"
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            defaultValue={student?.phone ?? ""}
          />
        </FormField>
        <FormField id="student-birth-date" label="Nascimento">
          <Input
            id="student-birth-date"
            name="birthDate"
            type="date"
            max={todayInBrazil()}
            defaultValue={student?.birthDate ?? ""}
          />
        </FormField>
        {!student ? (
          <FormField id="student-status" label="Status">
            <Select id="student-status" name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </Select>
          </FormField>
        ) : null}
        <div className="span-2">
          <FormField
            id="student-operational-note"
            label="Observação operacional"
            hint="Use apenas informações operacionais não sensíveis (até 500 caracteres)."
          >
            <textarea
              id="student-operational-note"
              name="operationalNote"
              maxLength={500}
              rows={4}
              defaultValue={student?.operationalNote ?? ""}
            />
          </FormField>
        </div>
        {units && organizationType ? (
          <UnitSelector
            organizationType={organizationType}
            units={units}
            {...(student ? { selectedUnitIds: student.units.map(({ id }) => id) } : {})}
          />
        ) : null}
      </div>
      <div className="form-actions">
        <Button type="submit" tone="primary">
          {submitLabel}
        </Button>
        <Link className="button" href={student ? `/students/${student.id}` : "/students"}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}
