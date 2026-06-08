## Setter Responsible — MVP Plan

Goal: track who handled each lead when 2+ setters share a LinkedIn account, while staying **completely invisible for solo users**.

### 1. Data model

Add to `public.leads`:
- `setter_id uuid NOT NULL DEFAULT auth.uid()` — who is actually doing the setting (distinct from `owner_id`, which stays as the lead's data owner for RLS).

Backfill: `UPDATE leads SET setter_id = owner_id`.

New table `public.team_members` (lightweight "shared workspace"):
- `team_id uuid` (we reuse `coach_id` as the team key — students of the same coach form one team; admins can also create ad-hoc teams later)
- `user_id uuid`
- unique(team_id, user_id)

For MVP we will **derive** the team from existing `coach_assignments`: two users belong to the same team if they share the same `coach_id`. No new table required → zero migration risk and matches the existing mental model. A new SQL helper `get_team_members(_user_id)` returns the user themselves + all co-students of their coach (if any).

### 2. RLS

- `leads` keeps existing RLS (owner / coach / admin). Setter does **not** grant cross-user access in MVP — to avoid leaking data, only `owner_id` controls visibility.
- A coach can already see all leads of their students, so setter analytics for the team work through the coach.
- When a normal user picks another setter, that setter must be in `get_team_members(auth.uid())`. Enforced by a trigger.

### 3. UI behavior (friction-free for solo users)

Helper hook `useTeammates()`:
- returns the list of co-setters from `get_team_members`.
- if length ≤ 1 → user is solo → hide all setter UI.

**Lead creation modal** (`CreateLeadModal`):
- If solo → no field shown, `setter_id` defaults to current user server-side.
- If teammates exist → small "Setter responsable" select, defaulted to current user.

**Lead detail drawer** (`LeadDetailDrawer`):
- If solo → no setter row.
- If team → show "Setter: Name" with inline edit (owner / coach / admin only).

**CRM table** (`Leads.tsx`):
- Setter column + "Setter" filter rendered only when `teammates.length > 1`.

**Dashboard** (`Dashboard.tsx`):
- New "Performance par setter" card (conversations / responses / calls / RDV / rates) shown only when the current user has teammates *or* is a coach/admin viewing a student. Reuses existing KPI queries grouped by `setter_id`.

### 4. Permissions summary

| Role | Can change setter on a lead |
|------|------------------------------|
| Owner (solo) | n/a — auto |
| Owner with teammates | yes, to any teammate |
| Coach | yes, on their students' leads |
| Admin | yes, everywhere |

### 5. Files touched

- Migration: add `setter_id`, backfill, `get_team_members` SQL function, trigger validating setter belongs to team.
- `src/hooks/useTeammates.ts` (new)
- `src/components/CreateLeadModal.tsx` — conditional setter select
- `src/components/LeadDetailDrawer.tsx` — setter row + edit
- `src/pages/Leads.tsx` — column + filter (conditional)
- `src/pages/Dashboard.tsx` — per-setter breakdown card (conditional)
- `src/components/SetterBreakdownCard.tsx` (new)

### Out of scope (MVP)

- Standalone `teams` table / invitations / shared workspaces UI.
- Expanding RLS so teammates can read each other's leads (would require explicit team isolation table). Coaches remain the cross-user viewer.
