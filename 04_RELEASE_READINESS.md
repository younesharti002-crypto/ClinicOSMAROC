# ClinicOS Maroc — M8 Release Readiness

This document is the operational release gate for the frozen V1 scope. It does not redesign the product or expand the MVP.

## 1. Application gate

Before a release candidate may be merged to `main`, all of the following must pass on a clean PostgreSQL database:

- Prisma client generation
- Prisma schema validation
- committed migrations via `prisma migrate deploy`
- development seed validation
- ESLint
- TypeScript strict typecheck
- unit tests
- integration tests
- `tests/integration/m8-release-acceptance.test.ts`
- Next.js production build

The M8 acceptance test covers the frozen business journey:

Patient → RDV → confirmation → waiting room → queue → doctor consultation → clinical data → prescription → completed consultation → invoice → feuille de soins marker → payment → cash closing → cash lock → analytics.

It also verifies Clinic A/B isolation and that a secretary cannot receive clinical fields through the clinical repository.

## 2. Security gate

Required invariants:

- authenticated tenant context is reloaded from the database and scoped by active user + `clinicId`
- server-side RBAC remains authoritative
- secretary administrative patient projections exclude clinical fields
- clinical repositories require clinical capabilities
- normal payments are rejected after official daily cash closing
- post-close corrections remain separate audited adjustments
- WhatsApp webhook signature validation is mandatory when the integration is enabled
- WhatsApp inbound routing resolves tenant by the clinic's `phone_number_id`
- no diagnosis or clinical notes are emitted in WhatsApp payloads/events
- session cookie is `httpOnly`, secure in production and scoped to the application
- production responses include anti-framing, MIME-sniffing, browser capability and HSTS protections
- invalid login responses remain generic and use a comparable bcrypt verification path for missing/inactive accounts
- no production secret is committed to the repository

## 3. Production environment — required now

The core application requires these deployment secrets/config values:

- `DATABASE_URL`
- `SESSION_SECRET` (minimum 32 characters; use a strong random value)

For the database:

1. use a ClinicOS-only PostgreSQL/Neon database
2. back up before production migration changes
3. run `npm run prisma:migrate:deploy`
4. do not use `prisma db push` as the production release mechanism
5. verify `GET /api/health` returns HTTP 200 after deployment

## 4. WhatsApp — intentionally final per-clinic configuration

The generic ClinicOS code may be released without enabling live WhatsApp for a clinic.

At the final installation/configuration step for each clinic, configure:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_VERSION`
- `CRON_SECRET`
- clinic `whatsappPhoneNumberId`
- approved reminder template name + language
- production scheduler calling the protected reminders endpoint

Until these values are configured and the clinic WhatsApp flag is enabled, live WhatsApp delivery is considered disabled, not broken.

## 5. Release smoke test

After deployment and before onboarding real patient data:

1. open `/api/health`
2. log in as a seeded/test admin on a non-production test tenant or dedicated staging environment
3. verify reception and patient search
4. create a test RDV and move it to waiting room
5. verify doctor workspace and consultation start/finish
6. create prescription, invoice and payment
7. close the cash day and verify another normal payment for that day is rejected
8. verify analytics totals
9. verify Clinic B cannot retrieve Clinic A patient IDs
10. verify Secretary cannot retrieve diagnosis/clinical notes

Delete all smoke-test patient data before real use if the test was performed in the production database.

## 6. Rollback rule

- Application rollback: revert/redeploy the previous known-good application commit.
- Database rollback: do not improvise destructive Prisma resets in production. Use a reviewed forward-fix migration or a tested restore plan.
- Cash closing: never silently reopen or mutate an official close.
- Clinical records: never repair a release by deleting production clinical data.

## 7. Deferred outside frozen V1

Do not add these during M8: AI diagnosis, AI prescription, patient app/portal, teleconsultation, online payment, pharmacy/lab modules, advanced accounting/CRM/BI, multi-site or autonomous medical decisions.
