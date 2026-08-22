# ClinicOS Maroc — MASTER CONTINUITY FILE
Version: 1.0
Status: FROZEN BASELINE
Purpose: هذا الملف هو المرجع الأعلى لأي AI أو مطور يستلم المشروع. يمنع تغيير الفكرة أو الـscope أو القواعد الأساسية بدون قرار صريح من صاحب المشروع.

---

## 0. قاعدة الاستمرارية

أي AI يستلم هذا المشروع يجب أن:

1. يقرأ هذا الملف أولاً.
2. يقرأ `01_PROJECT_REQUIREMENTS.md`.
3. يقرأ `02_EXECUTION_PLAN.md`.
4. يقرأ `03_SPECKIT_MASTER.md`.
5. يعتبر هذه الملفات مرجعاً أعلى من أي اقتراح تصميم أو refactor شخصي.
6. لا يغيّر الفكرة التجارية أو الـMVP أو الـroles أو الـworkflow.
7. لا يستبدل الـstack إلا بأمر صريح.
8. لا يضيف features خارج الـMVP قبل إتمام جميع Acceptance Criteria.
9. لا يحذف أي requirement بحجة التبسيط.
10. إذا وجد تعارضاً، يوقف التغيير في النقطة المتعارضة ويبلغ عنه بدل أن يخترع قراراً جديداً.

---

# 1. تعريف المنتج

**ClinicOS Maroc** هو نظام تشغيل SaaS متعدد العيادات مخصص للعيادات الطبية الخاصة بالمغرب.

ليس مجرد برنامج مواعيد.

الدورة الأساسية التي يجب أن يغطيها:

**Patient → RDV / Sans RDV → File d’attente → Consultation → Prescription → Feuille de soins → Paiement → Facture → Clôture de caisse → Analytics**

المنتج مصمم من البداية للسياق المغربي:
- CIN
- Téléphone +212
- CNSS / CNOPS / Mutuelle
- N° Immatriculation
- N° Affiliation
- INPE médecin
- Feuille de soins
- Espèces / TPE / Chèque / Virement
- WhatsApp Darija / Français

---

# 2. المستخدمون

## DOCTOR_ADMIN
صلاحيات كاملة داخل العيادة:
- Patient medical record
- Consultation
- Diagnosis
- Clinical notes
- Prescription
- Feuille de soins
- Billing
- Cash
- Analytics
- Staff
- Settings

## DOCTOR
صلاحيات طبية وتشغيلية مرتبطة بعمله:
- Patients
- Queue
- Consultations
- Prescription
- Medical history
- Agenda الخاص به حسب التطبيق

## SECRETARY
صلاحيات إدارية فقط:
- Patients demographics
- Appointments
- Walk-ins
- Queue
- Billing
- Payments
- Cash closing

**ممنوع منعاً باتاً** أن ترى:
- `diagnosis`
- `clinicalNotes`
- أي field طبي حساس غير مطلوب للاستقبال

## PATIENT
في V1 ليس User داخلياً في لوحة التحكم.
هو **external actor** يتفاعل عبر WhatsApp / ticket tracking عند تفعيل ذلك.
لا تتم إضافة PATIENT إلى RBAC الداخلي إلا بقرار لاحق صريح.

---

# 3. الـMVP المجمد

## داخل V1
1. Auth
2. Multi-tenancy
3. RBAC
4. Clinic settings
5. Staff
6. Patients
7. Moroccan insurance fields
8. Agenda / appointments
9. Walk-in registration
10. Smart queue
11. Doctor workspace
12. Consultation / EMR
13. Prescription
14. Feuille de soins
15. Billing / invoices
16. Payments
17. Daily cash register
18. Cash closing + lock
19. WhatsApp appointment reminder / confirm / cancel
20. Basic analytics
21. Audit log for sensitive operations

