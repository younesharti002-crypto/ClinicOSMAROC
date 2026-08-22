import bcrypt from "bcryptjs";
import {
  AppointmentStatus,
  AppointmentType,
  InsuranceType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();

const confirm = process.env.DEMO_CONFIRM;
const adminEmail = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
const reset = process.env.DEMO_RESET === "YES";

if (confirm !== "CREATE_SYNTHETIC_DEMO") {
  throw new Error("DEMO_CONFIRM must equal CREATE_SYNTHETIC_DEMO");
}
if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  throw new Error("DEMO_ADMIN_EMAIL must be a valid email");
}
if (!adminPassword || adminPassword.length < 12) {
  throw new Error("DEMO_ADMIN_PASSWORD must contain at least 12 characters");
}

const slug = "atlas-sante-demo";
const now = new Date();
const at = (dayOffset, hour, minute = 0) => {
  const value = new Date(now);
  value.setHours(hour, minute, 0, 0);
  value.setDate(value.getDate() + dayOffset);
  return value;
};
const dateOnly = (dayOffset) => {
  const value = at(dayOffset, 0, 0);
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
};

async function main() {
  const existing = await prisma.clinic.findUnique({ where: { slug }, select: { id: true } });
  if (existing && !reset) {
    throw new Error("Demo clinic already exists. Set DEMO_RESET=YES only if you intentionally want to recreate this synthetic tenant.");
  }
  if (existing && reset) {
    await prisma.clinic.delete({ where: { id: existing.id } });
  }

  const emailExists = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
  if (emailExists) {
    throw new Error("DEMO_ADMIN_EMAIL is already used by another account");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
      data: {
        name: "Cabinet Atlas Santé",
        slug,
        specialty: "Médecine générale",
        phone: "+212522000900",
        email: "contact@atlas-sante.example",
        website: "https://atlas-sante.example",
        address: "Maarif, Casablanca",
        city: "Casablanca",
        inpeNumber: "DEMO-INPE-001",
        brandPrimaryColor: "#123B5D",
        brandAccentColor: "#18A999",
        timezone: "Africa/Casablanca",
        whatsappEnabled: false,
      },
    });

    const admin = await tx.user.create({
      data: {
        clinicId: clinic.id,
        email: adminEmail,
        passwordHash,
        fullName: "Dr Admin DEMO",
        role: Role.DOCTOR_ADMIN,
        phone: "+212600009001",
        inpeNumber: "DEMO-ADMIN-001",
      },
    });
    const doctor = await tx.user.create({
      data: {
        clinicId: clinic.id,
        email: "doctor.atlas.demo@example.invalid",
        passwordHash,
        fullName: "Dr Médecin DEMO",
        role: Role.DOCTOR,
        phone: "+212600009002",
        inpeNumber: "DEMO-DOC-002",
      },
    });
    const secretary = await tx.user.create({
      data: {
        clinicId: clinic.id,
        email: "secretary.atlas.demo@example.invalid",
        passwordHash,
        fullName: "Secrétaire DEMO",
        role: Role.SECRETARY,
        phone: "+212600009003",
      },
    });

    const patientRows = [
      ["Amal", "DEMO", "+212600009101", InsuranceType.AMO_CNSS],
      ["Youssef", "DEMO", "+212600009102", InsuranceType.AMO_CNOPS],
      ["Sara", "DEMO", "+212600009103", InsuranceType.PRIVATE_MUTUELLE],
      ["Omar", "DEMO", "+212600009104", InsuranceType.NONE],
      ["Meryem", "DEMO", "+212600009105", InsuranceType.AMO_CNSS],
      ["Anas", "DEMO", "+212600009106", InsuranceType.NONE],
      ["Lina", "DEMO", "+212600009107", InsuranceType.PRIVATE_MUTUELLE],
    ];

    const patients = [];
    for (let index = 0; index < patientRows.length; index += 1) {
      const [firstName, lastName, phone, insuranceType] = patientRows[index];
      patients.push(
        await tx.patient.create({
          data: {
            clinicId: clinic.id,
            firstName,
            lastName,
            phone,
            cin: `DEMO${String(index + 1).padStart(4, "0")}`,
            address: "Casablanca — donnée synthétique",
            insuranceType,
            immatriculationNo: insuranceType === InsuranceType.NONE ? null : `DEMO-IMM-${index + 1}`,
            affiliationNo: insuranceType === InsuranceType.NONE ? null : `DEMO-AFF-${index + 1}`,
          },
        }),
      );
    }

    const completedSpecs = [
      { patient: patients[0], amount: "300.00", method: PaymentMethod.CASH, hour: 9 },
      { patient: patients[1], amount: "250.00", method: PaymentMethod.CARD, hour: 10 },
      { patient: patients[2], amount: "350.00", method: PaymentMethod.VIREMENT, hour: 11 },
    ];

    for (const spec of completedSpecs) {
      const appointment = await tx.appointment.create({
        data: {
          clinicId: clinic.id,
          patientId: spec.patient.id,
          doctorId: doctor.id,
          scheduledAt: at(-1, spec.hour),
          durationMinutes: 20,
          type: AppointmentType.BOOKED,
          status: AppointmentStatus.COMPLETED,
        },
      });
      const consultation = await tx.consultation.create({
        data: {
          clinicId: clinic.id,
          appointmentId: appointment.id,
          patientId: spec.patient.id,
          doctorId: doctor.id,
          symptoms: "Donnée clinique synthétique pour démonstration",
          diagnosis: "Exemple de dossier DEMO — aucune donnée réelle",
          clinicalNotes: "Contenu fictif destiné uniquement à la démonstration commerciale.",
          createdAt: at(-1, spec.hour),
        },
      });
      await tx.prescription.create({
        data: {
          clinicId: clinic.id,
          consultationId: consultation.id,
          medicationName: "Traitement DEMO",
          dosage: "Exemple",
          duration: "Démonstration",
          instructions: "Donnée fictive — ne constitue pas une prescription médicale.",
        },
      });
      const invoice = await tx.invoice.create({
        data: {
          clinicId: clinic.id,
          patientId: spec.patient.id,
          consultationId: consultation.id,
          totalAmount: spec.amount,
          status: InvoiceStatus.PAID,
          feuilleDeSoinsGenerated: true,
          createdAt: at(-1, spec.hour),
        },
      });
      await tx.payment.create({
        data: {
          clinicId: clinic.id,
          invoiceId: invoice.id,
          receivedById: secretary.id,
          amount: spec.amount,
          method: spec.method,
          status: PaymentStatus.FINALIZED,
          paidAt: at(-1, spec.hour, 20),
          createdAt: at(-1, spec.hour, 20),
        },
      });
    }

    await tx.appointment.createMany({
      data: [
        {
          clinicId: clinic.id,
          patientId: patients[3].id,
          doctorId: doctor.id,
          scheduledAt: at(0, 9, 20),
          durationMinutes: 20,
          type: AppointmentType.BOOKED,
          status: AppointmentStatus.WAITING_ROOM,
          queueNumber: 1,
        },
        {
          clinicId: clinic.id,
          patientId: patients[4].id,
          doctorId: doctor.id,
          scheduledAt: at(0, 10, 0),
          durationMinutes: 20,
          type: AppointmentType.BOOKED,
          status: AppointmentStatus.CONFIRMED,
        },
        {
          clinicId: clinic.id,
          patientId: patients[5].id,
          doctorId: doctor.id,
          scheduledAt: at(0, 10, 20),
          durationMinutes: 20,
          type: AppointmentType.WALK_IN,
          status: AppointmentStatus.WAITING_ROOM,
          queueNumber: 2,
        },
        {
          clinicId: clinic.id,
          patientId: patients[6].id,
          doctorId: doctor.id,
          scheduledAt: at(1, 9, 0),
          durationMinutes: 20,
          type: AppointmentType.BOOKED,
          status: AppointmentStatus.SCHEDULED,
        },
      ],
    });

    await tx.cashClosing.create({
      data: {
        clinicId: clinic.id,
        closedById: admin.id,
        businessDate: dateOnly(-1),
        theoreticalCash: "300.00",
        theoreticalCard: "250.00",
        theoreticalCheque: "0.00",
        theoreticalTransfer: "350.00",
        actualCash: "300.00",
        actualCard: "250.00",
        actualCheque: "0.00",
        actualTransfer: "350.00",
        totalTheoretical: "900.00",
        totalActual: "900.00",
        variance: "0.00",
        notes: "Clôture synthétique DEMO",
        isLocked: true,
      },
    });

    await tx.auditLog.create({
      data: {
        clinicId: clinic.id,
        actorUserId: admin.id,
        action: "SYNTHETIC_DEMO_CREATED",
        entityType: "Clinic",
        entityId: clinic.id,
        metadata: { synthetic: true, preset: "atlas-sante-demo" },
      },
    });
  });

  console.log(JSON.stringify({ ok: true, slug, adminEmail, synthetic: true }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Demo seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
