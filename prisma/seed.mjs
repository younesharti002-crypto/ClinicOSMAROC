import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const seedPassword = process.env.SEED_PASSWORD;

if (!seedPassword || seedPassword.length < 12) {
  throw new Error("SEED_PASSWORD must be set and contain at least 12 characters");
}

const passwordHash = await bcrypt.hash(seedPassword, 12);

async function upsertUser({ clinicId, email, fullName, role }) {
  return prisma.user.upsert({
    where: { email },
    update: {
      clinicId,
      fullName,
      role,
      isActive: true,
      passwordHash,
    },
    create: {
      clinicId,
      email,
      fullName,
      role,
      passwordHash,
    },
  });
}

async function main() {
  const clinicA = await prisma.clinic.upsert({
    where: { slug: "clinic-a" },
    update: {},
    create: {
      name: "ClinicOS Demo Casablanca",
      slug: "clinic-a",
      phone: "+212600000001",
      address: "Casablanca",
      city: "Casablanca",
      timezone: "Africa/Casablanca",
    },
  });

  const clinicB = await prisma.clinic.upsert({
    where: { slug: "clinic-b" },
    update: {},
    create: {
      name: "ClinicOS Isolation Test Rabat",
      slug: "clinic-b",
      phone: "+212600000002",
      address: "Rabat",
      city: "Rabat",
      timezone: "Africa/Casablanca",
    },
  });

  await Promise.all([
    upsertUser({
      clinicId: clinicA.id,
      email: "admin@clinic-a.local",
      fullName: "Doctor Admin A",
      role: Role.DOCTOR_ADMIN,
    }),
    upsertUser({
      clinicId: clinicA.id,
      email: "doctor@clinic-a.local",
      fullName: "Doctor A",
      role: Role.DOCTOR,
    }),
    upsertUser({
      clinicId: clinicA.id,
      email: "secretary@clinic-a.local",
      fullName: "Secretary A",
      role: Role.SECRETARY,
    }),
    upsertUser({
      clinicId: clinicB.id,
      email: "admin@clinic-b.local",
      fullName: "Doctor Admin B",
      role: Role.DOCTOR_ADMIN,
    }),
  ]);

  console.log("ClinicOS seed completed for Clinic A and Clinic B.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
