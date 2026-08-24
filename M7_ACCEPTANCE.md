# M7 Acceptance — Dashboard & Basic Analytics

M7 is complete when a `DOCTOR_ADMIN` can understand current clinic operations and revenue without exposing clinical content.

## Dashboard
- `/dashboard` renders a business summary for `DOCTOR_ADMIN`.
- `DOCTOR` is routed to `/doctor`.
- `SECRETARY` is routed to `/reception` and does not receive business analytics.

## Current-day KPIs
- distinct patients today
- booked appointments
- walk-ins
- emergencies
- waiting room
- completed appointments
- consultation records created today
- net revenue today from FINALIZED payments + audited ADJUSTMENT records

## Monthly KPIs
- total appointments
- booked / walk-in / emergency breakdown
- completed / no-show / cancelled
- completion and no-show rates
- consultation count
- unique active patients
- new vs repeat active patients
- net revenue and payment-method breakdown
- daily activity series
- doctor operational performance without clinical fields

## Safety
- every aggregation is scoped by `clinicId`
- business analytics require `analytics:business`
- analytics payload never selects diagnosis, clinical notes, symptoms, allergies, or chronic diseases
- tenant-isolation tests cover revenue and patient counts across two clinics

## Gate
Doctor admin can understand current clinic status and revenue from `/dashboard` and drill down in `/analytics`.
