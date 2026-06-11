# Handoff — Redesign SetterFlow (direction « Atlas »)

> **Repo cible identifié : `romaing-scalezia/setter-spark-kit`** (Vite + React + Tailwind + shadcn/ui).
> Pour cette stack, commence par **`INTEGRATION-setter-spark-kit.md`** + **`setterflow-theme.css`** (thème prêt à coller sur tes variables HSL). `PROMPTS.md` reste utile en version générique.

## Vue d'ensemble
Refonte de l'interface de **SetterFlow**, outil de pilotage du setting outbound LinkedIn (Inbox, CRM Leads, Dashboard, Follow-ups, Ressources, Leaderboard, Paramètres). L'objectif est de remplacer une UI générique par une identité propre, sobre et précise — direction **« Atlas »** : neutres froids, un seul accent (iris `#5851E8`), typographie Satoshi, angles francs.

## À propos des fichiers de ce bundle
Les fichiers HTML/CSS ci-joints sont des **références de design** (prototypes montrant l'apparence et le comportement voulus), **pas du code de production à copier tel quel**. La tâche est de **recréer ces designs dans l'environnement existant de l'app SetterFlow** (React/Vue/etc.), en réutilisant ses patterns et sa lib de composants. Le fichier `setterflow-ds.css` est l'exception : ses **tokens** (variables CSS) sont destinés à être repris/portés tels quels dans le code comme source de vérité.

## Fidélité
- **`SetterFlow Inbox.html` → haute fidélité.** Couleurs, typo, espacements et interactions finaux. À recréer au pixel près avec la lib de composants du codebase. (Le fichier embarque un sélecteur Atlas/Ember en haut : **ignorer Ember**, la direction retenue est **Atlas**.)
- **`SetterFlow Wireframes v2.html` → basse fidélité (wireframes).** Donne la **structure, la navigation et l'architecture d'information** de toutes les autres pages. À utiliser comme guide de layout/fonctionnalités, puis **habiller avec le design system Atlas** (cf. `Design System.html`).

## Architecture d'information (validée)
Navigation principale réduite à **6 entrées** + Paramètres :

```
Dashboard
Inbox                     ← nouvelle feature, page prioritaire
Leads                     (ex-« CRM Leads ») — bascule Kanban / Table
Follow-ups
── Ressources & équipe ──
Ressources                (onglets : « Scripts & templates » [ex-Bibliothèque] + « Personas »)
Leaderboard               (solo aujourd'hui ; vue « Équipe » pour les agences)
── pied de sidebar ──
[Carte « Plan Free → Pro »]  ← visible uniquement pour les comptes Free
Paramètres                (onglets : Profil · Intégration LinkedIn · Espace de travail [ex-Workspace] · Facturation [ex-Abonnement])
```

Changements clés vs l'app actuelle :
- **Workspace** → onglet *Espace de travail* dans **Paramètres** (gestion membres/rôles = config).
- **Abonnement** → **carte sidebar** pour les Free + onglet *Facturation* dans **Paramètres**.
- **Bibliothèque + Personas** → hub **Ressources** à onglets.
- **CRM Leads** → **Leads** avec bascule **Kanban / Table**.

## Design tokens
Source de vérité : **`setterflow-ds.css`** (variables `--sf-*`). Résumé :

**Couleurs**
| Rôle | Token | Hex |
|---|---|---|
| Accent (iris) | `--sf-accent` | `#5851E8` |
| Accent hover | `--sf-accent-hover` | `#4A43DA` |
| Accent weak (fond chip/sélection) | `--sf-accent-weak` | `#EDECFD` |
| Accent line (bordure sur weak) | `--sf-accent-line` | `#D9D7FB` |
| Texte principal | `--sf-text` | `#15161A` |
| Texte secondaire | `--sf-text-2` | `#5C606A` |
| Texte tertiaire / méta | `--sf-text-3` | `#9A9EA8` |
| Fond app | `--sf-bg` | `#FAFAFB` |
| Surface (cartes) | `--sf-surface` | `#FFFFFF` |
| Surface 2 (inputs, hover doux) | `--sf-surface-2` | `#F5F5F7` |
| Surface 3 | `--sf-surface-3` | `#EFEFF2` |
| Bordure | `--sf-border` | `#EAEAEE` |
| Bordure forte (inputs) | `--sf-border-strong` | `#DCDCE2` |
| Chaud | `--sf-hot` / `--sf-hot-weak` | `#E5484D` / `#FCEBEC` |
| Tiède | `--sf-warm` / `--sf-warm-weak` | `#D6890C` / `#FBF1DD` |
| Succès / RDV booké | `--sf-good` / `--sf-good-weak` | `#2F9E66` / `#E4F4EC` |
| Froid | `--sf-cold` | `#9A9EA8` |

Avatars : palette `--sf-av-1..8` (fonds colorés, texte blanc, initiales).

**Typographie** — `Satoshi` (Fontshare). Échelle : Display 32/800 · H1 21/700 · H2 16/700 · H3 14/700 · Corps 14/400 · Small 13 (text-2) · Méta 12 (text-3) · Label 11/700 uppercase (tracking .06em). Titres : tracking `-0.02em`.

**Espacements** — échelle 4px : `--sf-space-1..10` (4/8/12/16/20/24/32/40).

**Rayons** — `--sf-radius-sm` 7 · `--sf-radius` 9 (boutons/inputs/nav) · `--sf-radius-lg` 13 (cartes/panneaux) · `--sf-radius-pill` 999.

**Ombres** — `--sf-shadow-sm` · `--sf-shadow` · `--sf-shadow-lg` (cf. CSS).

## Composants (catalogue dans `Design System.html`)
Boutons (primary iris / secondary / sm / icon-btn) · Chips & filtres (état `on` = fond `--sf-text`) · Lead chips (hot/warm/good/acc/score) · Avatars + pastille de température · Champs (input/select, focus = bordure accent + halo `--sf-accent-weak`) · Bulles de message (in = surface-2 ; out = accent plein, coin réduit) · Item de navigation (actif = surface + bordure + icône iris) · Tableau (en-têtes uppercase text-3).

---

## Écran : Inbox (HAUTE FIDÉLITÉ — réf. `SetterFlow Inbox.html`)

**But.** Traiter les conversations LinkedIn et faire avancer chaque lead (booker un RDV, changer de statut) sans quitter la conversation.

**Layout.** Grille 3 colonnes pleine hauteur : `[sidebar 236px] [liste conversations 348px] [conversation 1fr]`. Un **panneau contexte** (392px) se superpose à droite à la demande (slide-over + scrim), il n'est pas une 4e colonne permanente.

**Colonne 1 — Sidebar.** Logo (symbole iris + wordmark « **Setter**Flow**.** »). Nav (cf. IA). Pied : carte **Setting Score** (label + niveau, gros score, barre de progression `--sf-accent`, sous-texte) puis ligne utilisateur (avatar + nom + email). Largeur 236px, fond `--sf-surface-2`, bordure droite.

**Colonne 2 — Liste.** En-tête : titre « Inbox » (H1) + compteur ; barre de recherche (icône + input, fond surface-2) ; rangée de filtres-chips (Tous / Non lus / 🔥 Chauds / À relancer). Liste d'items conversation : avatar 42px, nom (avec pastille de température en préfixe), horodatage aligné à droite, aperçu du dernier message (1 ligne, ellipsis). État **non lu** : nom en 700, aperçu en `--sf-text`, badge compteur iris. État **sélectionné** : fond `--sf-accent-weak` + barre iris 3px à gauche.

**Colonne 3 — Conversation.**
- *Header* : avatar 44px, nom (H2), rangée de **lead-chips** (🔥 Chaud · Score 82 · statut). À droite, barre d'actions : **« Booker un RDV »** (bouton primary), **« Statut ▾ »** (secondary), bouton icône **profil** (ouvre le panneau contexte), bouton icône « … ».
- *Fil* : messages en bulles, séparateurs de date centrés (chip). `in` = `--sf-surface-2` + bordure, coin haut-gauche réduit ; `out` = `--sf-accent` plein, texte blanc, coin haut-droit réduit ; méta sous la bulle (auteur · « lu »).
- *Composer* : rangée **Suggestions** au-dessus (label « ✦ Suggestions » + chips iris cliquables : « Proposer un créneau jeudi », « Répondre chaleureusement », « Template : Closing »). Zone de saisie : textarea auto-grow + bouton trombone + bouton **envoyer** (carré iris). Focus = bordure accent + halo.

**Panneau contexte (slide-over).** Déclenché par le bouton profil. En-tête (avatar 48px, nom, rôle, bouton fermer). Corps scrollable : bouton pleine largeur **« Booker un RDV »** ; section *Informations* (grille 2 col : entreprise, poste, statut [select], format [select] + lien « Voir le profil LinkedIn ») ; *Persona / Cible* (carte) ; *Actions rapides* (grille : Marquer répondu, Relance +3 j, Lier un lead, Supprimer [variante danger `--sf-hot`]) ; *Notes* (textarea) ; *Historique* (timeline verticale, points iris reliés).

**Interactions.** Clic item liste → charge la conversation. Clic profil → ouvre slide-over (`transform: translateX(0)`, transition `.26s var(--sf-ease)`, scrim `rgba(20,16,12,.32)`). Clic scrim ou ✗ → ferme. Chip suggestion → préremplit le composer. Textarea : auto-grow jusqu'à 120px. Filtres : un actif à la fois (sauf logique métier multi).

**États à prévoir.** Liste vide (aucune conversation / aucun résultat de recherche) ; conversation non liée à un lead (CTA « Lier un lead ») ; chargement du fil ; envoi en cours / échec ; LinkedIn déconnecté (bandeau d'invite à reconnecter).

---

## Écrans en BASSE FIDÉLITÉ (réf. `SetterFlow Wireframes v2.html`)
Structure validée — à habiller en Atlas. Naviguer via les onglets en haut du fichier.

- **Dashboard** — « journée en focus » : bandeau Setting Score + série (gamification) ; carte **« Ta prochaine action »** (lead prioritaire + CTA) ; rangée KPIs (Conversations / Réponses / Appels / RDV) ; taux de conversion ; CA. Bouton « + Nouveau lead » en topbar.
- **Leads** — bascule **Kanban / Table** (sous-onglets). Filtres (recherche, format, secteur, tri score) + chips de statut. *Kanban* : colonnes par statut (Engagée / En cours / Appels / Follow-up / RDV booké / Perdus), cartes lead (nom, pastille température, score, format, « Ouvrir conversation »). *Table* : colonnes Nom / Temp. / Statut (édition inline) / Persona / Format / Score / Date.
- **Follow-ups** — file de relances triée par priorité, **groupée par échéance** (En retard / Aujourd'hui / Cette semaine). Item : chip priorité, intitulé, sous-texte + date, actions « Ouvrir » / « ✓ Fait ».
- **Ressources** — onglets **« Scripts & templates »** (grille de cartes script : titre, extrait, tags catégorie/format, « Aperçu » / « Utiliser » + « Nouveau ») et **« Personas »** (grille de fiches : avatar, secteur, douleurs, « Voir la fiche » + « Nouvelle persona »).
- **Leaderboard** — filtres de période ; **solo** = classement perso ; **agence** = tous les setters de l'espace (podium + tableau Conversations/Réponses/Appels/RDV/Score).
- **Paramètres** — onglets **Profil** (email, nom, rôle) · **Intégration LinkedIn** (statut connecté, déconnecter) · **Espace de travail** (nom, table des membres + rôles + invitations) · **Facturation** (plan actuel, quotas leads/comptes, factures).
- **Carte abonnement (sidebar)** — visible uniquement si plan Free : « Plan Free », quotas, CTA « Passer en Pro → ». Masquée pour les abonnés.

## Interactions transverses
- Slide-over panneau : `.26s var(--sf-ease)`, scrim cliquable.
- Onglets internes (Leads, Ressources, Paramètres) : un panneau visible à la fois, onglet actif souligné iris.
- Hovers : surfaces → `--sf-surface-2` ; primary → `--sf-accent-hover`.
- Focus champs : bordure `--sf-accent` + halo `--sf-accent-weak`.
- `prefers-reduced-motion` : désactiver les transitions de panneau.

## State (indicatif)
Conversation sélectionnée · ouverture panneau contexte · filtre liste actif · sous-onglet actif (Leads/Ressources/Paramètres) · vue Leads (kanban|table) · plan utilisateur (free|pro → affichage carte sidebar) · rôle (solo|agence → affichage Leaderboard équipe). Données : conversations LinkedIn, leads, follow-ups, scripts, personas, membres de l'espace.

## Assets
- **Logo** : `logos/C3-pipeline-s.svg` (et variantes dans `C3-pipeline-s/` : `_mark`, `_violet`, `_noir`, `_blanc`). Symbole « pipeline en S », iris `#5851E8`.
- **Icônes** : style *line* (lucide-like), `stroke-width` ~1.7, `viewBox 0 0 24 24`. Remplacer par la lib d'icônes du codebase (Lucide recommandé).
- **Police** : Satoshi via Fontshare — ou licence/hébergement self-host en prod.

## Fichiers de référence
- `INTEGRATION-setter-spark-kit.md` — **doc d'intégration spécifique à ton repo** (mapping vers tes composants/routes réels). À lire en premier.
- `setterflow-theme.css` — **thème Atlas porté sur tes variables HSL shadcn** : remplace `src/index.css`, toute l'app se reskin.
- `setterflow-ds.css` — tokens « neutres » (`--sf-*`) si tu veux la référence hors-shadcn.
- `Design System.html` — catalogue visuel (type, couleurs, espacements, composants, logo).
- `SetterFlow Inbox.html` + `inbox.css` — Inbox **hi-fi** (ignorer le thème Ember).
- `SetterFlow Wireframes v2.html` + `wire.css` — wireframes de toutes les pages + écran « Plan & IA ».
- `logos/` + `C3-pipeline-s/` — logo et variantes.
- `PROMPTS.md` — prompts génériques (secours / autre stack).
