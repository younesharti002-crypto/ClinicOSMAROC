# ClinicOS Maroc — PROJECT REQUIREMENTS
Version: 1.0
Status: FROZEN FOR V1

---

# 1. Product Goal

بناء SaaS متعدد العيادات للقطاع الطبي الخاص المغربي يغطي التشغيل اليومي الكامل للعيادة من الاستقبال إلى إغلاق الصندوق.

Primary success flow:

`Patient → Appointment/Walk-in → Queue → Consultation → Prescription → Feuille de soins → Invoice/Payment → Cash Closing → Analytics`

---

# 2. Functional Requirements

## FR-AUTH — Authentication & Identity

### FR-AUTH-001
النظام يجب أن يوفر Login للمستخدمين الداخليين.

### FR-AUTH-002
لا يوجد public signup في V1.

### FR-AUTH-003
كل user يجب أن يكون مرتبطاً بـ `clinicId`.

### FR-AUTH-004
الأدوار الداخلية:
- DOCTOR_ADMIN
- DOCTOR
- SECRETARY

### FR-AUTH-005
inactive users لا يمكنهم الدخول أو تنفيذ mutations.

### FR-AUTH-006
authorization يجب أن يكون server-side وليس UI-only.

---

## FR-TENANT — Multi-Tenancy

### FR-TENANT-001
كل بيانات العيادة يجب أن تكون معزولة باستخدام `clinicId`.

### FR-TENANT-002
كل query وmutation على tenant data يجب أن يتحقق من clinicId الحالي.

### FR-TENANT-003
لا يسمح بالوصول المباشر إلى record بالـid دون tenant validation.

### FR-TENANT-004
أي entity جديدة مرتبطة بالعمل التشغيلي للعيادة يجب أن تحمل `clinicId` أو تكون ownership chain الخاصة بها مثبتة ومفروضة server-side.

### FR-TENANT-005
اختبارات cross-tenant إلزامية.

---

## FR-RBAC — Permissions

### FR-RBAC-001 — DOCTOR_ADMIN
Full clinic control:
- clinical records
- consultation
- prescription
- insurance documents
- billing
- cash
- analytics
- staff
- settings

### FR-RBAC-002 — DOCTOR
- patient medical workspace
- consultations
- prescriptions
- queue
- relevant agenda

### FR-RBAC-003 — SECRETARY
مسموح:
- appointments
- walk-ins
- queue
- demographics
- insurance admin data
- invoicing
- payments
- cash closing

### FR-RBAC-004
SECRETARY ممنوع عليها:
- diagnosis
- clinicalNotes

### FR-RBAC-005
الممنوعات يجب أن تطبق في data access layer، لا عبر إخفاء UI فقط.

---

## FR-CLINIC — Clinic Settings

### FR-CLINIC-001
Clinic fields:
- name
- slug
- phone
- address
- city
- INPE number / doctor INPE mapping
- default timezone

### FR-CLINIC-002
Default timezone للمغرب: `Africa/Casablanca` ما لم يتم ضبط غير ذلك.

### FR-CLINIC-003
DOCTOR_ADMIN فقط يعدل clinic settings.

---

## FR-PATIENT — Patients

### FR-PATIENT-001
إنشاء patient جديد.

### FR-PATIENT-002
البحث عبر:
- name
- phone
- CIN

### FR-PATIENT-003
الحقول الأساسية:
- firstName
- lastName
- phone
- CIN
- birthDate
- gender
- address

### FR-PATIENT-004
الهاتف يدعم/يطبع بصيغة مغربية +212.

### FR-PATIENT-005
Insurance:
- NONE
- AMO_CNSS
- AMO_CNOPS
- PRIVATE_MUTUELLE

### FR-PATIENT-006
Insurance identifiers:
- immatriculationNo
- affiliationNo

### FR-PATIENT-007
Medical profile:
- bloodGroup
- allergies
- chronicDiseases

### FR-PATIENT-008
Secretary لا تحصل على تفاصيل medical history الحساسة غير المطلوبة للاستقبال.

### FR-PATIENT-009
Doctor sees patient 360:
- identity
- insurance
- medical history
- consultations
- prescriptions
- billing overview as authorized

---

## FR-APT — Appointment & Agenda

### FR-APT-001
Appointment types:
- BOOKED
- WALK_IN
- EMERGENCY

