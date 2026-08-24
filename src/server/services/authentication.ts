import "server-only";

import type { PrismaClient } from "@prisma/client";

import {
  authenticateCredentialsCore,
  type AuthenticatedIdentity,
} from "@/lib/auth/authentication-core";

export type { AuthenticatedIdentity };

export async function authenticateCredentials(
  db: PrismaClient,
  email: string,
  password: string,
): Promise<AuthenticatedIdentity | null> {
  return authenticateCredentialsCore(db, email, password);
}
