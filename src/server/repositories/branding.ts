import type { PrismaClient } from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";

const brandingSelect = {
  name: true,
  specialty: true,
  city: true,
  logoUrl: true,
  website: true,
  brandPrimaryColor: true,
  brandAccentColor: true,
} as const;

export async function getClinicBranding(db: PrismaClient, ctx: AuthContext) {
  return db.clinic.findFirst({
    where: { id: ctx.clinicId },
    select: brandingSelect,
  });
}

export async function getPublicLoginBranding(db: PrismaClient) {
  const clinics = await db.clinic.findMany({
    select: brandingSelect,
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  return clinics.length === 1 ? clinics[0] : null;
}
