import { createRemoteJWKSet, jwtVerify } from "jose";

import { AuthAdapter, AuthenticatedActor, AuthHeaders } from "./index.js";

export class SupabaseJwtAuthAdapter implements AuthAdapter {
  private JWKS: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(
    private readonly supabaseJwksUrl: string,
    supabaseUrl: string
  ) {
    this.JWKS = createRemoteJWKSet(new URL(this.supabaseJwksUrl));
    this.issuer = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  }

  async resolveActor(headers: AuthHeaders): Promise<AuthenticatedActor | null> {
    const authHeader = headers["authorization"] ?? headers["Authorization"];
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!headerValue || !headerValue.toLowerCase().startsWith("bearer ")) {
      return null;
    }

    const token = headerValue.substring(7).trim();

    try {
      // Typically Supabase issues tokens with the project URL as issuer, and audience is 'authenticated'
      const { payload } = await jwtVerify(token, this.JWKS, {
        audience: "authenticated",
        issuer: this.issuer
      });

      if (!payload.sub || !uuidPattern.test(payload.sub)) {
        return null;
      }

      const email = readEmailClaim(payload.email);
      if (payload.email !== undefined && !email) {
        return null;
      }

      const name = readNameClaim(payload.user_metadata);

      return {
        userId: payload.sub,
        ...(email ? { email } : {}),
        ...(name ? { name } : {})
      };
    } catch {
      return null;
    }
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmailClaim(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const email = value.trim().toLowerCase();
  return email.length <= 320 && emailPattern.test(email) ? email : undefined;
}

function readNameClaim(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const metadata = value as Record<string, unknown>;
  const candidate = metadata.full_name ?? metadata.name;
  if (typeof candidate !== "string") {
    return undefined;
  }

  const name = candidate.trim();
  return name.length > 0 && name.length <= 120 ? name : undefined;
}
