# Prompts d'implémentation — SetterFlow (page par page)

Ces prompts sont prêts à coller dans un agent de code (Claude Code, Cursor…) ou à donner à un dev.
**Mode d'emploi :** colle **d'abord le bloc « SOCLE »** une fois (ou garde-le en contexte), puis enchaîne **un prompt page par page**. Chaque prompt suppose que le SOCLE est connu.

> Adapte la phrase « réutilise tes composants existants » selon ta stack réelle. Si tu me donnes ton repo, je réécris ces prompts avec tes vrais noms de composants.

---

## 🧱 SOCLE — à coller une fois

```
Tu m'aides à réintégrer le redesign « Atlas » de SetterFlow (outil de setting outbound LinkedIn) dans notre codebase existant. Règles valables pour TOUTES les pages :

DESIGN SYSTEM (source de vérité = setterflow-ds.css, variables --sf-*) :
- Accent unique iris : #5851E8 (hover #4A43DA, weak #EDECFD, line #D9D7FB).
- Neutres froids : texte #15161A / #5C606A / #9A9EA8 ; fond app #FAFAFB ; surfaces #FFFFFF / #F5F5F7 / #EFEFF2 ; bordures #EAEAEE / #DCDCE2.
- Sémantique : chaud #E5484D, tiède #D6890C, succès #2F9E66 (+ versions weak), froid #9A9EA8.
- Typo : Satoshi. Display 32/800 · H1 21/700 · H2 16/700 · H3 14/700 · corps 14/400 · small 13 · méta 12 · label 11/700 uppercase (tracking .06em). Titres tracking -0.02em.
- Espacements : échelle 4px (4/8/12/16/20/24/32/40).
- Rayons : 7 / 9 (défaut boutons-inputs-nav) / 13 (cartes-panneaux) / pill 999.
- Ombres : sm = 0 1px 2px rgba(16,17,26,.05) ; base ; lg = 0 12px 40px rgba(16,17,26,.14).
- Composants : boutons (primary iris, secondary, icon-btn), chips/filtres (actif = fond #15161A), lead-chips (hot/warm/good/acc/score), avatars colorés à initiales + pastille de température, inputs (focus = bordure accent + halo weak), bulles (in = surface-2 coin réduit ; out = accent plein blanc), nav-item (actif = surface + bordure + icône iris), tableaux (en-têtes uppercase #9A9EA8).
- Icônes : style line (Lucide), stroke ~1.7. Logo : symbole « pipeline en S » iris + wordmark « Setter » et point en iris.

CONSIGNES :
- Recrée le design en réutilisant NOS composants et conventions existants ; n'introduis pas de nouvelle lib de style.
- Porte les tokens --sf-* dans notre système de thème (ou mappe-les sur nos variables).
- Respecte prefers-reduced-motion. Transitions de panneau : .26s cubic-bezier(.32,.72,0,1).
- Pas de dégradés décoratifs, pas d'emoji hors ceux fonctionnels déjà présents (🔥 température), pas de coins-arrondis-aléatoires : on vise sobre et précis.

Architecture de navigation (6 entrées + Paramètres) :
Dashboard · Inbox · Leads · Follow-ups · | Ressources (onglets Scripts & templates + Personas) · Leaderboard · | [carte Plan Free→Pro si non-abonné] · Paramètres (onglets Profil · Intégration LinkedIn · Espace de travail · Facturation).

Je te donnerai ensuite UNE page à la fois. Confirme que le socle est clair, puis attends la première page.
```

---

## 1 · Inbox  (HI-FI — réf. `SetterFlow Inbox.html`)

```
Page : INBOX (conversations LinkedIn). Référence HAUTE FIDÉLITÉ : SetterFlow Inbox.html (ignore le sélecteur de thème en haut et le thème « Ember » : on garde UNIQUEMENT Atlas).

Layout : grille 3 colonnes pleine hauteur — [sidebar 236px] [liste conversations 348px] [conversation 1fr]. Un panneau contexte de 392px s'ouvre EN SUPERPOSITION à droite (slide-over + scrim), ce n'est pas une colonne permanente.

Colonne liste : header (titre « Inbox » H1 + compteur), recherche (input fond surface-2), filtres-chips (Tous / Non lus / 🔥 Chauds / À relancer). Items : avatar 42px, nom préfixé d'une pastille de température, horodatage à droite, aperçu 1 ligne (ellipsis). Non lu = nom 700 + badge iris. Sélectionné = fond accent-weak + barre iris 3px à gauche.

Colonne conversation :
- Header : avatar 44px, nom (H2), lead-chips (🔥 Chaud · Score 82 · statut). Actions à droite : bouton primary « Booker un RDV », « Statut ▾ », bouton icône profil (ouvre le panneau), « … ».
- Fil : bulles (in = surface-2, coin haut-gauche réduit ; out = accent plein blanc, coin haut-droit réduit), séparateurs de date centrés, méta sous bulle.
- Composer : rangée Suggestions au-dessus (label « ✦ Suggestions » + chips iris cliquables qui préremplissent le champ), puis textarea auto-grow (max 120px) + bouton trombone + bouton envoyer carré iris. Focus = bordure accent + halo.

Panneau contexte (déclenché par le bouton profil) : en-tête (avatar 48px, nom, rôle, fermer) ; bouton pleine largeur « Booker un RDV » ; Informations (grille 2 col : entreprise, poste, statut [select], format [select], lien profil LinkedIn) ; Persona/Cible (carte) ; Actions rapides (Marquer répondu, Relance +3 j, Lier un lead, Supprimer [danger]) ; Notes (textarea) ; Historique (timeline verticale, points iris reliés). Ouverture : translateX(0), .26s ease ; scrim rgba(20,16,12,.32) cliquable pour fermer.

États : liste/recherche vide ; conversation non liée à un lead (CTA « Lier un lead ») ; chargement du fil ; envoi en cours/échec ; LinkedIn déconnecté (bandeau de reconnexion).
```

