# Lisa Loops — Lessons Learned

> This file is read before every test run and updated after. It accumulates practical knowledge about testing this specific app. Lisa never makes the same mistake twice.

## App-Specific Quirks

- The app is fully in French — all assertions on visible text must use French strings (e.g., "Statut mis à jour", "Aucun lead trouvé").
- Coach role is redirected from /dashboard to /coach automatically via a `<Navigate>` in the Dashboard component.
- The `onboarding_completed` flag defaults to `true` for legacy users (null/missing = completed). Test accounts have it set to `true`.
- Admin pages use edge functions (`admin-list-users`, `admin-create-user`, `admin-delete-user`) that require Bearer token auth — tests must be logged in as admin first.
- Google OAuth cannot be tested via automation — use email/password login exclusively.
- Auto-confirm is enabled: signup immediately creates a confirmed session.

## Timing & Loading

- Admin user list fetched via edge function — may take 2-3 seconds.
- Leads page shows "Chargement..." text while loading data.
- Auth state restoration on page load uses `getSession()` — there's a loading spinner phase before routes resolve.
- Dashboard KPIs depend on date range filter — default range is current period.

## Selectors & DOM Notes

- All page containers have `data-testid="page-{name}"` (e.g., `page-dashboard`, `page-leads`, `page-login`).
- Sidebar nav items: `data-testid="nav-dashboard"`, `nav-leads`, `nav-follow-ups`, `nav-settings`, etc.
- Lead CRUD: `create-lead-form`, `create-lead-firstname`, `create-lead-lastname`, `create-lead-submit`.
- Bulk actions: `leads-bulk-actions` (container), `leads-bulk-delete` (button).
- Delete confirmation: `delete-confirm-dialog`, `delete-confirm-action`.
- Lead detail: `lead-detail-drawer`, `lead-delete-button`.
- Logout: `logout-button`.

## Common Failure Patterns

_None yet — will be populated during test execution._

## Fix Patterns

_When a bug is found and fixed, document the pattern here so similar bugs can be fixed faster._
