# Plan — Page Inbox LinkedIn

## Garde de redirection
Sur `/inbox`, on utilise `useUnipileAccount` :
- `loading` → skeleton pleine page (header + 2 colonnes squelettes).
- `account === null` → `useEffect` qui déclenche un toast "Connectez votre compte LinkedIn pour accéder à l'Inbox" puis `navigate('/settings', { replace: true })`.
- `account !== null` → rendu normal de la page.

## Fichiers créés

### 1. `src/hooks/useUnipileConversations.ts`
React Query : `useQuery({ queryKey: ['unipile-conversations', account_id], enabled: !!account_id, queryFn: () => invoke('unipile-proxy', { body: { action: 'get_conversations', account_id }}) })`. Retourne `{ conversations, loading, refetch }`. Type `UnipileConversation` minimal : `id`, `name` (ou `attendee_name`), `last_message`, `timestamp`, `picture_url?`.

### 2. `src/hooks/useUnipileMessages.ts`
Idem avec `chat_id`, `enabled: !!chat_id`. Tri ascendant par timestamp côté hook. Type `UnipileMessage` : `id`, `text`, `timestamp`, `is_sender` (bool).

### 3. `src/pages/Inbox.tsx`
Layout 2 colonnes dans `<AppLayout>` : `grid grid-cols-[360px_1fr]` (responsive : sur mobile, master/detail empilés ; out of scope MVP, focus desktop).

**Colonne gauche** — Liste :
- Header "Inbox" + compteur.
- `ScrollArea` avec items `ConversationListItem`. Chaque item : avatar (initiale), `name`, aperçu `last_message` (truncate), date relative (`date-fns formatDistanceToNow`). État sélectionné = `bg-muted`.
- Skeletons pendant `loading`.
- Empty state si vide.

**Colonne droite** — Détail :
- Sans sélection : centered placeholder "Sélectionnez une conversation".
- Avec sélection :
  - Header : nom contact + badge/bouton "Lier à un lead" (cf. ci-dessous) à droite.
  - Body scrollable : bulles messages. `is_sender` → aligné à droite, `bg-primary text-primary-foreground` ; sinon gauche, `bg-muted`. Heure sous la bulle.
  - Footer fixe : `<Input>` + bouton `Envoyer`. `onSubmit` → invoke `send_message`, puis `setText('')` et `refetchMessages()`. État `sending` pour disable.

### 4. `src/components/inbox/LinkLeadDialog.tsx`
Dialog shadcn. Champ recherche (debounce 200ms). Requête : `supabase.from('leads').select('id, first_name, last_name').ilike via les patterns existants` (firstName+lastName, lastName+firstName). Liste cliquable max 10. Au clic : `update({ unipile_chat_id: conversation.id }).eq('id', lead.id)`, ferme, toast succès, invalide la query `linked-lead`.

### 5. Lien existant conversation ↔ lead
Hook `useLinkedLead(chat_id)` : `supabase.from('leads').select('id, first_name, last_name').eq('unipile_chat_id', chat_id).maybeSingle()`.
- Si présent : header affiche `<Link to={'/leads?focus=' + id}>Nom Prénom</Link>` (ou simplement `/leads`, le drawer lead n'a pas de route dédiée — à confirmer si on veut router).
- Sinon : bouton "Lier à un lead" → ouvre `LinkLeadDialog`.

## Fichiers modifiés

### `src/App.tsx`
- Import `Inbox`.
- Ajout `<Route path="/inbox" element={<OnboardingGuard><AuthGuard><Inbox /></AuthGuard></OnboardingGuard>} />` après `/follow-ups`.

### `src/components/AppSidebar.tsx`
- Ajout d'un item `{ title: 'Inbox', url: '/inbox', icon: Inbox, roles: ['user', 'admin'] }` entre Follow-ups et Leaderboard. Import `Inbox` depuis `lucide-react` (renommer si collision avec la page : `import { Inbox as InboxIcon } from 'lucide-react'`).

## Détails techniques

- Tous les appels Unipile passent par `supabase.functions.invoke('unipile-proxy', ...)` — pas d'accès direct.
- React Query `staleTime: 30s` pour conversations, `10s` pour messages. Pas de polling automatique au MVP (refetch manuel après envoi suffit).
- La colonne `leads.unipile_chat_id` existe déjà (migration précédente). Cast `as any` n'est pas nécessaire si les types sont régénérés ; sinon on l'ajoute localement.
- Format des réponses Unipile non figé : on type souplement (`any`) côté hooks et on fait des fallbacks (`item.name ?? item.attendee_name ?? '—'`, `item.last_message?.text ?? item.snippet`, etc.). À ajuster après premier test réel.
- Aucune modification à `unipile-proxy/index.ts` (les actions `get_conversations`, `get_messages`, `send_message` existent déjà).

## Points à confirmer
1. **Cible du lien lead** : `/leads?focus={id}` ou simplement `/leads` ? La page Leads ouvre un drawer via state local, pas une route — confirmer si ajouter un query-param de focus est OK.
2. **Mobile** : MVP desktop-only acceptable ? (sinon ajouter master→detail navigation).
3. **Champ nom dans la réponse Unipile** : confirmer après premier appel réel (on commence avec `name ?? attendee_name ?? subject`).