---

## 2 · Dashboard  (LO-FI — réf. wireframe, à habiller Atlas)

```
Page : DASHBOARD, layout « journée en focus ». Référence : SetterFlow Wireframes v2.html → onglet Dashboard (basse fidélité : suis la structure, applique le design system Atlas).

Sections, de haut en bas :
1. Bandeau gamification : anneau/score « Setting Score » + série (« 🔥 Série de N jours »), barre de progression iris vers le niveau suivant, chip niveau.
2. Carte « Ta prochaine action » (bordure accent-line) : avatar + intitulé du lead prioritaire + sous-texte (température, score, délai), CTA primary « Ouvrir la conversation » + « Plus tard ». Dessous, 2 actions secondaires compactes (chips priorité).
3. Rangée de 4 KPIs (Conversations / Réponses / Appels proposés / RDV bookés) : carte, label text-3, grande valeur 800.
4. Taux de conversion (Réponse / Appel / Booking / Global, valeurs en iris) + carte Chiffre d'affaires (CA total, clients, bouton « + Deal »).
Topbar : « Bonjour, {prénom} 👋 » + période, bouton primary « + Nouveau lead ».
```

---

## 3 · Leads  (LO-FI — réf. wireframe)

```
Page : LEADS (ex-CRM Leads). Référence : Wireframes v2 → onglet Leads. Bascule Kanban / Table en sous-onglets (un seul visible à la fois).

Topbar : titre « Leads », boutons « Exporter », « Importer », primary « + Nouveau lead ».
Barre de filtres : recherche + selects (format, secteur) + tri (Score ↓). Rangée de chips de statut (Tous / Engagées / En cours / Appels / Follow-up / RDV / Perdus / Non qual.), comptes inclus.

Vue KANBAN : colonnes par statut (Engagée, En cours, Appels, Follow-up, RDV booké, Perdus), scroll horizontal. Carte lead : nom, pastille de température, chips (score, format), bouton « Ouvrir conversation ». Drag & drop entre colonnes = changement de statut.
Vue TABLE : colonnes Nom / Temp. (pastille) / Statut (lead-chip éditable inline ▾) / Persona / Format / Score / Date. Lignes denses, hover surface-2.
```

---

## 4 · Follow-ups  (LO-FI — réf. wireframe)

```
Page : FOLLOW-UPS. Référence : Wireframes v2 → onglet Follow-ups. File de relances triée par priorité et GROUPÉE par échéance.

Topbar : titre + sous-titre « Tes prochaines actions, triées par priorité ».
Filtres : chips (Toutes / En retard [accent hot] / Aujourd'hui / Cette semaine) + selects priorité/type.
Groupes avec label uppercase (En retard, Aujourd'hui, Cette semaine). Item : chip priorité (Haute=hot, Medium=warm), intitulé H3, sous-texte + date, actions « Ouvrir » + primary « ✓ Fait ». Coche = retire l'item avec transition douce.
```

---

## 5 · Ressources  (LO-FI — réf. wireframe)

```
Page : RESSOURCES (fusion Bibliothèque + Personas). Référence : Wireframes v2 → onglet Ressources. Deux onglets internes.

Onglet « Scripts & templates » : recherche + chips catégorie (Tous / Accroche / Relance / Closing) + « + Nouveau ». Grille 3 colonnes de cartes script : titre, extrait (2-3 lignes), chips (catégorie, format), boutons « Aperçu » (ghost) + « Utiliser » (primary).
Onglet « Personas / Cibles » : recherche + « + Nouvelle persona ». Grille 3 colonnes de fiches : avatar + nom + rôle, chips (secteur, taille), section « Douleurs », bouton « Voir la fiche ».
```

---

## 6 · Leaderboard  (LO-FI — réf. wireframe)

```
Page : LEADERBOARD. Référence : Wireframes v2 → onglet Leaderboard. Affichage contextuel selon le rôle.

Filtres de période (Aujourd'hui / Semaine / Mois / Trimestre) + tri.
Vue SOLO : classement personnel (la ligne de l'utilisateur surlignée accent-weak, médaille).
Vue AGENCE : tous les setters de l'espace — tableau # / Setter (avatar) / Conversations / Réponses / Appels / RDV / Score, 1re ligne surlignée. (Option podium top 3 en tête.)
N'afficher cette page que si l'espace contient plusieurs membres ; sinon vue solo.
```

---

## 7 · Paramètres  (LO-FI — réf. wireframe)

```
Page : PARAMÈTRES, en onglets internes. Référence : Wireframes v2 → onglet Paramètres.

Onglets : Profil · Intégration LinkedIn · Espace de travail · Facturation (un panneau visible, onglet actif souligné iris).
- Profil : email (lecture seule), nom complet, rôle ; bouton primary « Enregistrer ».
- Intégration LinkedIn : carte statut (pastille good « LinkedIn connecté » + compte), bouton « Déconnecter » ; sinon CTA de connexion.
- Espace de travail : nom de l'espace + bouton « + Inviter un membre » ; table des membres (avatar, nom, rôle ▾, statut, menu ···).
- Facturation : carte plan actuel (Free) + CTA « Passer en Pro → » ; quotas (leads ce mois X/Y avec barre, comptes LinkedIn X/Y) ; liste des factures.

Rappel : la carte « Plan Free → Pro » de la sidebar n'apparaît que pour les comptes Free ; pour un abonné Pro, la masquer.
```
