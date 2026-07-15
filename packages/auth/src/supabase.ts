import { createRemoteJWKSet, jwtVerify } from "jose";

import { AuthAdapter, AuthenticatedActor, AuthHeaders } from "./index.js";

export class SupabaseJwtAuthAdapter implements AuthAdapter {
  private JWKS: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly supabaseJwksUrl: string
  ) {
    this.JWKS = createRemoteJWKSet(new URL(this.supabaseJwksUrl));
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
        audience: "authenticated"
      });

      if (!payload.sub) {
        return null;
      }

      return {
        userId: payload.sub
      };
    } catch (error) {
      return null;
    }
  }
}
