"use client";

import type {
  OnboardingOpeningHours,
  OnboardingPlanCode,
  OnboardingWeekday,
  OrganizationOnboardingPayload,
  OrganizationOnboardingView
} from "@gym-platform/contracts";
import { onboardingPlans } from "@gym-platform/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { OnboardingStep, OnboardingStepPayload } from "../lib/admin-api";
import { logoutAction } from "../logout/actions";
import {
  cancelOnboardingAction,
  completeOnboardingAction,
  saveOnboardingStepAction,
  startOnboardingAction
} from "./actions";

export const wizardSteps = [
  "Seu negocio",
  "Dados da empresa",
  "Unidade principal",
  "Responsavel",
  "Operacao",
  "Plano Wefit",
  "Revisao"
] as const;

const weekdays: Array<{ code: OnboardingWeekday; label: string }> = [
  { code: "MONDAY", label: "Segunda-feira" },
  { code: "TUESDAY", label: "Terca-feira" },
  { code: "WEDNESDAY", label: "Quarta-feira" },
  { code: "THURSDAY", label: "Quinta-feira" },
  { code: "FRIDAY", label: "Sexta-feira" },
  { code: "SATURDAY", label: "Sabado" },
  { code: "SUNDAY", label: "Domingo" }
];

type OnboardingWizardProps = {
  initialOnboarding: OrganizationOnboardingView | null;
  selfServiceEnabled: boolean;
};

