-- AlterTable
ALTER TABLE "clinics"
ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappPhoneNumberId" TEXT,
ADD COLUMN "whatsappReminderTemplate" TEXT,
ADD COLUMN "whatsappLanguageCode" TEXT NOT NULL DEFAULT 'fr';

-- CreateIndex
CREATE UNIQUE INDEX "clinics_whatsappPhoneNumberId_key" ON "clinics"("whatsappPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_events_clinicId_appointmentId_eventType_key"
ON "whatsapp_events"("clinicId", "appointmentId", "eventType");
