# ClinicOS Maroc

ClinicOS Maroc is a Moroccan private-clinic operating system built as a multi-tenant SaaS.

## Delivery status

- M0 Repository Audit — DONE
- M1 Foundation: Auth / Tenant Isolation / RBAC / Prisma V2 — DONE
- M2 Reception / Patients / Agenda / Smart Queue — DONE
- M3 Doctor Workspace / Consultation EMR — DONE
- M4 Prescriptions / Feuille de soins / Billing / Payments — DONE
- M5 Daily Cash Closing / Lock / Audited Adjustments — DONE
- M6 WhatsApp reminder and webhook engine — DONE (live credentials remain per-clinic configuration)
- M7 Business Analytics — DONE
- M8 Security / QA / Release Acceptance — AUTOMATED GATES DONE; FINAL MANUAL PRODUCTION SMOKE TEST PENDING

## Current release gate

The committed M8 acceptance flow covers:

Patient → RDV → confirmation → waiting room → queue → doctor consultation → clinical data → prescription → completed consultation → invoice → feuille de soins → payment → cash closing → cash lock → analytics.

It also verifies tenant isolation and that SECRETARY cannot retrieve diagnosis or clinical notes.

Before declaring ClinicOS Maroc v1.0 ready for clinic onboarding, complete the manual production smoke test defined in `04_RELEASE_READINESS.md` against the final production deployment.

## Frozen references

The frozen product and implementation rules are defined in:
- `00_MASTER_CONTINUITY.md`
- `01_PROJECT_REQUIREMENTS.md`
- `02_EXECUTION_PLAN.md`
- `03_SPECKIT_MASTER.md`
- `04_RELEASE_READINESS.md`
- `05_CLINIC_CUSTOMIZATION_MASTER_PROMPT.md`

Do not change the product scope, RBAC rules, tenant-isolation rules, Moroccan healthcare fields, workflow, cash-lock rules, or core stack without an explicit owner decision.