export function OnboardingWizard({ initialOnboarding, selfServiceEnabled }: OnboardingWizardProps) {
  const router = useRouter();
  const [onboarding, setOnboarding] = useState(initialOnboarding);
  const [visibleStep, setVisibleStep] = useState(
    Math.min(initialOnboarding?.currentStep ?? 1, wizardSteps.length)
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function showActionFailure(result: { message: string; statusCode?: number }) {
    if (result.statusCode === 401) {
      router.replace("/login?next=/onboarding");
      return;
    }
    setError(result.message);
  }

  if (!onboarding) {
    return (
      <section className="onboarding-start" aria-labelledby="onboarding-start-title">
        <span className="eyebrow">Configuracao guiada</span>
        <h1 id="onboarding-start-title">Prepare sua academia para operar</h1>
        <p>
          Em sete etapas curtas, vamos configurar o negocio, a primeira unidade e a operacao
          inicial. Voce pode interromper e continuar depois.
        </p>
        {!selfServiceEnabled ? (
          <div className="availability-notice" role="status">
            <strong>O cadastro de novas organizacoes esta fechado.</strong>
            <p>Solicite um convite ao responsavel pelo Wefit.</p>
          </div>
        ) : (
          <button
            className="button button-primary"
            type="button"
            disabled={isPending}
            onClick={async () => {
              setIsPending(true);
              setError(null);
              const result = await startOnboardingAction();
              setIsPending(false);
              if (!result.ok) {
                showActionFailure(result);
                return;
              }
              setOnboarding(result.onboarding);
              setVisibleStep(result.onboarding.currentStep);
            }}
          >
            {isPending ? "Preparando ambiente..." : "Iniciar configuracao"}
          </button>
        )}
        {error ? <ActionError message={error} /> : null}
      </section>
    );
  }

  if (onboarding.status === "CANCELED") {
    return (
      <section className="onboarding-start" aria-labelledby="onboarding-canceled-title">
        <span className="eyebrow">Configuracao encerrada</span>
        <h1 id="onboarding-canceled-title">Este onboarding foi cancelado</h1>
        <p>
          A organizacao provisoria permanece isolada e nao pode acessar os modulos operacionais.
          Entre em contato com o suporte para revisar a conta.
        </p>
      </section>
    );
  }

  async function saveStep<TStep extends OnboardingStep>(
    step: TStep,
    payload: OnboardingStepPayload[TStep]
  ) {
    if (!onboarding) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await saveOnboardingStepAction(step, onboarding.version, payload);
    setIsPending(false);
    if (!result.ok) {
      showActionFailure(result);
      return;
    }
    setOnboarding(result.onboarding);
    setVisibleStep(Math.min(result.onboarding.currentStep, wizardSteps.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finishOnboarding() {
    if (!onboarding) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await completeOnboardingAction(onboarding.version);
    setIsPending(false);
    if (!result.ok) {
      showActionFailure(result);
      return;
    }
    setOnboarding(result.onboarding);
    router.replace("/?welcome=1");
    router.refresh();
  }

  async function cancel() {
    if (!onboarding || !window.confirm("Deseja realmente cancelar esta configuracao?")) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await cancelOnboardingAction(
      onboarding.version,
      "Cancelado pelo responsavel durante o fluxo web."
    );
    setIsPending(false);
    if (!result.ok) {
      showActionFailure(result);
      return;
    }
    setOnboarding(result.onboarding);
  }

  const payload = onboarding.payload;

  return (
    <div className="onboarding-layout">
      <aside className="onboarding-progress" aria-label="Progresso da configuracao">
        <span className="brand">Wefit</span>
        <p>Configuracao inicial</p>
        <ol>
          {wizardSteps.map((label, index) => {
            const stepNumber = index + 1;
            const isDone = stepNumber < onboarding.currentStep;
            const isCurrent = stepNumber === visibleStep;
            return (
              <li
                className={isCurrent ? "is-current" : isDone ? "is-done" : undefined}
                key={label}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={stepNumber > onboarding.currentStep ? `${label}, etapa futura` : label}
              >
                <span>{isDone ? "OK" : stepNumber}</span>
                {label}
              </li>
            );
          })}
        </ol>
        <div className="onboarding-secondary-actions">
          <form action={logoutAction}>
            <button className="button button-ghost" type="submit" disabled={isPending}>
              Continuar depois
            </button>
          </form>
          <button
            className="button button-ghost"
            type="button"
            onClick={cancel}
            disabled={isPending}
          >
            Cancelar configuracao
          </button>
        </div>
      </aside>

      <section className="onboarding-content">
        <header className="onboarding-heading">
          <span className="eyebrow">
            Etapa {visibleStep} de {wizardSteps.length}
          </span>
          <p>As alteracoes sao salvas ao avancar.</p>
        </header>

        {error ? <ActionError message={error} /> : null}

        <div key={onboarding.version} className="onboarding-card">
          {visibleStep === 1 ? (
            <BusinessTypeStep
              value={payload.businessType}
              disabled={isPending}
              onSave={(value) => saveStep("businessType", value)}
            />
          ) : null}
          {visibleStep === 2 ? (
            <CompanyStep
              businessType={payload.businessType?.type ?? "GYM"}
              value={payload.company}
              disabled={isPending}
              onBack={() => setVisibleStep(1)}
              onSave={(value) => saveStep("company", value)}
            />
          ) : null}
          {visibleStep === 3 ? (
            <UnitStep
              businessType={payload.businessType?.type ?? "GYM"}
              value={payload.unit}
              disabled={isPending}
              onBack={() => setVisibleStep(2)}
              onSave={(value) => saveStep("unit", value)}
            />
          ) : null}
          {visibleStep === 4 ? (
            <ResponsibleStep
              authenticatedUser={onboarding.authenticatedUser}
              value={payload.responsible}
              disabled={isPending}
              onBack={() => setVisibleStep(3)}
              onSave={(value) => saveStep("responsible", value)}
            />
          ) : null}
          {visibleStep === 5 ? (
            <OperationStep
              value={payload.operation}
              disabled={isPending}
              onBack={() => setVisibleStep(4)}
              onSave={(value) => saveStep("operation", value)}
            />
          ) : null}
          {visibleStep === 6 ? (
            <PlanStep
              businessType={payload.businessType?.type ?? "GYM"}
              value={payload.plan}
              disabled={isPending}
              onBack={() => setVisibleStep(5)}
              onSave={(value) => saveStep("plan", value)}
            />
          ) : null}
          {visibleStep === 7 ? (
            <ReviewStep
              payload={payload}
              disabled={isPending}
              onBack={() => setVisibleStep(6)}
              onSave={finishOnboarding}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function BusinessTypeStep({
  value,
  disabled,
  onSave
}: StepProps<NonNullable<OrganizationOnboardingPayload["businessType"]>>) {
  return (
    <StepForm
      title="Qual e o seu negocio?"
      description="A escolha adapta a configuracao inicial e os recursos apresentados."
      disabled={disabled}
      onSubmit={(form) =>
        onSave({
          type: readRequired(form, "type") as "PERSONAL" | "GYM" | "NETWORK"
        })
      }
    >
      <div className="business-type-grid">
        {[
          {
            code: "PERSONAL",
            name: "Personal",
            description: "Para o profissional independente.",
            modules: "Clientes, acompanhamento e operacao essencial"
          },
          {
            code: "GYM",
            name: "Academia",
            description: "Para uma academia com uma unidade.",
            modules: "Alunos, equipe, permissoes e unidade"
          },
          {
            code: "NETWORK",
            name: "Rede",
            description: "Para gestao centralizada de varias unidades.",
            modules: "Visao central, escopos e expansao de unidades"
          }
        ].map((option) => (
          <label className="business-type-card" key={option.code}>
            <input
              name="type"
              type="radio"
              value={option.code}
              defaultChecked={(value?.type ?? "GYM") === option.code}
              disabled={disabled}
              required
            />
            <strong>{option.name}</strong>
            <span>{option.description}</span>
            <small>{option.modules}</small>
          </label>
        ))}
      </div>
    </StepForm>
  );
}

function CompanyStep({
  businessType,
  value,
  disabled,
  onBack,
  onSave
}: StepProps<NonNullable<OrganizationOnboardingPayload["company"]>> & {
  businessType: "PERSONAL" | "GYM" | "NETWORK";
}) {
  const isPersonal = businessType === "PERSONAL";
  return (
    <StepForm
      title={isPersonal ? "Dados profissionais" : "Dados da empresa"}
      description="Esses dados identificam a organizacao dentro da plataforma."
      disabled={disabled}
      onBack={onBack}
      onSubmit={(form) =>
        onSave({
          legalName: readRequired(form, "legalName"),
          ...(readOptional(form, "tradeName")
            ? { tradeName: readRequired(form, "tradeName") }
            : {}),
          ...(readOptional(form, "cnpj") ? { cnpj: readRequired(form, "cnpj") } : {}),
          businessEmail: readRequired(form, "businessEmail"),
          businessPhone: readRequired(form, "businessPhone"),
          timezone: readRequired(form, "timezone")
        })
      }
    >
      <div className="form-grid">
        <label>
          <span>{isPersonal ? "Nome profissional" : "Razao social"}</span>
          <input
            name="legalName"
            required
            defaultValue={value?.legalName ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>{isPersonal ? "Nome de exibicao" : "Nome fantasia"}</span>
          <input name="tradeName" defaultValue={value?.tradeName ?? ""} disabled={disabled} />
        </label>
        {!isPersonal ? (
          <label className="span-2">
            <span>CNPJ</span>
            <input
              name="cnpj"
              inputMode="numeric"
              required
              defaultValue={value?.cnpj ?? ""}
              disabled={disabled}
            />
            <small>Use somente dados da empresa. A mascara e removida antes de salvar.</small>
          </label>
        ) : null}
        <label>
          <span>E-mail do negocio</span>
          <input
            name="businessEmail"
            type="email"
            required
            defaultValue={value?.businessEmail ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Telefone do negocio</span>
          <input
            name="businessPhone"
            type="tel"
            required
            defaultValue={value?.businessPhone ?? ""}
            disabled={disabled}
          />
        </label>
        <label className="span-2">
          <span>Fuso horario</span>
          <select
            name="timezone"
            defaultValue={value?.timezone ?? "America/Sao_Paulo"}
            disabled={disabled}
          >
            <option value="America/Sao_Paulo">Brasilia</option>
            <option value="America/Manaus">Manaus</option>
            <option value="America/Cuiaba">Cuiaba</option>
            <option value="America/Rio_Branco">Rio Branco</option>
            <option value="America/Noronha">Fernando de Noronha</option>
          </select>
        </label>
      </div>
    </StepForm>
  );
}

function UnitStep({
  businessType,
  value,
  disabled,
  onBack,
  onSave
}: StepProps<NonNullable<OrganizationOnboardingPayload["unit"]>> & {
  businessType: "PERSONAL" | "GYM" | "NETWORK";
}) {
  return (
    <StepForm
      title="Configure a primeira unidade"
      description="Cadastre o endereco e o contato usados na operacao principal."
      disabled={disabled}
      onBack={onBack}
      onSubmit={(form) =>
        onSave({
          name: readRequired(form, "name"),
          code: readRequired(form, "code"),
          phone: readRequired(form, "phone"),
          postalCode: readRequired(form, "postalCode"),
          street: readRequired(form, "street"),
          streetNumber: readRequired(form, "streetNumber"),
          ...(readOptional(form, "addressExtra")
            ? { addressExtra: readRequired(form, "addressExtra") }
            : {}),
          neighborhood: readRequired(form, "neighborhood"),
          city: readRequired(form, "city"),
          state: readRequired(form, "state"),
          country: "BR",
          timezone: readRequired(form, "timezone")
        })
      }
    >
      <div className="form-grid">
        <label>
          <span>Nome da unidade</span>
          <input
            name="name"
            required
            defaultValue={value?.name ?? "Unidade principal"}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Codigo da unidade</span>
          <input name="code" required defaultValue={value?.code ?? "MAIN"} disabled={disabled} />
        </label>
        <label>
          <span>Telefone</span>
          <input
            name="phone"
            type="tel"
            required
            defaultValue={value?.phone ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>CEP</span>
          <input
            name="postalCode"
            inputMode="numeric"
            required
            defaultValue={value?.postalCode ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Logradouro</span>
          <input name="street" required defaultValue={value?.street ?? ""} disabled={disabled} />
        </label>
        <label>
          <span>Numero</span>
          <input
            name="streetNumber"
            required
            defaultValue={value?.streetNumber ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Complemento</span>
          <input name="addressExtra" defaultValue={value?.addressExtra ?? ""} disabled={disabled} />
        </label>
        <label>
          <span>Bairro</span>
          <input
            name="neighborhood"
            required
            defaultValue={value?.neighborhood ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Cidade</span>
          <input name="city" required defaultValue={value?.city ?? ""} disabled={disabled} />
        </label>
        <label>
          <span>UF</span>
          <input
            name="state"
            required
            minLength={2}
            maxLength={2}
            defaultValue={value?.state ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Fuso horario</span>
          <select
            name="timezone"
            defaultValue={value?.timezone ?? "America/Sao_Paulo"}
            disabled={disabled}
          >
            <option value="America/Sao_Paulo">Brasilia</option>
            <option value="America/Manaus">Manaus</option>
            <option value="America/Cuiaba">Cuiaba</option>
            <option value="America/Rio_Branco">Rio Branco</option>
            <option value="America/Noronha">Fernando de Noronha</option>
          </select>
        </label>
      </div>
      {businessType === "NETWORK" ? (
        <p className="inline-notice">
          Outras unidades poderao ser adicionadas depois da configuracao inicial.
        </p>
      ) : null}
      <p className="muted">Os dias e horarios desta unidade serao definidos na etapa Operacao.</p>
    </StepForm>
  );
}

function ResponsibleStep({
  authenticatedUser,
  value,
  disabled,
  onBack,
  onSave
}: StepProps<NonNullable<OrganizationOnboardingPayload["responsible"]>> & {
  authenticatedUser: OrganizationOnboardingView["authenticatedUser"];
}) {
  return (
    <StepForm
      title="Identifique o responsavel"
      description="Este contato sera a referencia administrativa da organizacao."
      disabled={disabled}
      onBack={onBack}
      onSubmit={(form) =>
        onSave({
          name: readRequired(form, "name"),
          email: authenticatedUser.email,
          phone: readRequired(form, "phone"),
          ...(readOptional(form, "title") ? { title: readRequired(form, "title") } : {})
        })
      }
    >
      <div className="form-grid">
        <label>
          <span>Nome completo</span>
          <input
            name="name"
            required
            defaultValue={value?.name ?? authenticatedUser.name ?? ""}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Papel inicial</span>
          <input value="Proprietario" readOnly disabled />
        </label>
        <label>
          <span>E-mail autenticado</span>
          <input
            name="email"
            type="email"
            value={authenticatedUser.email}
            readOnly
            aria-readonly="true"
            disabled={disabled}
          />
        </label>
        <label>
          <span>Telefone</span>
          <input
            name="phone"
            type="tel"
            required
            defaultValue={value?.phone ?? ""}
            disabled={disabled}
          />
        </label>
        <label className="span-2">
          <span>Funcao na operacao (opcional)</span>
          <input name="title" defaultValue={value?.title ?? ""} disabled={disabled} />
        </label>
      </div>
    </StepForm>
  );
}

function OperationStep({
  value,
  disabled,
  onBack,
  onSave
}: StepProps<NonNullable<OrganizationOnboardingPayload["operation"]>>) {
  const openingHours = value?.openingHours ?? createDefaultOpeningHours();
  return (
    <StepForm
      title="Defina o funcionamento"
      description="Informe um periodo principal por dia. Horarios podem ser refinados depois."
      disabled={disabled}
      onBack={onBack}
      onSubmit={(form) =>
        onSave({
          modalities: form.getAll("modalities") as NonNullable<
            OrganizationOnboardingPayload["operation"]
          >["modalities"],
          openingHours: buildOpeningHours(form),
          preference: readRequired(form, "preference") as NonNullable<
            OrganizationOnboardingPayload["operation"]
          >["preference"]
        })
      }
    >
      <fieldset className="option-fieldset">
        <legend>Modalidades iniciais</legend>
        <div className="modality-grid">
          {[
            ["STRENGTH", "Musculacao"],
            ["FUNCTIONAL", "Funcional"],
            ["CROSS_TRAINING", "Cross training"],
            ["PILATES", "Pilates"],
            ["DANCE", "Danca"],
            ["SWIMMING", "Natacao"],
            ["OTHER", "Outros"]
          ].map(([code, label], index) => (
            <label className="checkbox-label option-check" key={code}>
              <input
                name="modalities"
                type="checkbox"
                value={code}
                defaultChecked={
                  value?.modalities.includes(
                    code as NonNullable<
                      OrganizationOnboardingPayload["operation"]
                    >["modalities"][number]
                  ) ?? index === 0
                }
                disabled={disabled}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span>Preferencia inicial da operacao</span>
        <select name="preference" defaultValue={value?.preference ?? "MIXED"} disabled={disabled}>
          <option value="OPEN_GYM">Uso livre da academia</option>
          <option value="CLASSES">Aulas e turmas</option>
          <option value="MIXED">Operacao mista</option>
        </select>
      </label>
      <h2>Dias e horarios da unidade</h2>
      <div className="hours-list">
        {weekdays.map(({ code, label }) => {
          const current = openingHours.days.find(({ day }) => day === code);
          return (
            <fieldset className="hours-row" key={code}>
              <legend>{label}</legend>
              <label className="checkbox-label">
                <input
                  name={"enabled-" + code}
                  type="checkbox"
                  defaultChecked={current?.enabled ?? false}
                  disabled={disabled}
                />
                <span>Aberto</span>
              </label>
              <label>
                <span>Abre</span>
                <input
                  name={"opensAt-" + code}
                  type="time"
                  defaultValue={current?.periods[0]?.opensAt ?? "08:00"}
                  disabled={disabled}
                />
              </label>
              <label>
                <span>Fecha</span>
                <input
                  name={"closesAt-" + code}
                  type="time"
                  defaultValue={current?.periods[0]?.closesAt ?? "22:00"}
                  disabled={disabled}
                />
              </label>
            </fieldset>
          );
        })}
      </div>
    </StepForm>
  );
}

function PlanStep({
  businessType,
  value,
  disabled,
  onBack,
  onSave
}: StepProps<NonNullable<OrganizationOnboardingPayload["plan"]>> & {
  businessType: "PERSONAL" | "GYM" | "NETWORK";
}) {
  return (
    <StepForm
      title="Escolha a configuracao inicial"
      description="A selecao ajusta apenas a experiencia do MVP. Nenhuma cobranca sera realizada."
      disabled={disabled}
      onBack={onBack}
      onSubmit={(form) =>
        onSave({ selectedPlanCode: readRequired(form, "selectedPlanCode") as OnboardingPlanCode })
      }
    >
      <div className="plan-grid">
        {onboardingPlans.map((plan) => (
          <label className="plan-card" key={plan.code}>
            <input
              name="selectedPlanCode"
              type="radio"
              value={plan.code}
              defaultChecked={(value?.selectedPlanCode ?? businessType) === plan.code}
              disabled={disabled}
              required
            />
            <strong>{plan.name}</strong>
            <span>{plan.description}</span>
            <small>{plan.features.join(" · ")}</small>
          </label>
        ))}
      </div>
      <p className="inline-notice">
        Sem cartao, cobranca ou contratacao nesta etapa. A escolha sera confirmada comercialmente.
      </p>
    </StepForm>
  );
}

function ReviewStep({
  payload,
  disabled,
  onBack,
  onSave
}: {
  payload: OrganizationOnboardingPayload;
  disabled: boolean;
  onBack: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <StepForm
      title="Revise os dados principais"
      description="Volte uma etapa se precisar corrigir algo antes da confirmacao."
      disabled={disabled}
      onBack={onBack}
      onSubmit={() => onSave()}
      submitLabel="Concluir configuracao"
    >
      <OnboardingSummary payload={payload} />
      <label className="checkbox-label confirmation-check">
        <input name="confirmAccuracy" type="checkbox" required disabled={disabled} />
        <span>Confirmo que os dados informados estao corretos.</span>
      </label>
    </StepForm>
  );
}

function OnboardingSummary({ payload }: { payload: OrganizationOnboardingPayload }) {
  return (
    <dl className="onboarding-summary">
      {createOnboardingSummary(payload).map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function createOnboardingSummary(payload: OrganizationOnboardingPayload) {
  return [
    { label: "Tipo de negocio", value: payload.businessType?.type ?? "Nao informado" },
    {
      label: "Empresa",
      value: payload.company?.tradeName || payload.company?.legalName || "Nao informada"
    },
    {
      label: "Unidade",
      value: payload.unit
        ? payload.unit.name +
          " (" +
          payload.unit.code +
          ") - " +
          payload.unit.city +
          "/" +
          payload.unit.state
        : "Nao informada"
    },
    { label: "Responsavel", value: payload.responsible?.name ?? "Nao informado" },
    {
      label: "Modalidades",
      value: payload.operation?.modalities.join(", ") ?? "Nao informadas"
    },
    {
      label: "Plano de configuracao",
      value: payload.plan?.selectedPlanCode ?? "Nao selecionado"
    }
  ];
}

type StepProps<TValue> = {
  value?: TValue | undefined;
  disabled: boolean;
  onBack?: (() => void) | undefined;
  onSave: (value: TValue) => void | Promise<void>;
};

function StepForm({
  title,
  description,
  children,
  disabled,
  onBack,
  onSubmit,
  submitLabel = "Salvar e continuar"
}: {
  title: string;
  description: string;
  children: ReactNode;
  disabled: boolean;
  onBack?: (() => void) | undefined;
  onSubmit: (form: FormData) => void | Promise<void>;
  submitLabel?: string;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }

  return (
    <form className="step-content" onSubmit={submit}>
      <div className="step-heading">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
      <div className="form-actions split-actions">
        {onBack ? (
          <button className="button" type="button" onClick={onBack} disabled={disabled}>
            Voltar
          </button>
        ) : (
          <span />
        )}
        <button className="button button-primary" type="submit" disabled={disabled}>
          {disabled ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function ActionError({ message }: { message: string }) {
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    errorRef.current?.focus();
  }, []);

  return (
    <div className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
      <strong>Nao foi possivel continuar.</strong>
      <p>{message}</p>
    </div>
  );
}

function readRequired(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readOptional(form: FormData, name: string): string | undefined {
  return readRequired(form, name) || undefined;
}

export function createDefaultOpeningHours(): OnboardingOpeningHours {
  return {
    version: 1,
    days: weekdays.map(({ code }) => ({
      day: code,
      enabled: code !== "SUNDAY",
      periods:
        code === "SUNDAY"
          ? []
          : [
              {
                opensAt: code === "SATURDAY" ? "09:00" : "08:00",
                closesAt: code === "SATURDAY" ? "18:00" : "22:00"
              }
            ]
    }))
  };
}

export function buildOpeningHours(form: FormData): OnboardingOpeningHours {
  return {
    version: 1,
    days: weekdays.map(({ code }) => {
      const enabled = form.get("enabled-" + code) === "on";
      return {
        day: code,
        enabled,
        periods: enabled
          ? [
              {
                opensAt: readRequired(form, "opensAt-" + code),
                closesAt: readRequired(form, "closesAt-" + code)
              }
            ]
          : []
      };
    })
  };
}
