import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authenticateCredentials } from "@/server/services/authentication";

const db = new PrismaClient();

async function resetDatabase() {
  await db.whatsAppEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.cashClosing.deleteMany();
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.prescription.deleteMany();
  await db.consultation.deleteMany();
  await db.appointment.deleteMany();
  await db.patient.deleteMany();
  await db.user.deleteMany();
  await db.clinic.deleteMany();
}

describe("M8 authentication hardening", () => {
  beforeAll(async () => {
    await db.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("authenticates only an active user with the correct password", async () => {
    const clinic = await db.clinic.create({
      data: {
        name: "M8 Auth Clinic",
        slug: "m8-auth-clinic",
        phone: "+212600000091",
        address: "Casablanca",
      },
    });
    const password = "StrongPassword123!";
    const passwordHash = await bcrypt.hash(password, 10);

    const active = await db.user.create({
      data: {
        clinicId: clinic.id,
        email: "active@m8-auth.test",
        passwordHash,
        fullName: "Active Admin",
        role: Role.DOCTOR_ADMIN,
        isActive: true,
      },
    });
    await db.user.create({
      data: {
        clinicId: clinic.id,
        email: "disabled@m8-auth.test",
        passwordHash,
        fullName: "Disabled User",
        role: Role.SECRETARY,
        isActive: false,
      },
    });

    await expect(
      authenticateCredentials(db, active.email, password),
    ).resolves.toEqual({
      id: active.id,
      clinicId: clinic.id,
      role: Role.DOCTOR_ADMIN,
    });

    await expect(
      authenticateCredentials(db, active.email, "WrongPassword123!"),
    ).resolves.toBeNull();

    await expect(
      authenticateCredentials(db, "disabled@m8-auth.test", password),
    ).resolves.toBeNull();

    await expect(
      authenticateCredentials(db, "missing@m8-auth.test", password),
    ).resolves.toBeNull();
  });
});
