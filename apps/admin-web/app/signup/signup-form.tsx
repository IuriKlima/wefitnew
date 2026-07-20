"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { createClient } from "../lib/supabase/client";

const genericResponse =
  "Se o cadastro puder ser concluido, enviaremos uma mensagem de confirmacao para o e-mail informado.";

type SignupFormProps = {
  enabled: boolean;
};

type SignupClient = {
  auth: {
    signUp(input: {
      email: string;
      password: string;
      options: { data: { full_name: string }; emailRedirectTo: string };
    }): Promise<unknown>;
  };
};

export function SignupForm({ enabled }: SignupFormProps) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordChecks = useMemo(() => readPasswordChecks(password), [password]);

  if (!enabled) {
    return (
      <div className="availability-notice" role="status">
        <strong>Novos cadastros estao temporariamente indisponiveis.</strong>
        <p>Se voce ja possui acesso, entre com sua conta.</p>
        <Link className="button" href="/login">
          Ir para o login
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const confirmPassword = formData.get("confirmPassword");
    const acceptedTerms = formData.get("acceptedTerms") === "on";

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      typeof email !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      setError("Preencha os dados obrigatorios.");
      return;
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError("A senha ainda nao atende aos requisitos de seguranca.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas informadas nao coincidem.");
      return;
    }

    if (!acceptedTerms) {
      setError("Aceite os termos de uso e a politica de privacidade.");
      return;
    }

    setIsSubmitting(true);

    await requestSignup({
      enabled,
      name: name.trim(),
      email: email.trim(),
      password,
      emailRedirectTo: new URL("/auth/callback", window.location.origin).toString()
    });
    setIsSubmitting(false);
    setMessage(genericResponse);
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        <span>Nome completo</span>
        <input name="name" autoComplete="name" required minLength={2} disabled={isSubmitting} />
      </label>
      <label>
        <span>E-mail profissional</span>
        <input name="email" type="email" autoComplete="email" required disabled={isSubmitting} />
      </label>
      <label>
        <span>Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
        />
      </label>
      <ul className="password-checks" aria-label="Requisitos da senha">
        <PasswordCheck passed={passwordChecks.length} label="12 ou mais caracteres" />
        <PasswordCheck passed={passwordChecks.uppercase} label="Uma letra maiuscula" />
        <PasswordCheck passed={passwordChecks.lowercase} label="Uma letra minuscula" />
        <PasswordCheck passed={passwordChecks.digit} label="Um numero" />
        <PasswordCheck passed={passwordChecks.symbol} label="Um simbolo" />
      </ul>
      <label>
        <span>Confirme a senha</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={isSubmitting}
        />
      </label>
      <label className="checkbox-label">
        <input name="acceptedTerms" type="checkbox" required disabled={isSubmitting} />
        <span>
          Li e aceito os <Link href="/legal/terms">termos de uso</Link> e a{" "}
          <Link href="/legal/privacy">politica de privacidade</Link>.
        </span>
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
      <button className="button button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </button>
      <Link className="text-link" href="/login">
        Ja tem uma conta? Entre
      </Link>
    </form>
  );
}

function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
  return <li className={passed ? "is-valid" : undefined}>{label}</li>;
}

function readPasswordChecks(password: string) {
  return {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password)
  };
}

export { genericResponse, readPasswordChecks };

export async function requestSignup(
  input: {
    enabled: boolean;
    name: string;
    email: string;
    password: string;
    emailRedirectTo: string;
  },
  clientFactory: () => SignupClient = createClient
): Promise<string> {
  if (!input.enabled) {
    return genericResponse;
  }

  try {
    await clientFactory().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.name },
        emailRedirectTo: input.emailRedirectTo
      }
    });
  } catch {
    // A resposta permanece generica para nao expor se uma conta existe.
  }

  return genericResponse;
}
