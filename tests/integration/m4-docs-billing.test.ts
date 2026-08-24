import {
  AppointmentType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/auth/context";
import { ForbiddenError } from "@/lib/auth/permissions";
import { clinicDateKey } from "@/lib/time/clinic-time";
import { createAppointment } from "@/server/repositories/appointments";
import {
  createInvoiceForConsultation,
  getBillingSnapshot,
  getFeuilleDeSoins,
  markFeuilleDeSoinsGenerated,
  recordPayment,
} from "@/server/repositories/billing";
import { getCashDay } from "@/server/repositories/cash";
import {
  finishConsultation,
  startConsultation,
} from "@/server/repositories/consultations";
import {
  addPrescriptionLine,
  getPrescriptionWorkspace,
  removePrescriptionLine,
  updatePrescriptionLine,
} from "@/server/repositories/prescriptions";

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
  const clinicA = await db.clinic.create({
    data: {
      name: "M4 Clinic A",
      slug: "m4-clinic-a",
      phone: "+212600000021",
      address: "Casablanca",
      inpeNumber: "INPE-A",
    },
  });
  const clinicB = await db.clinic.create({
    data: {
      name: "M4 Clinic B",
      slug: "m4-clinic-b",
      phone: "+212600000022",
      address: "Rabat",
    },
  });

  const [secretary, doctorA, doctorB] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "secretary@m4.test",
        passwordHash: "test",
        fullName: "Secretary M4",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "doctor-a@m4.test",
        passwordHash: "test",
        fullName: "Doctor A M4",
        role: Role.DOCTOR,
        inpeNumber: "DOC-A-INPE",
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicB.id,
        email: "doctor-b@m4.test",
        passwordHash: "test",
        fullName: "Doctor B M4",
        role: Role.DOCTOR,
      },
    }),
  ]);

  const [patientA, patientB] = await Promise.all([
    db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "Patient",
        lastName: "M4 A",
        phone: "+212611111131",
        cin: "AB12345",
        immatriculationNo: "IMM-A",
        affiliationNo: "AFF-A",
      },
    }),
    db.patient.create({
      data: {
        clinicId: clinicB.id,
        firstName: "Patient",
        lastName: "M4 B",
        phone: "+212611111132",
      },
    }),
  ]);

  const secretaryCtx: AuthContext = {
    userId: secretary.id,
    clinicId: clinicA.id,
    role: Role.SECRETARY,
    fullName: secretary.fullName,
  };
  const doctorCtx: AuthContext = {
    userId: doctorA.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR,
    fullName: doctorA.fullName,
  };
  const doctorBCtx: AuthContext = {
    userId: doctorB.id,
    clinicId: clinicB.id,
    role: Role.DOCTOR,
    fullName: doctorB.fullName,
  };

  return {
    clinicA,
    clinicB,
    secretary,
    doctorA,
    doctorB,
    patientA,
    patientB,
    secretaryCtx,
    doctorCtx,
    doctorBCtx,
  };
}

async function completedConsultation(
  secretaryCtx: AuthContext,
  doctorCtx: AuthContext,
  patientId: string,
  doctorId: string,
) {
  const appointment = await createAppointment(db, secretaryCtx, {
    patientId,
    doctorId,
    scheduledAt: new Date("2026-08-22T15:00:00Z"),
    durationMinutes: 20,
    type: AppointmentType.WALK_IN,
    notes: null,
  });
  const consultation = await startConsultation(db, doctorCtx, appointment.id);
  await finishConsultation(db, doctorCtx, consultation.id, {
    symptoms: "Motif test",
    diagnosis: "Diagnostic secret",
    clinicalNotes: "Clinical note secret",
  });
  return consultation;
}

