-- AlterTable
ALTER TABLE "clinics"
ADD COLUMN "specialty" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "brandPrimaryColor" TEXT NOT NULL DEFAULT '#0F172A',
ADD COLUMN "brandAccentColor" TEXT NOT NULL DEFAULT '#0F766E';
