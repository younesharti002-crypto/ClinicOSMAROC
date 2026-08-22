# ClinicOS Maroc — Commercial DEMO Showcase

## Purpose

This DEMO is a **synthetic sales showcase**, not a real clinic tenant and not production patient data.

It demonstrates the frozen ClinicOS workflow with a branded fictional clinic:

**Cabinet Atlas Santé — Médecine générale — Casablanca**

The DEMO must never change the medical workflow, RBAC, tenant isolation, cash rules, billing rules, security model, or database ownership rules.

## What the DEMO contains

- branded clinic identity
- DOCTOR_ADMIN + DOCTOR + SECRETARY demo staff
- synthetic Moroccan-style patient records
- booked and walk-in appointments
- waiting-room queue examples
- completed consultations with clearly synthetic clinical text
- synthetic prescriptions explicitly marked as demo-only
- invoices and finalized payments
- a closed and locked synthetic cash day
- analytics-ready synthetic activity

All names, identifiers, phones and medical content are intentionally synthetic.

## Demo profile

Canonical profile file:

`demo/clinic-atlas-sante.json`

This is also the example format to give an AI when preparing a new clinic customization.

## Safe creation

The DEMO seed refuses to run unless all of these are intentionally supplied in the execution environment:

- `DATABASE_URL`
- `DEMO_CONFIRM=CREATE_SYNTHETIC_DEMO`
- `DEMO_ADMIN_EMAIL`
- `DEMO_ADMIN_PASSWORD` with at least 12 characters

Then run:

`npm run demo:seed`

No demo password is committed to the repository.

## Recreating the DEMO

By default, the command aborts if `atlas-sante-demo` already exists.

For an intentional recreation only, set:

`DEMO_RESET=YES`

This deletes only the tenant with slug `atlas-sante-demo` through its tenant cascade and recreates synthetic data. Never use another clinic slug for this reset flow.

## Sales presentation path

Recommended walkthrough:

1. Login — branded clinic identity
2. Reception — arrivals and walk-ins
3. Patients — Moroccan identity + insurance fields
4. Agenda — booked appointments
5. File d’attente — waiting room ordering
6. Médecin — consultation workspace
7. Prescription / feuille de soins
8. Facturation — invoices and payments
9. Caisse — show locked previous-day closing
10. Analytics — operational and revenue overview
11. Équipe — roles and permissions
12. Paramètres — show that clinic branding changes without rebuilding ClinicOS

## New clinic sales handoff

For a real prospect, do **not** edit application code just to change the brand.

Collect only the clinic profile:

- clinic name
- specialty
- logo URL or uploaded asset URL
- phone
- public email
- website
- city
- address
- INPE if applicable
- primary color
- accent color

Apply the values from `/settings/clinic` or through the approved clinic bootstrap/customization workflow.

Use `05_CLINIC_CUSTOMIZATION_MASTER_PROMPT.md` when another AI is involved. The AI may customize branding and public clinic information only; it must not redesign or alter frozen workflows.
