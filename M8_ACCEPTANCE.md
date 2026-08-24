# M8 Acceptance — Hardening, QA & Release

M8 closes the frozen ClinicOS Maroc V1 release scope.

## Security QA
- tenant IDOR/isolation tests cover Clinic A vs Clinic B
- RBAC tests cover secretary clinical denial and admin-only management/business analytics
- active user is reloaded from database for authenticated context
- credential authentication rejects inactive, missing, and wrong-password accounts
- sensitive administrative/business projections exclude diagnosis and clinical notes
- WhatsApp webhook signature and tenant phone-number routing are enforced
- security headers are covered by unit tests

## Data and workflow QA
- CI starts with PostgreSQL and applies committed migrations
- development seed validation runs in CI only
- Decimal money paths are integration-tested
- clinic timezone/business-day behavior is tested
- full acceptance test covers patient → RDV → queue → consultation → prescription → invoice → payment → cash close → analytics
- post-close normal payments are rejected

## Production configuration QA
- `.env` and local env files remain gitignored
- `.env.example` contains placeholders only
- production Vercel build requires `DATABASE_URL` and a 32+ character `SESSION_SECRET`
- production build runs `prisma migrate deploy`
- production build does not use `prisma db push` or development seed
- `/api/health` is dynamic, DB-backed, uncached, returns 200 when healthy and 503 when unavailable

## Release gate
A release candidate may merge only after:
- Prisma generate/validate
- committed migrations
- seed validation
- lint
- typecheck
- all unit tests
- all integration tests including M8 acceptance
- Next.js production build
- Vercel preview success

After merge, Production Vercel must reach Success before the commit is considered the known-good V1 release candidate.
