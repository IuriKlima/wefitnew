import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readAdminAuthAdapter } from "./app/lib/admin-auth";
import { refreshSupabaseSession } from "./app/lib/supabase/middleware";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const publicPaths = [
    "/login",
    "/signup",
    "/auth/callback",
    "/legal/terms",
    "/legal/privacy",
    "/api/health"
  ];
  if (publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (readAdminAuthAdapter() === "temporary-header") {
    return NextResponse.next();
  }

  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
