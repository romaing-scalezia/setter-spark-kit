# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# All commands must be run from setter-spark-kit/ (not the repo root)
cd setter-spark-kit

npm run dev        # Dev server on http://localhost:8080
npm run build      # Production build (runs tsc first)
npm run lint       # ESLint
npm run test       # Vitest (single run)
npm run test:watch # Vitest (watch mode)
npm run preview    # Preview production build
```

## Stack

React 18 + TypeScript + Vite (SWC) + Tailwind CSS + shadcn/ui + Supabase + React Query v5 + React Router v6.

## Architecture

### Auth & role model

`src/contexts/AuthContext.tsx` is the single source of truth for auth state. It exposes `user`, `session`, `profile`, `roles`, `activeRole` (always one of `'user' | 'coach' | 'admin'`), and helpers `refreshUserData` / `switchRole`.

On first sign-up the RPC `bootstrap_current_user()` runs automatically. Roles come from the `user_roles` table; profile data from `profiles`.

### Route guards

Three guards wrap routes in `src/App.tsx`:
- `PublicRoute` — redirects authenticated users to `/dashboard`
- `AuthGuard` — redirects unauthenticated to `/login`; accepts optional `requiredRole` (non-admins without that role get redirected to `/dashboard`)
- `OnboardingGuard` — redirects to `/onboarding` if `profile.onboarding_completed` is false

Wrap new protected routes with `<OnboardingGuard><AuthGuard>…</AuthGuard></OnboardingGuard>`.

### Layout

Every authenticated page renders inside `AppLayout` (wraps its `children` in `SidebarProvider` + `AppSidebar` + a header bar). Pages that are content-only extract a `XxxContent` named export + a thin default-export wrapper that adds `AppLayout`. See `src/pages/Workspace.tsx` for the pattern.

### Sidebar navigation

`src/components/AppSidebar.tsx` owns the nav items. To add a page to the nav, add an entry to `navMain` or `navResources` (with the `roles` array), add a `DUO` duotone SVG icon, and register the route in `App.tsx`.

### Supabase

Client is at `src/integrations/supabase/client.ts` — do not recreate it. Types are auto-generated at `src/integrations/supabase/types.ts`. For tables not yet in those generated types (e.g., newly created tables), cast: `supabase.from('table_name' as any)`.

### Data fetching

Use React Query (`@tanstack/react-query`) for all Supabase reads. Hooks live in `src/hooks/`. Follow the existing patterns: `useQuery` for reads keyed by `[entity, user?.id]`, `useMutation` with `qc.invalidateQueries` on success.

## Design tokens

Primary color: iris `#5851E8` / HSL `243 77% 61%` → `text-primary`, `bg-primary`, etc.

The sidebar uses hardcoded hex values from the design reference (not Tailwind variables) for pixel-perfect fidelity:
- Active item bg: `#EDECFD`, text: `#4A43DA`, icon: `#5851E8`
- Muted text: `#5C606A` (ink2), `#9A9EA8` (ink3)
- Dividers: `#F0F1F3` (line2), `#EAEAEE` (line)

Duotone SVG icons: `.fill` class → `fill: currentColor; fill-opacity: .18; stroke: none`. `.ln` class → `fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round`. Injected via `dangerouslySetInnerHTML` on a `<svg class="sf-duo">`.

Font: Satoshi loaded from `https://api.fontshare.com` in `index.css`.

## URL-persisted tabs

When a page has tabs, persist the active tab via `useSearchParams` — `?tab=value`. See `src/pages/Ressources.tsx` and `src/pages/Settings.tsx`.