### FR-APT-002
Statuses:
- SCHEDULED
- CONFIRMED
- WAITING_ROOM
- IN_CONSULTATION
- COMPLETED
- CANCELLED
- NO_SHOW

### FR-APT-003
Create appointment with:
- patient
- doctor
- scheduledAt
- duration
- type
- notes

### FR-APT-004
Day/week agenda view.

### FR-APT-005
Secretary can mark arrival/cancel/no-show according to role.

### FR-APT-006
Status transitions يجب أن تكون validated server-side.

---

## FR-QUEUE — Smart Queue

### FR-QUEUE-001
النظام يجب أن يدعم booked + walk-in في نفس queue.

### FR-QUEUE-002
يجب تطبيق interleaving واضح وقابل للاختبار.

### FR-QUEUE-003
الـqueue تعرض:
- current patient
- next patient
- waiting patients
- appointment type
- scheduled time when available
- waiting duration where useful

### FR-QUEUE-004
لا يسمح لنفس appointment أن تكون active مرتين في queue.

### FR-QUEUE-005
Doctor/secretary actions:
- arrived
- call/start
- absent/no-show
- finish via consultation flow

### FR-QUEUE-006
Algorithm V1 يجب أن يكون deterministic، وليس AI.

---

## FR-CONS — Consultation / EMR

### FR-CONS-001
Consultation linked to:
- clinic
- patient
- doctor
- optional appointment

### FR-CONS-002
Fields:
- symptoms
- diagnosis
- clinicalNotes

### FR-CONS-003
Only authorized doctors can read/write diagnosis and clinical notes.

### FR-CONS-004
Start consultation moves appointment to `IN_CONSULTATION`.

### FR-CONS-005
Finish consultation moves appointment to `COMPLETED`.

### FR-CONS-006
Historical consultations visible to authorized doctor.

---

## FR-RX — Prescription

### FR-RX-001
Prescription lines:
- medicationName
- dosage
- duration
- isGeneric
- instructions

### FR-RX-002
Prescription linked to consultation and clinic tenant.

### FR-RX-003
Doctor can add/remove lines before final output.

### FR-RX-004
Printable/PDF ordonnance.

### FR-RX-005
V1 does not contain autonomous medication recommendation.

---

## FR-FS — Feuille de soins

### FR-FS-001
Generate printable Feuille de soins.

### FR-FS-002
Pre-fill:
- patient identity
- CIN
- CNSS/CNOPS identifiers
- doctor/clinic identity
- INPE
- consultation date
- relevant billing/act information

### FR-FS-003
Generation is tenant-scoped.

### FR-FS-004
Generated status can be tracked on invoice/consultation.

---

## FR-BILL — Billing & Payments

### FR-BILL-001
Invoice linked to:
- clinicId
- patient
- optional consultation

### FR-BILL-002
Amounts use Decimal.

### FR-BILL-003
Payment methods:
- CASH
- CARD/TPE
- CHEQUE
- VIREMENT

### FR-BILL-004
Record payment actor and timestamp.

### FR-BILL-005
Preferred V1 data model uses a separate Payment entity for reconciliation.

### FR-BILL-006
Completed consultation can appear as `À encaisser`.

### FR-BILL-007
All billing reads/writes tenant-scoped.

---

## FR-CASH — Daily Cash Register

### FR-CASH-001
Daily totals:
- Espèces
- TPE
- Chèques
- optionally Virement in reporting

### FR-CASH-002
System calculates theoretical totals from payments.

### FR-CASH-003
Closing records real counted totals.

### FR-CASH-004
Variance = real - theoretical.

### FR-CASH-005
Reason required when variance is non-zero.

### FR-CASH-006
One official closing per clinic per business date.

### FR-CASH-007
After closing, normal retrospective payment mutation is blocked.

### FR-CASH-008
Any correction after closing must be an audited controlled adjustment, not silent edit.

### FR-CASH-009
Closing stores:
- businessDate
- closedAt
- closedBy
- theoretical totals
- actual totals
- variance
- notes
- lock status

---

## FR-WA — WhatsApp

### FR-WA-001
Use WhatsApp Cloud API.

### FR-WA-002
24h reminder flow supports Moroccan Darija and French.

### FR-WA-003
Patient can confirm or cancel via interactive action where supported.

### FR-WA-004
Webhook must be idempotent.

