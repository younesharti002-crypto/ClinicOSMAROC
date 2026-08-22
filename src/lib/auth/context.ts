import "server-only";

import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { assertCan, type Capability } from "@/lib/auth/permissions";
import { readSession } from "@/lib/auth/session";

export type AuthContext = {
  userId: string;
  clinicId: string;
  role: Role;
  fullName: string;
};

export async function getCurrentUser(): Promise<AuthContext | null> {
  const session = await readSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      clinicId: session.clinicId,
      isActive: true,
    },
    select: {
      id: true,
      clinicId: true,
      role: true,
      fullName: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    fullName: user.fullName,
  };
}

export async function requireUser(): Promise<AuthContext> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireCapability(capability: Capability): Promise<AuthContext> {
  const user = await requireUser();
  assertCan(user.role, capability);
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AuthContext> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }

  return user;
}