## خارج V1
- AI diagnosis
- AI prescription
- Patient mobile application
- Full patient portal
- Teleconsultation
- Online payments
- Pharmacy stock
- Lab system
- Full accounting
- Advanced CRM
- Marketing automation
- Advanced waiting-list automation
- Advanced recall automation
- Multi-site clinics
- Insurance API integrations
- Marketplace
- Advanced BI
- Autonomous medical decisions

---

# 4. الـWorkflow المرجعي

## Scenario A — Patient avec RDV
1. Secretary creates or finds patient.
2. Secretary creates appointment.
3. WhatsApp reminder is sent according to configured rule.
4. Patient confirms/cancels.
5. On arrival, secretary marks `WAITING_ROOM`.
6. Patient enters queue.
7. Doctor starts consultation -> `IN_CONSULTATION`.
8. Doctor completes medical notes.
9. Doctor can create prescription.
10. Doctor can generate Feuille de soins.
11. Doctor ends consultation -> `COMPLETED`.
12. Reception sees patient as `À encaisser`.
13. Secretary records payment.
14. Invoice is created/updated.
15. Payment contributes to today's cash totals.
16. End of day secretary closes cash.
17. Closed day becomes write-locked.
18. Doctor admin sees analytics.

## Scenario B — Sans RDV
1. Secretary finds/creates patient.
2. Creates `WALK_IN` appointment.
3. Patient enters queue.
4. Queue algorithm interleaves booked appointments and walk-ins.
5. Remaining flow is identical to Scenario A from consultation onward.

---

# 5. UI Architecture المجمدة

Routes المرجعية:

- `/login`
- `/dashboard`
- `/reception`
- `/patients`
- `/patients/new`
- `/patients/[id]`
- `/agenda`
- `/appointments/new`
- `/queue`
- `/doctor`
- `/consultations/[id]`
- `/documents/feuille-de-soins/[id]`
- `/billing`
- `/invoices/[id]`
- `/cash`
- `/cash/closing`
- `/analytics`
- `/staff`
- `/settings/clinic`

يجوز تغيير route naming تقنياً فقط إذا كان ضرورياً، بشرط عدم تغيير الوظيفة أو الـinformation architecture.

---

# 6. Stack المجمد

- Next.js 14+ App Router
- TypeScript Strict Mode
- Tailwind CSS
- shadcn/ui
- Lucide React
- Server Actions
- Route Handlers عند الحاجة
- Zod validation
- PostgreSQL / Supabase
- Prisma ORM
- WhatsApp Cloud API
- PDF / printable documents عبر حل متوافق مع Next.js production

لا يتم استبدال Prisma أو PostgreSQL أو Next.js بدون قرار صريح.

---

# 7. قواعد البيانات والأمان

## Tenant isolation
كل domain entity القابلة للوصول من tenant يجب أن تكون مرتبطة بـ `clinicId`.

كل read/write يجب أن يقيّد بـ:
- authenticated user
- active user
- clinicId
- role permission

**ممنوع query by id فقط** على بيانات tenant.

مثال ممنوع:
`prisma.patient.findUnique({ where: { id } })`

النمط المطلوب:
- resolve current user
- resolve `clinicId`
- query by `id + clinicId` أو validate ownership before mutation

## Sensitive clinical data
Secretary must never receive medical fields in the server response.
إخفاء الحقول في UI وحده غير كافٍ.

## Cash lock
بعد clôture:
- لا تعديل عادي على payments/finalized invoices لذلك اليوم.
- أي correction مستقبلية تحتاج controlled admin adjustment مع audit trail.
- لا يتم "فتح" يوم مقفل بصمت.

## Audit
عمليات حساسة تسجل:
- actor userId
- clinicId
- action
- entity type
- entity id
- before/after عند الحاجة
- timestamp
- reason إذا كان correction

---

# 8. قرارات Data Model الإلزامية

الـPrisma Schema الأصلي هو baseline، لكن قبل production يجب تقويته كالتالي:

