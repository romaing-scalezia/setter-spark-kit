# Intégration dans `setter-spark-kit` (Vite + React + Tailwind + shadcn/ui)

Doc spécifique à TON repo. Elle remplace les prompts génériques de `PROMPTS.md` (à garder en secours). Ici, tout est mappé sur tes vrais fichiers, routes et composants.

---

## 0 · Reskin global (15 min, gros impact visuel)

**a. Thème.** Remplace le contenu de `src/index.css` par `setterflow-theme.css` (fourni). Il ne touche QUE tes variables HSL existantes → toute l'app passe en Atlas (iris `#5851E8`, neutres froids, sémantique chaud/tiède/succès).

**b. Police.** Le thème importe **Satoshi**. Mets à jour `tailwind.config.ts` :
```ts
fontFamily: { sans: ["Satoshi", "Inter", "system-ui", "sans-serif"] }
```

**c. Rayons.** `--radius` passe à `0.625rem` (10px). Pour les **cartes/panneaux** en 13px, utilise `rounded-xl` (déjà dispo via Tailwind) plutôt que `rounded-lg`.

**Ce qui marche tout seul après ça :** `Button` (primary = iris), `Badge`, `Card`, `Input` (focus ring iris), `Sidebar`, bulles de message de l'Inbox (`bg-primary` / `bg-muted`), chip lead lié (`bg-primary/10 text-primary`). Le `--accent` de shadcn reste un **gris de hover** (ne pas confondre avec la couleur de marque, qui est `--primary`).

> ⚠️ Vérifie `src/lib/constants.ts` → `STATUS_CONFIG` (utilisé par `StatusBadge`). S'il contient des classes en dur type `bg-blue-100 text-blue-700`, remplace-les par les tokens sémantiques : engagée/en cours → `bg-primary/10 text-primary`, RDV booké → `bg-success/10 text-success`, perdu → `bg-destructive/10 text-destructive`, tiède → `bg-warning/10 text-warning`. Idem pour `AVATAR_COLORS` dans `Inbox.tsx` : la palette `bg-*-500` actuelle reste OK, mais tu peux la resserrer pour un rendu plus sobre.

---

## 1 · Refonte de la navigation (`src/components/AppSidebar.tsx`)

Objectif : **6 entrées** au lieu de 14 à plat, regroupées, + carte Free, + logo.

**a. Logo.** Dans `SidebarHeader`, remplace l'icône `MessageSquare` par le symbole SetterFlow (`logos/C3-pipeline-s_mark.svg`, ou inline le SVG en `text-primary-foreground`). Garde le wordmark mais stylé : `Setter` + le point en `text-primary`.

**b. Regroupe `navItems`** en deux `SidebarGroup` (« Navigation » + « Ressources & équipe ») et **déplace ces entrées hors de la nav** :
- `Bibliothèque` + `Personas` → fusionnées dans **une seule route** `Ressources` à onglets (voir §5).
- `Workspace` → onglet *Espace de travail* de **Settings** (§7). Retirer de la nav.
- `Abonnement` (`/billing`) → onglet *Facturation* de **Settings** + **carte Free** en bas de sidebar (§8). Retirer de la nav.
- `CRM Leads` → renommer simplement **« Leads »**.

Cible :
```
Groupe "Navigation" :        Dashboard · Inbox · Leads · Follow-ups
Groupe "Ressources & équipe": Ressources · Leaderboard
(admin/coach : garder Supervision/Admin/Analytics… filtrés par rôle comme aujourd'hui)
Pied de sidebar :            <FreePlanCard/> (si plan Free) · Paramètres
```
Le filtrage par `roles` / `activeRole` est déjà en place — conserve-le.

---

## 2 · Inbox — passer du 2 colonnes actuel au layout B (réf. `SetterFlow Inbox.html`)

Ta page `src/pages/Inbox.tsx` est déjà solide (Unipile, envoi, lier/créer un lead). On l'**augmente**, sans tout réécrire :

1. **Header de conversation** → ajouter, à côté du nom, une rangée de **lead-chips** quand un lead est lié : température (🔥/tiède/froid), `Score`, `StatusBadge`. À droite, un bouton **primary « Booker un RDV »** + **« Statut ▾ »** (réutilise `StatusDropdown`) + un bouton icône **profil** qui ouvre le drawer (point 3).
2. **Panneau contexte** → **réutilise `LeadDetailDrawer`** (déjà 22 Ko, il a infos/persona/notes/historique). Branche le bouton profil dessus avec le `linkedLead`. Pas besoin d'un nouveau composant. S'il n'y a pas de lead lié, le drawer propose « Lier » / « Créer » (tu as déjà `LinkLeadDialog` + `CreateLeadModal`).
3. **Suggestions** → au-dessus du `<form>` du composer, une rangée de chips (`Button variant="outline" size="sm"` arrondis `rounded-full`, texte iris) qui `setText(...)` au clic : « Proposer un créneau », « Répondre chaleureusement », « Template : Closing ». (Brancher sur tes templates de la Bibliothèque plus tard.)
4. **Liste** → ajouter la **pastille de température** devant le nom dans `ConversationRow` et les **filtres-chips** (Tous / Non lus / 🔥 Chauds / À relancer) sous le header. Le badge non-lu iris existe déjà.
5. **Composer** → l'`Input` simple peut devenir un `Textarea` auto-grow (shadcn `Textarea` dispo) ; bouton **Send** carré iris (déjà `bg-primary`).

