"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "../lib/supabase/client";

type LoginFormProps = { nextPath: string };

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || typeof password !== "string") {
      setError("Informe e-mail e senha.");
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      setError("Não foi possível entrar. Verifique suas credenciais.");
      setIsSubmitting(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        <span>E-mail</span>
        <input name="email" type="email" autoComplete="email" required disabled={isSubmitting} />
      </label>
      <label>
        <span>Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
