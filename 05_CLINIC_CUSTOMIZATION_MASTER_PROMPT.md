# ClinicOS Maroc — Master Clinic Customization Prompt

هذا الملف هو Prompt مرجعي لتخصيص النسخة المعتمدة من ClinicOS لعيادة جديدة.

## المبدأ

ClinicOS هو **Master Template ثابت**. تخصيص عيادة جديدة لا يعني إعادة بناء النظام ولا إعادة تصميمه.

المسموح تغييره هو فقط هوية ومعلومات العيادة المخزنة في إعدادات tenant الخاصة بها.

## المعلومات التي يمكن تقديمها للـAI

```text
CLINIC_NAME=
SPECIALTY=
LOGO_URL=
PHONE=
EMAIL=
WEBSITE=
CITY=
ADDRESS=
INPE=
PRIMARY_COLOR=#0F172A
ACCENT_COLOR=#0F766E
```

إذا كانت معلومة غير متوفرة، اتركها فارغة أو احتفظ بالقيمة الافتراضية. لا تخترع معلومات عن العيادة.

## Prompt

أنت تعمل على النسخة المرجعية المعتمدة من **ClinicOS Maroc**.

هذه النسخة هي **Master Template** ولا يسمح بإعادة تصميمها أو تغيير منطقها الوظيفي أو الطبي أو المالي أو الأمني.

مهمتك هي تخصيص النظام لعيادة جديدة اعتماداً فقط على المعلومات التي سأعطيك.

غيّر فقط إعدادات العيادة التالية عند توفرها:

- اسم العيادة
- التخصص
- الشعار عبر Logo URL
- رقم الهاتف
- البريد الإلكتروني
- الموقع الإلكتروني
- المدينة
- العنوان
- INPE
- اللون الرئيسي
- لون Accent

استخدم إعدادات العيادة المخصصة داخل `/settings/clinic` أو نفس طبقة إعدادات tenant في النظام. لا تنشئ نسخة جديدة من الـworkflow ولا تضع قيم الهوية داخل الكود بشكل hard-coded.

يجب أن تبقى الوظائف التالية كما هي دون أي تعديل في المنطق:

- Authentication
- Multi-tenancy
- RBAC
- Patients
- Réception
- Rendez-vous / Agenda
- File d’attente
- Doctor workspace
- Consultation / EMR
- Prescription
- Feuille de soins
- Facturation
- Paiements
- Caisse et clôture
- Analytics
- Staff
- WhatsApp integration logic
- Audit log
- Security headers
- Tenant isolation

ممنوع:

- تغيير `clinicId` أو tenant ownership يدوياً
- حذف أو تخفيف أي permission
- إعطاء Secretary حق الوصول إلى diagnosis أو clinicalNotes
- تغيير cash-lock rules
- استخدام `prisma db push` في Production
- تشغيل development seed في Production
- وضع secrets أو Meta tokens في الكود أو إعدادات العيادة العامة
- اختراع معلومات ناقصة
- تغيير قاعدة البيانات إلا إذا كان هناك migration رسمي ومطلوب فعلاً من Master Template نفسه

بعد التخصيص، تحقق أن اسم العيادة والشعار والتخصص والألوان تظهر في واجهة النظام وأن بقية الوظائف بقيت بدون تغيير.

## النتيجة المطلوبة

التخصيص الناجح يجب أن يكون:

**نفس ClinicOS + نفس الوظائف + نفس الأمن + هوية عيادة مختلفة.**
