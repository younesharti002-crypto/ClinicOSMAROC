# ClinicOS Maroc — EXECUTION PLAN
Version: 1.0
Status: FROZEN IMPLEMENTATION ORDER

---

# Execution Principle

لا يتم القفز بين المراحل.
كل Milestone يجب أن يحقق Gate واضح قبل الانتقال للي بعده.

Order:

**M0 Audit → M1 Foundation → M2 Reception → M3 Clinical → M4 Documents/Billing → M5 Cash → M6 WhatsApp → M7 Analytics → M8 Hardening/Release**

---

# M0 — Repository Audit & Baseline

## الهدف
معرفة ما هو موجود فعلاً قبل كتابة أو حذف code.

## Tasks
- Inspect project structure.
- Confirm Next.js App Router.
- Confirm strict TypeScript.
- Inspect Prisma schema/migrations.
- Inspect auth.
- Inspect env usage.
- Inspect current routes.
- Inspect current DB access patterns.
- Search for queries missing clinicId.
- Search for role checks done only in UI.
- Run lint/typecheck/tests/build.
- Produce status matrix:
  - DONE
  - PARTIAL
  - MISSING
  - BLOCKED

## Gate M0
لا تغيير معماري قبل تقرير baseline.

---

# M1 — Data Model, Auth, Tenant Isolation, RBAC

## الهدف
بناء الأساس الأمني.

## Tasks
1. Upgrade Prisma schema to V2.
2. Add clinicId to Invoice.
3. Add clinicId to Prescription.
4. Add Payment.
5. Add AuditLog.
6. Add WhatsAppEvent.
7. Strengthen CashClosing.
8. Add unique business-day closing.
9. Create migration.
10. Create authenticated server context helper:
   - userId
   - clinicId
   - role
   - isActive
11. Create authorization helpers.
12. Create tenant-scoped repositories/services.
13. Ensure secretary projections exclude clinical fields.
14. Seed:
   - Clinic A
   - Doctor admin
   - Doctor
   - Secretary
   - Clinic B for isolation tests

## Tests
- Cross-tenant patient read rejected.
- Cross-tenant mutation rejected.
- Secretary clinical read rejected.
- Inactive user rejected.
- Doctor cannot admin staff.
- Doctor admin allowed.

## Gate M1
لا نبدأ reception قبل نجاح security tests.

---

# M2 — Reception, Patients, Agenda, Smart Queue

## الهدف
تشغيل front desk بالكامل.

## Screens
- `/reception`
- `/patients`
- `/patients/new`
- `/patients/[id]` administrative view
- `/agenda`
- `/appointments/new`
- `/queue`

## Tasks
### Patients
- create
- search name/phone/CIN
- edit demographics
- insurance fields
- +212 normalization

### Appointments
- booked/walk-in/emergency
- status transitions
- day/week agenda

### Queue
- deterministic interleaving function
- current/next/waiting
- arrival
- call/start
- no-show
- no duplicate active queue

## Tests
- booked + walk-in ordering.
- cancelled is removed.
- completed is removed.
- tenant isolation.
- secretary cannot receive clinical content.

## Gate M2
Secretary can execute:
create patient → create RDV/walk-in → mark arrived → manage queue.

---

# M3 — Doctor Workspace & EMR

## الهدف
إكمال العمل الطبي الأساسي.

## Screens
- `/doctor`
- doctor-safe patient view
- `/consultations/[id]`

## Tasks
- list current/next patient
- start consultation
- symptoms
- diagnosis
- clinical notes
- medical history
- allergies/chronic diseases display
- finish consultation
- enforce doctor ownership/clinic permissions
- transactional status transition

## Tests
- start sets IN_CONSULTATION.
- finish sets COMPLETED.
- consultation tenant-safe.
- secretary cannot query clinical fields.
- doctor can read authorized history.

## Gate M3
Doctor can complete a full consultation safely.

---

# M4 — Prescription, Feuille de soins, Billing

## الهدف
إخراج الوثائق وربط consultation بالإيراد.

## Prescription
- add medication lines
- edit/remove before final
- printable layout
- PDF/print

## Feuille de soins
- Moroccan patient fields
- insurance
- INPE
- clinic identity
- consultation date
- print/PDF
- generation tracking

