"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { clearSession, createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { authenticateCredentials } from "@/server/services/authentication";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(200),
});

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Identifiants invalides." };
  }

  const user = await authenticateCredentials(
    prisma,
    parsed.data.email,
    parsed.data.password,
  );

  if (!user) {
    return { error: "Identifiants invalides." };
  }

  await createSession({
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
