import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readAdminAuthAdapter } from "./app/lib/admin-auth";
import { refreshSupabaseSession } from "./app/lib/supabase/middleware";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/api/health") {
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