1. إضافة `clinicId` إلى `Invoice`.
2. إضافة `clinicId` إلى `Prescription` أو فرض tenant check عبر Consultation في كل عملية؛ **القرار المفضل في V1: إضافة clinicId صريحاً**.
3. إضافة `clinicId` إلى أي entity جديدة.
4. إضافة `Payment` entity منفصلة بدل الاعتماد فقط على payment fields داخل Invoice إذا كان النظام سيدعم تعدد الدفعات أو reconciliation دقيق. في V1 يفضل `Payment`.
5. إضافة `CashClosing.status/lockedAt` أو ما يعادله.
6. إضافة unique constraint منطقي للإغلاق اليومي لكل clinic:
   - clinicId + businessDate
7. إضافة `AuditLog`.
8. إضافة WhatsApp delivery / interaction log.
9. إضافة business timezone على clinic أو اعتماد `Africa/Casablanca` افتراضياً.
10. لا تستخدم `DateTime @default(now())` وحدها كـbusiness date للإغلاق؛ يجب الفصل بين timestamp وbusinessDate.

---

# 9. Definition of Done للنسخة V1

لا تعتبر V1 مكتملة حتى تنجح الاختبارات التالية:

### Tenant Security
- Clinic A لا تستطيع رؤية أو تعديل أي record من Clinic B.
- تغيير id في URL لا يكشف بيانات tenant آخر.

### RBAC
- Secretary لا تستقبل diagnosis/clinicalNotes من server.
- Doctor لا يستطيع إدارة staff إذا لم يكن admin.
- Disabled user cannot act.

### Patient
- إنشاء/بحث/تعديل patient.
- دعم CIN/+212/insurance IDs.

### Appointment
- إنشاء RDV.
- Walk-in.
- Status transitions.
- No-show/cancel.

### Queue
- دمج RDV وWalk-in.
- patient التالي واضح.
- لا توجد duplicate active queue entries.

### Consultation
- doctor starts/finishes.
- clinical fields persist.
- medical history works.

### Prescription
- add medication lines.
- print/export.

### Feuille de soins
- patient + insurance + clinic/doctor INPE prefilled.
- printable output.

### Billing
- record amount and method.
- invoice linked to patient/clinic.
- no cross-tenant access.

### Cash
- totals by payment method.
- closing calculates theoretical total.
- variance can be recorded.
- after closing: normal write blocked.

### WhatsApp
- reminder event recorded.
- confirm/cancel webhook idempotent.
- message language Darija/French.

### Analytics
- basic day/month revenue and patient counts use tenant-scoped data.

---

# 10. قاعدة منع الانحراف

أي AI أو مطور يقترح:
- تغيير المنتج إلى marketplace
- حذف smart queue
- حذف cash closing
- حذف Moroccan fields
- دمج doctor/secretary permissions
- إعطاء secretary medical notes
- إضافة AI diagnosis داخل V1
- تغيير الـstack بالكامل
- إزالة multi-tenancy

يعتبر ذلك **خروجاً عن المواصفات** وليس تحسيناً.

---

# 11. الأولوية عند التعارض

ترتيب المرجعية:

1. قرار صريح جديد من صاحب المشروع.
2. `00_MASTER_CONTINUITY.md`
3. `01_PROJECT_REQUIREMENTS.md`
4. `03_SPECKIT_MASTER.md`
5. `02_EXECUTION_PLAN.md`
6. الـPRD الأصلي.
7. System Rules الأصلية.
8. Prisma baseline الأصلي.
9. أي اقتراح من AI.

---

# 12. أمر الاستلام لأي AI

ابدأ دائماً بهذه الجملة داخلياً:

> "I am continuing ClinicOS Maroc from a frozen specification. I must implement, not redesign."

ثم:
1. Audit current repo.
2. Map current code to milestones.
3. Report completed / partial / missing.
4. Continue from first incomplete blocking milestone.
5. Do not rewrite working modules without technical necessity.
6. Every change must map to a requirement ID from the requirements file.
