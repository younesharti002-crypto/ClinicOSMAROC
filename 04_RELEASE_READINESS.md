# ClinicOS Maroc — M8 Release Readiness

This document is the operational release gate for the frozen V1 scope. It does not redesign the product or expand the MVP.

## 1. Application gate

Before a release candidate may be merged to `main`, all of the following must pass on a clean PostgreSQL database:

- Prisma client generation
- Prisma schema validation
- committed migrations via `prisma migrate deploy`
- development seed validation in CI only
- ESLint
- TypeScript strict typecheck
- unit tests
- integration tests
- `tests/integration/m8-release-acceptance.test.ts`
- admin/settings integration tests
- Next.js production build

The M8 acceptance test covers the frozen business journey:

Patient → RDV → confirmation → waiting room → queue → doctor consultation → clinical data → prescription → completed consultation → invoice → feuille de soins marker → payment → cash closing → cash lock → analytics.

It also verifies Clinic A/B isolation and that a secretary cannot receive clinical fields through the clinical repository.

The release also includes the frozen administration routes:

- `/staff` for DOCTOR_ADMIN staff management
- `/settings/clinic` for DOCTOR_ADMIN clinic settings

## 2. Security gate

Required invariants:

- authenticated tenant context is reloaded from the database and scoped by active user + `clinicId`
- server-side RBAC remains authoritative
- secretary administrative patient projections exclude clinical fields
- clinical repositories require clinical capabilities
- staff management is tenant-scoped and restricted to `staff:manage`
- clinic settings are restricted to `clinic:settings:manage`
- an administrator cannot deactivate their own account
- a clinic cannot deactivate its last active DOCTOR_ADMIN
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

The core application requires these Vercel **Production** environment values:

- `DATABASE_URL`
- `SESSION_SECRET` (minimum 32 characters; use a strong random value)

ClinicOS defines a `vercel-build` wrapper. On Vercel:

- when `VERCEL_ENV=production`, the build validates the two required production values and runs `prisma migrate deploy` before `next build`
- preview/non-production builds skip production database migrations
- production deployment fails closed if `DATABASE_URL` or a valid `SESSION_SECRET` is missing

For the database:

1. use a ClinicOS-only PostgreSQL/Neon database
2. back up before production migration changes when the database contains real data
3. let the Vercel production build apply committed Prisma migrations, or run `npm run prisma:migrate:deploy` manually from a trusted terminal when needed
4. do not use `prisma db push` as the production release mechanism
5. do **not** run `npm run db:seed` against production; the seed is development/CI data only
6. bootstrap the first real clinic and its first DOCTOR_ADMIN with `npm run bootstrap:admin`
7. verify `GET /api/health` returns HTTP 200 after deployment

The production bootstrap requires the following one-time environment values in the terminal/session that runs it:

- `BOOTSTRAP_CLINIC_NAME`
- `BOOTSTRAP_CLINIC_SLUG`
- `BOOTSTRAP_CLINIC_PHONE`
- `BOOTSTRAP_CLINIC_ADDRESS`
- optional `BOOTSTRAP_CLINIC_CITY`
- optional `BOOTSTRAP_CLINIC_INPE`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_PASSWORD` (minimum 12 characters)
- optional `BOOTSTRAP_ADMIN_PHONE`
- optional `BOOTSTRAP_ADMIN_INPE`

The bootstrap creates exactly one clinic and one active DOCTOR_ADMIN per invocation and aborts when the target clinic slug or admin email already exists. It never prints the password or password hash.

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
2. log in with the production bootstrap DOCTOR_ADMIN
3. verify `/settings/clinic` and the clinic identity
4. verify `/staff` and add/deactivate a temporary non-admin staff account
5. verify reception and patient search
6. create a test RDV and move it to waiting room
7. verify doctor workspace and consultation start/finish
8. create prescription, invoice and payment
9. close the cash day and verify another normal payment for that day is rejected
10. verify analytics totals
11. verify a second tenant cannot retrieve the first clinic's patient IDs when tenant-isolation testing is performed in staging
12. verify Secretary cannot retrieve diagnosis/clinical notes

Delete all smoke-test patient data before real use if the test was performed in the production database.

## 6. Rollback rule

- Application rollback: revert/redeploy the previous known-good application commit.
- Database rollback: do not improvise destructive Prisma resets in production. Use a reviewed forward-fix migration or a tested restore plan.
- Cash closing: never silently reopen or mutate an official close.
- Clinical records: never repair a release by deleting production clinical data.

## 7. Deferred outside frozen V1

Do not add these during M8: AI diagnosis, AI prescription, patient app/portal, teleconsultation, online payment, pharmacy/lab modules, advanced accounting/CRM/BI, multi-site or autonomous medical decisions.