Layout : tu peux passer la grille de `grid-cols-[360px_1fr]` à `grid-cols-[360px_1fr]` inchangée — le contexte s'ouvre **en drawer** par-dessus (pas une 3e colonne), conforme à la maquette.

---

## 3 · Dashboard (`src/pages/Dashboard.tsx`)
Réutilise tes composants existants : `ScoreCard`, `TodaysActionsCard`, `KpiCard`, `ConversionRates`, `FunnelChart`, `MissionsCard`. Réorganise en « journée en focus » : bandeau score/série en haut → carte **« Ta prochaine action »** (mets en avant le 1er item de `TodaysActionsCard`, CTA primary) → rangée de `KpiCard` → `ConversionRates` + CA. Habillage Atlas automatique via le thème.

## 4 · Leads (`src/pages/Leads.tsx`)
Garde la table existante (`StatusBadge`, `StatusDropdown`, `TaskCard`). Ajoute une **bascule Kanban / Table** via shadcn `Tabs`. Kanban : colonnes par statut (clés de `STATUS_CONFIG`), cartes lead déplaçables (changement de statut = même mutation que `StatusDropdown`).

## 5 · Ressources (nouvelle route `/ressources`)
Fusionne `pages/Library.tsx` + `pages/Personas.tsx` dans une page à **`Tabs`** (« Scripts & templates » / « Personas »). Tu peux soit créer `pages/Ressources.tsx` qui monte les deux contenus existants, soit garder les routes et n'unifier que l'entrée de nav. Le plus propre : une page, deux `TabsContent` important les corps actuels.

## 6 · Leaderboard (`src/pages/Leaderboard.tsx`)
Tu as déjà `gamification/LeaderboardTable.tsx`. Affichage contextuel : solo = ligne perso surlignée `bg-primary/10` ; multi-membres = tableau complet. Filtres de période en `Tabs`/`Button` groupés.

## 7 · Paramètres (`src/pages/Settings.tsx`)
Passe en **`Tabs`** : *Profil* · *Intégration LinkedIn* (réutilise `LinkedInIntegrationCard`) · *Espace de travail* (monte le contenu de `pages/Workspace.tsx`) · *Facturation* (monte le contenu de `pages/Billing.tsx`). Tu peux conserver `/workspace` et `/billing` comme redirections vers les onglets.

## 8 · Carte « Plan Free → Pro » (sidebar)
Nouveau petit composant `FreePlanCard` rendu dans le pied de `AppSidebar`, **conditionné au plan** (depuis ton `AuthContext`/profil ou la donnée Billing). Carte `bg-primary/5 border-primary/20`, titre « Plan Free », quotas, `Button` primary « Passer en Pro → » → route `/billing` (ou onglet Facturation). Masquée pour les abonnés Pro.

---

## Récap mapping design → ton code
| Élément maquette | Dans ton repo |
|---|---|
| Couleur de marque (iris) | `--primary` (HSL) |
| Chaud / Tiède / Succès | `--destructive` / `--warning` / `--success` |
| Panneau contexte Inbox | **`LeadDetailDrawer`** (réutiliser) |
| Statut lead | `StatusBadge` + `StatusDropdown` + `STATUS_CONFIG` |
| Lier / créer un lead | `LinkLeadDialog` + `CreateLeadModal` (déjà branchés) |
| Score / série / missions | `gamification/*` (`ScoreCard`, `MissionsCard`, `LeaderboardTable`) |
| KPIs / conversion | `KpiCard`, `ConversionRates`, `FunnelChart` |
| Onglets (Leads/Ressources/Settings) | shadcn `Tabs` |
| Nav | `AppSidebar` + `NavLink` (regrouper `navItems`) |
| Icônes | `lucide-react` (déjà installé) |

## Ordre conseillé
1. Reskin global (§0) — effet immédiat, zéro risque.
2. Nav regroupée + carte Free (§1, §8).
3. Inbox augmentée (§2) — la feature prioritaire.
4. Settings/Ressources en onglets (§7, §5).
5. Dashboard, Leads, Leaderboard (§3, §4, §6).