## Billing
- create invoice
- payment method
- separate Payment record
- À encaisser queue
- invoice print

## Tests
- Decimal calculations.
- tenant safety.
- prescription linked to correct consultation.
- feuille data belongs to same tenant.
- payment appears in daily totals.

## Gate M4
Completed consultation can be documented, invoiced, and paid.

---

# M5 — Daily Cash Register & Lock

## الهدف
تحقيق clôture de caisse production-grade.

## Screens
- `/cash`
- `/cash/closing`

## Tasks
- compute theoretical totals
- group by method
- enter actual totals
- calculate variance
- mandatory reason on variance
- close day transactionally
- lock day
- block normal edits after close
- controlled adjustment path for doctor admin
- audit all closing/adjustment operations

## Concurrency
Two users must not be able to create two closings for same clinic/day.

## Tests
- exact totals.
- variance.
- unique close.
- post-close mutation rejected.
- cross-tenant rejected.
- audit emitted.

## Gate M5
Caisse is trustworthy and immutable after closure.

---

# M6 — WhatsApp Reminder & Webhook

## الهدف
إضافة automation الأساسية بدون تحويل النظام إلى CRM.

## Tasks
- WhatsApp Cloud API config
- approved template strategy
- Darija/French content
- 24h reminder scheduler/event trigger
- confirm
- cancel
- webhook signature/security as supported
- idempotency
- WhatsAppEvent persistence
- appointment status update
- retry/error status

## Tests
- duplicate webhook does not duplicate action.
- confirm updates once.
- cancel updates once.
- cross-clinic lookup safe.
- no medical diagnosis in outgoing message.

## Gate M6
Appointment reminder lifecycle works end-to-end.

---

# M7 — Dashboard & Basic Analytics

## Screens
- `/dashboard`
- `/analytics`

## KPIs
- patients today
- booked
- walk-ins
- waiting
- completed
- no-show
- revenue today
- revenue current month
- payment breakdown
- consultations
- new/repeat patient counts

## Rules
- Doctor admin gets business analytics.
- Secretary only sees operational data needed for job.
- All aggregations use clinicId.

## Gate M7
Doctor admin can understand current clinic status and revenue.

---

# M8 — Hardening, QA, Release

## Security QA
- tenant IDOR tests
- role escalation tests
- disabled user tests
- sensitive payload inspection
- env secret inspection

## Data QA
- migration from clean DB
- seed
- indexes
- Decimal consistency
- timezone/businessDate tests

## Workflow E2E
Run full acceptance scenario.

## UX QA
Desktop + mobile:
- login
- reception
- queue
- consultation
- billing
- cash closing

## Production
- build clean
- migrations ready
- env documented
- health checks
- error handling
- no placeholders
- no TODO blocking core flow

## Gate M8
Release V1 only after all blocking acceptance criteria pass.

---

# Task Execution Rules for AI

For every task:
1. State requirement IDs being implemented.
2. Inspect existing code first.
3. Make smallest coherent change.
4. Do not redesign unrelated modules.
5. Add/update tests.
6. Run typecheck/lint/tests.
7. Report changed files.
8. Report remaining risks.
9. Continue to next task only when current acceptance passes.

---

# Suggested Repository Structure

```text
src/
  app/
    (auth)/
    (dashboard)/
    api/
  components/
  features/
    auth/
    patients/
    appointments/
    queue/
    consultations/
    prescriptions/
    documents/
    billing/
    cash/
    whatsapp/
    analytics/
    staff/
  lib/
    auth/
    db/
    permissions/
    tenancy/
    validation/
    money/
    dates/
  server/
    repositories/
    services/
    actions/
  types/
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
  e2e/
```

هذا اقتراح تنظيمي؛ يجوز مواءمته مع repo الحالي بشرط الحفاظ على separation of concerns وعدم إعادة هيكلة مشروع شغال بدون ضرورة.

---

# Progress Reporting Template

بعد كل Milestone:

```text
MILESTONE:
STATUS: DONE / PARTIAL / BLOCKED

Implemented:
- ...

Tests passed:
- ...

Security checks:
- ...

Files changed:
- ...

Remaining:
- ...

Next exact task:
- ...
```
