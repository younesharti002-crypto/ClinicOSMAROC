# M4 — Prescription / Feuille de soins / Billing

## Implemented
- Prescription lines linked to the correct consultation.
- Doctor/tenant-scoped add, edit and remove prescription line operations.
- Printable prescription route.
- Feuille de soins data with Moroccan patient identifiers, insurance, clinic identity, INPE and consultation date.
- Feuille de soins generation tracking.
- Completed consultations exposed to billing without secretary access to clinical fields.
- Invoice creation with Decimal amounts.
- Separate Payment records with payment method and receiving user.
- Tenant-safe invoice and feuille access.
- Payments included in daily cash totals.

## Acceptance Gate
1. Authorized doctor can add, edit and remove prescription lines for an owned consultation.
2. Prescription data cannot be read or changed across tenants.
3. Completed consultation appears in the À encaisser queue without exposing diagnosis or clinical notes.
4. Invoice can be created only for a completed consultation in the same clinic.
5. Payment is recorded separately with actor and method, cannot exceed invoice balance, and updates invoice status.
6. Recorded payment appears in the clinic business-day totals.
7. Feuille de soins contains same-tenant Moroccan patient/clinic/doctor identifiers and generation is tracked.
8. Prisma migrations, seed, lint, typecheck, tests and build must pass in CI.
