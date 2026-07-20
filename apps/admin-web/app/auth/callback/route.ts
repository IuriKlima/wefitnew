import { NextResponse, type NextRequest } from "next/server";

import { readSafeNextPath } from "../../lib/admin-auth";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = readSafeNextPath(url.searchParams.get("next") ?? undefined);

  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(nextPath, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?callback=invalid", url.origin));
}
