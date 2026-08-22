import type { PrismaClient } from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";

export async function getClinicBranding(db: PrismaClient, ctx: AuthContext) {
  return db.clinic.findFirst({
    where: { id: ctx.clinicId },
    select: {
      name: true,
      specialty: true,
      logoUrl: true,
      website: true,
      brandPrimaryColor: true,
      brandAccentColor: true,
    },
  });
}
