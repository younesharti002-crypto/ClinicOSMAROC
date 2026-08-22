import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const db = new PrismaClient();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optional(name) {
  const value = process.env[name]?.trim();
  return value || null;
}

function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is invalid");
  }
  return email;
}

function validateSlug(value) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("BOOTSTRAP_CLINIC_SLUG must use lowercase letters, numbers and hyphens");
  }
  return slug;
}

async function main() {
  const clinicName = required("BOOTSTRAP_CLINIC_NAME");
  const clinicSlug = validateSlug(required("BOOTSTRAP_CLINIC_SLUG"));
  const clinicPhone = required("BOOTSTRAP_CLINIC_PHONE");
  const clinicAddress = required("BOOTSTRAP_CLINIC_ADDRESS");
  const clinicCity = process.env.BOOTSTRAP_CLINIC_CITY?.trim() || "Casablanca";
  const clinicInpe = optional("BOOTSTRAP_CLINIC_INPE");

  const adminEmail = normalizeEmail(required("BOOTSTRAP_ADMIN_EMAIL"));
  const adminName = required("BOOTSTRAP_ADMIN_NAME");
  const adminPassword = required("BOOTSTRAP_ADMIN_PASSWORD");
  const adminPhone = optional("BOOTSTRAP_ADMIN_PHONE");
  const adminInpe = optional("BOOTSTRAP_ADMIN_INPE");

  if (adminPassword.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters");
  }

  const [slugExists, emailExists] = await Promise.all([
    db.clinic.findUnique({ where: { slug: clinicSlug }, select: { id: true } }),
    db.user.findUnique({ where: { email: adminEmail }, select: { id: true } }),
  ]);

  if (slugExists) throw new Error("Clinic slug already exists; bootstrap aborted");
  if (emailExists) throw new Error("Admin email already exists; bootstrap aborted");

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const result = await db.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
      data: {
        name: clinicName,
        slug: clinicSlug,
        phone: clinicPhone,
        address: clinicAddress,
        city: clinicCity,
        inpeNumber: clinicInpe,
        timezone: "Africa/Casablanca",
        whatsappEnabled: false,
      },
      select: { id: true, name: true, slug: true },
    });

    const admin = await tx.user.create({
      data: {
        clinicId: clinic.id,
        email: adminEmail,
        passwordHash,
        fullName: adminName,
        role: Role.DOCTOR_ADMIN,
        phone: adminPhone,
        inpeNumber: adminInpe,
        isActive: true,
      },
      select: { id: true, email: true, fullName: true, role: true },
    });

    await tx.auditLog.create({
      data: {
        clinicId: clinic.id,
        actorUserId: admin.id,
        action: "CLINIC_BOOTSTRAPPED",
        entityType: "Clinic",
        entityId: clinic.id,
        metadata: { source: "bootstrap-admin" },
      },
    });

    return { clinic, admin };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        clinic: result.clinic,
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          fullName: result.admin.fullName,
          role: result.admin.role,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