### FR-WA-005
Store message/event log:
- clinicId
- patientId/appointmentId
- provider message id
- type
- status
- timestamps
- payload metadata as appropriate

### FR-WA-006
No medical diagnosis is sent via WhatsApp in V1.

---

## FR-AN — Analytics

### FR-AN-001
DOCTOR_ADMIN basic dashboard:
- patients today
- appointments today
- walk-ins
- waiting
- completed
- no-show

### FR-AN-002
Revenue:
- today
- current month
- payment breakdown

### FR-AN-003
Basic counts:
- consultations
- new patients
- repeat patients
- no-show rate

### FR-AN-004
All analytics tenant-scoped.

---

## FR-AUDIT — Audit Trail

### FR-AUDIT-001
Audit sensitive actions:
- payment changes
- cash closing
- post-close adjustments
- user/role changes
- sensitive record access/mutation where required

### FR-AUDIT-002
Audit log includes:
- clinicId
- actorUserId
- action
- entityType
- entityId
- timestamp
- before/after or metadata
- reason when required

### FR-AUDIT-003
Audit logs are immutable from normal app UI.

---

# 3. Non-Functional Requirements

## NFR-SEC-001
TypeScript strict mode.

## NFR-SEC-002
All inputs validated using Zod.

## NFR-SEC-003
No trust in client-provided `clinicId` or role.

## NFR-SEC-004
Secrets only via environment variables.

## NFR-SEC-005
No clinical data in logs unless explicitly redacted/safe.

## NFR-SEC-006
Secure session handling.

## NFR-DATA-001
PostgreSQL + Prisma.

## NFR-DATA-002
Indexes on common tenant-scoped lookup paths.

## NFR-DATA-003
Migrations checked before production.

## NFR-UX-001
Mobile-friendly and desktop-friendly.

## NFR-UX-002
Reception flows optimized for speed and few clicks.

## NFR-UX-003
Doctor workspace visually separates clinical work from admin work.

## NFR-REL-001
Mutations that transition workflow states must be transactional where partial failure is dangerous.

## NFR-REL-002
Webhook handlers idempotent.

## NFR-REL-003
Cash close must be race-safe.

## NFR-TEST-001
Unit tests for queue and permission rules.

## NFR-TEST-002
Integration tests for tenant isolation and cash lock.

## NFR-TEST-003
E2E for main patient journey.

---

# 4. Required Data Model V2

Minimum models:

- Clinic
- User
- Patient
- Appointment
- Consultation
- Prescription
- Invoice
- Payment
- CashClosing
- AuditLog
- WhatsAppEvent

Recommended key fields:

## Payment
- id
- clinicId
- invoiceId
- amount
- method
- paidAt
- receivedById
- status
- createdAt

## CashClosing
- id
- clinicId
- businessDate
- theoreticalCash
- theoreticalCard
- theoreticalCheque
- theoreticalTransfer
- actualCash
- actualCard
- actualCheque
- actualTransfer
- totalTheoretical
- totalActual
- variance
- notes
- closedById
- closedAt
- isLocked

Unique:
`@@unique([clinicId, businessDate])`

## AuditLog
- id
- clinicId
- actorUserId
- action
- entityType
- entityId
- metadata Json
- createdAt

## WhatsAppEvent
- id
- clinicId
- patientId?
- appointmentId?
- providerMessageId?
- eventType
- status
- payload Json?
- createdAt

---

# 5. Main Acceptance Scenario

الـMVP لا يعتبر ناجحاً إلا إذا اشتغل هذا السيناريو:

1. Login secretary.
2. Create patient with Moroccan fields.
3. Create booked appointment.
4. Reminder event is created/sent.
5. Mark patient arrived.
6. Queue orders booked/walk-in correctly.
7. Doctor logs in.
8. Starts consultation.
9. Records symptoms, diagnosis, notes.
10. Creates prescription.
11. Generates Feuille de soins.
12. Finishes consultation.
13. Secretary sees `À encaisser`.
14. Records payment.
15. Invoice marked correctly.
16. Cash dashboard reflects payment.
17. Secretary closes cash with real totals.
18. Day locks.
19. Attempt to modify locked payment is rejected.
20. Doctor admin sees updated analytics.
21. Clinic B cannot access any of Clinic A's records.
22. Secretary API response never contains diagnosis/clinicalNotes.
