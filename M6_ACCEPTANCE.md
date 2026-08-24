# M6 — WhatsApp Reminder & Webhook Acceptance

Gate target: appointment reminder lifecycle works end-to-end without cross-clinic or clinical-data leakage.

- [x] WhatsApp Cloud API client uses environment secrets.
- [x] Per-clinic phone-number-id, template and language configuration.
- [x] 24h reminder window for booked appointments.
- [x] Idempotent reminder claim per clinic/appointment/event type.
- [x] Failed reminder is retryable on a later scheduler run without duplicate events.
- [x] Confirm reply updates SCHEDULED → CONFIRMED once.
- [x] Cancel reply updates SCHEDULED/CONFIRMED → CANCELLED once.
- [x] Webhook routes by clinic WhatsApp phone-number-id.
- [x] Webhook verifies Meta x-hub-signature-256 when configured.
- [x] Provider delivery/read/failed statuses are persisted.
- [x] Inbound sender phone must match the appointment patient.
- [x] Outgoing reminder payload contains no diagnosis, clinical notes or allergies.
- [x] Webhook and reminder flows remain tenant-safe.

Validation required before merge: Prisma generate/validate, committed migrations, seed, lint, typecheck, integration tests, build, Vercel preview.
