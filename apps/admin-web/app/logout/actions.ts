"use server";

import { redirect } from "next/navigation";

import { readAdminAuthAdapter } from "../lib/admin-auth";
import { createClient } from "../lib/supabase/server";

export async function logoutAction(): Promise<void> {
  if (readAdminAuthAdapter() !== "supabase-jwt") {
    redirect("/students");
  }

  const { error } = await (await createClient()).auth.signOut();

  if (error) {
    throw new Error("Não foi possível encerrar a sessão.");
  }

  redirect("/login");
}
