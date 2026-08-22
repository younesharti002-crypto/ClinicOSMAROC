# M2 — Reception / Patients / Agenda / Smart Queue

## Implemented
- Tenant-scoped patient list, search, create and administrative update.
- Morocco-first patient fields: CIN, +212 phone normalization, CNSS/CNOPS/private mutuelle, immatriculation and affiliation numbers.
- Secretary-safe administrative patient projection only.
- Reception dashboard with daily counts and quick actions.
- Booked appointments, walk-ins and emergencies.
- Server-side appointment state machine.
- Day/week agenda with doctor filter.
- Deterministic smart queue with emergency priority, booked-slot protection and walk-in interleaving.
- Computed queue positions, preventing duplicate active positions by construction.
- Audit events for patient and appointment changes.

## Acceptance Gate
1. Secretary login redirects into reception workflow.
2. Create patient.
3. Create booked appointment OR walk-in/emergency.
4. Mark booked patient as arrived.
5. Patient appears in queue in deterministic order.
6. Doctor can start consultation; secretary cannot.
7. Clinic A cannot read or create workflow records using Clinic B patient/doctor IDs.
8. Secretary data projections never expose diagnosis or clinicalNotes.
9. Prisma migrations, seed, lint, typecheck, tests and build must pass in CI.
