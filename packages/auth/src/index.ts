export type AuthenticatedActor = {
  userId: string;
  email?: string;
  name?: string;
};

export type AuthHeaders = Record<string, string | string[] | undefined>;

export interface AuthAdapter {
  resolveActor(headers: AuthHeaders): Promise<AuthenticatedActor | null>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TemporaryHeaderAuthAdapter implements AuthAdapter {
  async resolveActor(headers: AuthHeaders): Promise<AuthenticatedActor | null> {
    const header = headers["x-dev-user-id"];
    const userId = Array.isArray(header) ? header[0] : header;

    if (!userId || !uuidPattern.test(userId)) {
      return null;
    }

    return {
      userId
    };
  }
}

export * from "./supabase.js";