describe("M4 documents, billing and payments", () => {
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

  it("allows only authorized doctor to add, edit and remove prescription lines", async () => {
    const { secretaryCtx, doctorCtx, doctorBCtx, doctorA, patientA } = await fixture();
    const consultation = await completedConsultation(secretaryCtx, doctorCtx, patientA.id, doctorA.id);

    await expect(
      addPrescriptionLine(db, secretaryCtx, consultation.id, {
        medicationName: "Forbidden",
        dosage: "1/j",
        duration: "3 jours",
        isGeneric: false,
        instructions: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const line = await addPrescriptionLine(db, doctorCtx, consultation.id, {
      medicationName: "Paracétamol",
      dosage: "1 comprimé x 3/j",
      duration: "3 jours",
      isGeneric: true,
      instructions: "Après repas",
    });

    await updatePrescriptionLine(db, doctorCtx, line.id, {
      medicationName: "Paracétamol 500 mg",
      dosage: "1 comprimé matin et soir",
      duration: "5 jours",
      isGeneric: true,
      instructions: "Après les repas",
    });

    const updatedWorkspace = await getPrescriptionWorkspace(db, doctorCtx, consultation.id);
    expect(updatedWorkspace?.prescriptions[0]?.medicationName).toBe("Paracétamol 500 mg");
    expect(updatedWorkspace?.prescriptions[0]?.duration).toBe("5 jours");

    await expect(
      updatePrescriptionLine(db, doctorBCtx, line.id, {
        medicationName: "Cross tenant",
        dosage: "1/j",
        duration: "1 jour",
        isGeneric: false,
        instructions: null,
      }),
    ).rejects.toThrow("Prescription line not found for this doctor and clinic");

    expect(await getPrescriptionWorkspace(db, doctorBCtx, consultation.id)).toBeNull();

    await removePrescriptionLine(db, doctorCtx, line.id);
    expect((await getPrescriptionWorkspace(db, doctorCtx, consultation.id))?.prescriptions).toHaveLength(0);
  });

  it("shows completed consultation as À encaisser without exposing clinical fields", async () => {
    const { secretaryCtx, doctorCtx, doctorA, patientA } = await fixture();
    const consultation = await completedConsultation(secretaryCtx, doctorCtx, patientA.id, doctorA.id);

    const snapshot = await getBillingSnapshot(db, secretaryCtx);
    const candidate = snapshot.toBill.find((item) => item.id === consultation.id);

    expect(candidate).toBeDefined();
    expect(candidate).not.toHaveProperty("diagnosis");
    expect(candidate).not.toHaveProperty("clinicalNotes");
    expect(candidate?.patient).not.toHaveProperty("allergies");
  });

  it("creates invoice, records payment actor, marks invoice paid and includes payment in daily totals", async () => {
    const { clinicA, secretaryCtx, doctorCtx, doctorA, patientA, secretary } = await fixture();
    const consultation = await completedConsultation(secretaryCtx, doctorCtx, patientA.id, doctorA.id);

    const invoice = await createInvoiceForConsultation(
      db,
      secretaryCtx,
      consultation.id,
      new Prisma.Decimal("300.00"),
    );

    const payment = await recordPayment(
      db,
      secretaryCtx,
      invoice.id,
      new Prisma.Decimal("300.00"),
      PaymentMethod.CARD,
    );

    const [storedInvoice, storedPayment] = await Promise.all([
      db.invoice.findUnique({ where: { id: invoice.id } }),
      db.payment.findUnique({ where: { id: payment.id } }),
    ]);

    expect(storedInvoice?.status).toBe(InvoiceStatus.PAID);
    expect(storedPayment?.receivedById).toBe(secretary.id);
    expect(storedPayment?.clinicId).toBe(secretaryCtx.clinicId);

    const dateKey = clinicDateKey(new Date(), clinicA.timezone);
    const cashDay = await getCashDay(db, secretaryCtx, dateKey);
    expect(cashDay.theoretical.card.toFixed(2)).toBe("300.00");
    expect(cashDay.theoretical.total.toFixed(2)).toBe("300.00");
    expect(cashDay.payments.map((item) => item.id)).toContain(payment.id);
  });

  it("rejects overpayment and cross-tenant invoice access", async () => {
    const { secretaryCtx, doctorCtx, doctorBCtx, doctorA, patientA } = await fixture();
    const consultation = await completedConsultation(secretaryCtx, doctorCtx, patientA.id, doctorA.id);
    const invoice = await createInvoiceForConsultation(
      db,
      secretaryCtx,
      consultation.id,
      new Prisma.Decimal("200.00"),
    );

    await expect(
      recordPayment(
        db,
        secretaryCtx,
        invoice.id,
        new Prisma.Decimal("250.00"),
        PaymentMethod.CASH,
      ),
    ).rejects.toThrow("Payment exceeds invoice balance");

    expect(await getFeuilleDeSoins(db, doctorBCtx, invoice.id)).toBeNull();
  });

  it("tracks feuille de soins generation tenant-safely", async () => {
    const { secretaryCtx, doctorCtx, doctorA, patientA } = await fixture();
    const consultation = await completedConsultation(secretaryCtx, doctorCtx, patientA.id, doctorA.id);
    const invoice = await createInvoiceForConsultation(
      db,
      secretaryCtx,
      consultation.id,
      new Prisma.Decimal("350.00"),
    );

    await markFeuilleDeSoinsGenerated(db, secretaryCtx, invoice.id);

    const stored = await db.invoice.findUnique({ where: { id: invoice.id } });
    const document = await getFeuilleDeSoins(db, secretaryCtx, invoice.id);

    expect(stored?.feuilleDeSoinsGenerated).toBe(true);
    expect(document?.patient.cin).toBe("AB12345");
    expect(document?.patient.immatriculationNo).toBe("IMM-A");
    expect(document?.consultation?.doctor.inpeNumber).toBe("DOC-A-INPE");
  });
});
