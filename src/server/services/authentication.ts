import "server-only";

import bcrypt from "bcryptjs";
import type { PrismaClient, Role } from "@prisma/client";

const DUMMY_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export type AuthenticatedIdentity = {
  id: string;
  clinicId: string;
  role: Role;
};

export async function authenticateCredentials(
  db: PrismaClient,
  email: string,
  password: string,
): Promise<AuthenticatedIdentity | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      clinicId: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
  });

  const validPassword = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user?.isActive || !validPassword) {
    return null;
  }

  return {
    id: user.id,
    clinicId: user.clinicId,
    role: user.role,
  };
}
