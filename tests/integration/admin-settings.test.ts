import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/auth/context";
import { ForbiddenError } from "@/lib/auth/permissions";
import {
  createStaff,
  getClinicSettings,
  listStaff,
  setStaffActive,
  updateClinicSettings,
} from "@/server/repositories/admin";
import { getClinicBranding } from "@/server/repositories/branding";

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

async function fixture() {
  const [clinicA, clinicB] = await Promise.all([
    db.clinic.create({
      data: {
        name: "Admin Clinic A",
        slug: "admin-clinic-a",
        phone: "+212522000001",
        address: "Casablanca",
        city: "Casablanca",
        specialty: "Cardiologie",
        brandPrimaryColor: "#123456",
        brandAccentColor: "#ABCDEF",
      },
    }),
    db.clinic.create({
      data: {
        name: "Admin Clinic B",
        slug: "admin-clinic-b",
        phone: "+212537000001",
        address: "Rabat",
        city: "Rabat",
        specialty: "Dermatologie",
        brandPrimaryColor: "#654321",
        brandAccentColor: "#FEDCBA",
      },
    }),
  ]);

  const [adminA, secretaryA, adminB] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "admin-a@admin.test",
        passwordHash: "test",
        fullName: "Admin A",
        role: Role.DOCTOR_ADMIN,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "secretary-a@admin.test",
        passwordHash: "test",
        fullName: "Secretary A",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicB.id,
        email: "admin-b@admin.test",
        passwordHash: "test",
        fullName: "Admin B",
        role: Role.DOCTOR_ADMIN,
      },
    }),
  ]);

  const adminCtx: AuthContext = {
    userId: adminA.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR_ADMIN,
    fullName: adminA.fullName,
  };
  const secretaryCtx: AuthContext = {
    userId: secretaryA.id,
    clinicId: clinicA.id,
    role: Role.SECRETARY,
    fullName: secretaryA.fullName,
  };

  return { clinicA, clinicB, adminA, secretaryA, adminB, adminCtx, secretaryCtx };
}

describe("release admin settings", () => {
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

  it("lists only staff from the authenticated clinic without password hashes", async () => {
    const { adminCtx, adminA, secretaryA, adminB } = await fixture();
    const staff = await listStaff(db, adminCtx);

    expect(staff.map((member) => member.id).sort()).toEqual(
      [adminA.id, secretaryA.id].sort(),
    );
    expect(staff.some((member) => member.id === adminB.id)).toBe(false);
    expect("passwordHash" in staff[0]).toBe(false);
  });

  it("blocks secretary from staff and clinic settings management", async () => {
    const { secretaryCtx } = await fixture();

    await expect(listStaff(db, secretaryCtx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getClinicSettings(db, secretaryCtx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("creates new staff inside the authenticated clinic only", async () => {
    const { clinicA, adminCtx } = await fixture();

    const created = await createStaff(db, adminCtx, {
      email: "doctor-new@admin.test",
      password: "very-secure-password",
      fullName: "Doctor New",
      role: Role.DOCTOR,
      phone: "+212600000099",
      inpeNumber: "INPE-99",
    });

    const stored = await db.user.findUnique({ where: { id: created.id } });
    expect(stored?.clinicId).toBe(clinicA.id);
    expect(stored?.role).toBe(Role.DOCTOR);
    expect(stored?.passwordHash).not.toBe("very-secure-password");
  });

  it("cannot deactivate self or the last active clinic administrator", async () => {
    const { adminCtx, adminA } = await fixture();

    await expect(setStaffActive(db, adminCtx, adminA.id, false)).rejects.toThrow(
      "propre compte",
    );

    const secondAdmin = await db.user.create({
      data: {
        clinicId: adminCtx.clinicId,
        email: "admin-second@admin.test",
        passwordHash: "test",
        fullName: "Second Admin",
        role: Role.DOCTOR_ADMIN,
      },
    });

    await setStaffActive(db, adminCtx, secondAdmin.id, false);
    expect(
      (await db.user.findUnique({ where: { id: secondAdmin.id } }))?.isActive,
    ).toBe(false);
  });

  it("updates only the authenticated clinic settings and records an audit event", async () => {
    const { clinicA, clinicB, adminCtx } = await fixture();

    const updated = await updateClinicSettings(db, adminCtx, {
      name: "Clinic A Updated",
      phone: "+212522123456",
      address: "Maarif, Casablanca",
      city: "Casablanca",
      inpeNumber: "CLINIC-INPE-A",
      specialty: "Cardiologie interventionnelle",
      email: "contact@clinic-a.test",
      website: "https://clinic-a.test/",
      logoUrl: "https://clinic-a.test/logo.png",
      brandPrimaryColor: "#102030",
      brandAccentColor: "#405060",
      timezone: "Africa/Casablanca",
      whatsappEnabled: false,
      whatsappPhoneNumberId: null,
      whatsappReminderTemplate: null,
      whatsappLanguageCode: "fr",
    });

    expect(updated.id).toBe(clinicA.id);
    expect(updated.name).toBe("Clinic A Updated");
    expect(updated.specialty).toBe("Cardiologie interventionnelle");
    expect(updated.brandPrimaryColor).toBe("#102030");

    const untouchedB = await db.clinic.findUnique({ where: { id: clinicB.id } });
    expect(untouchedB?.name).toBe("Admin Clinic B");
    expect(untouchedB?.specialty).toBe("Dermatologie");

    const audit = await db.auditLog.findFirst({
      where: {
        clinicId: clinicA.id,
        action: "CLINIC_SETTINGS_UPDATED",
        entityId: clinicA.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("returns branding only for the authenticated tenant", async () => {
    const { adminCtx } = await fixture();
    const branding = await getClinicBranding(db, adminCtx);

    expect(branding).toEqual(
      expect.objectContaining({
        name: "Admin Clinic A",
        specialty: "Cardiologie",
        brandPrimaryColor: "#123456",
        brandAccentColor: "#ABCDEF",
      }),
    );
    expect(branding?.name).not.toBe("Admin Clinic B");
  });

  it("requires non-secret WhatsApp routing config before enabling reminders", async () => {
    const { adminCtx } = await fixture();

    await expect(
      updateClinicSettings(db, adminCtx, {
        name: "Admin Clinic A",
        phone: "+212522000001",
        address: "Casablanca",
        city: "Casablanca",
        inpeNumber: null,
        specialty: null,
        email: null,
        website: null,
        logoUrl: null,
        brandPrimaryColor: "#0F172A",
        brandAccentColor: "#0F766E",
        timezone: "Africa/Casablanca",
        whatsappEnabled: true,
        whatsappPhoneNumberId: null,
        whatsappReminderTemplate: null,
        whatsappLanguageCode: "fr",
      }),
    ).rejects.toThrow("Phone Number ID");
  });
});
