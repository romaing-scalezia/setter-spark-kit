import type { Database } from '@/integrations/supabase/types';

// Row types
export type Lead = Database['public']['Tables']['leads']['Row'];
export type LeadInsert = Database['public']['Tables']['leads']['Insert'];
export type LeadUpdate = Database['public']['Tables']['leads']['Update'];
export type LeadEvent = Database['public']['Tables']['lead_events']['Row'];
export type LeadEventInsert = Database['public']['Tables']['lead_events']['Insert'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type CoachAssignment = Database['public']['Tables']['coach_assignments']['Row'];
export type CoachingContent = Database['public']['Tables']['coaching_contents']['Row'];
export type CoachingContentInsert = Database['public']['Tables']['coaching_contents']['Insert'];

// Enum types
export type LeadStatus = Database['public']['Enums']['lead_status'];
export type LossReason = Database['public']['Enums']['loss_reason_type'];
export type DisqualificationReason = Database['public']['Enums']['disqualification_reason_type'];
export type ContentType = Database['public']['Enums']['content_type'];
export type AppRole = Database['public']['Enums']['app_role'];
export type OutreachType = Database['public']['Enums']['outreach_type_enum'];
export type SourceType = Database['public']['Enums']['source_type_enum'];

// Status labels & colors
export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  conversation_engagee: { label: 'Conversation engagée', color: 'text-primary', bg: 'bg-primary/10' },
  en_cours: { label: 'En cours', color: 'text-primary', bg: 'bg-primary/10' },
  appel_propose: { label: 'Appel proposé', color: 'text-primary', bg: 'bg-primary/10' },
  follow_up: { label: 'Follow-up', color: 'text-warning', bg: 'bg-warning/10' },
  rendez_vous_booke: { label: 'RDV booké', color: 'text-success', bg: 'bg-success/10' },
  ferme_perdu: { label: 'Fermé perdu', color: 'text-destructive', bg: 'bg-destructive/10' },
  non_qualifie: { label: 'Non qualifié', color: 'text-muted-foreground', bg: 'bg-muted' },
};

export const LOSS_REASONS: Record<LossReason, string> = {
  pas_interesse: 'Pas intéressé',
  pas_le_bon_timing: 'Pas le bon timing',
  pas_de_budget: 'Pas de budget',
  ne_repond_plus: 'Ne répond plus',
  deja_accompagne: 'Déjà accompagné',
  objection_non_levee: 'Objection non levée',
  autre: 'Autre',
};

export const DISQUALIFICATION_REASONS: Record<DisqualificationReason, string> = {
  hors_icp: 'Hors ICP',
  activite_non_pertinente: 'Activité non pertinente',
  trop_debutant: 'Trop débutant',
  trop_avance: 'Trop avancé',
  pas_decideur: 'Pas décideur',
  mauvaise_cible: 'Mauvaise cible',
  autre: 'Autre',
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  script: 'Script',
  objection: 'Objection',
  recommendation: 'Recommandation',
  coach_note: 'Note coach',
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  manuel: 'Manuel',
  campagne: 'Campagne',
  inbound: 'Inbound',
  referral: 'Referral',
  autre: 'Autre',
};

export const OUTREACH_TYPE_LABELS: Record<string, string> = {
  message_texte: 'Message texte',
  video: 'Vidéo',
  vocal: 'Vocal',
  autre: 'Autre',
};

// Persona structured dropdowns
export const COMPANY_SIZES = ['Solo', '1–10', '11–50', '51–200', '200+'] as const;

export const TARGET_TYPES = [
  'SaaS', 'Agence', 'Freelance', 'E-commerce', 'Startup',
  'PME', 'Grand compte', 'Coach / Consultant', 'Association', 'Autre',
] as const;

export const SECTORS = [
  'Santé', 'BTP', 'Immobilier', 'Marketing / Communication',
  'Tech / SaaS', 'Éducation', 'Finance', 'RH',
  'Restauration', 'Industrie', 'ONG / Impact', 'Autre',
] as const;

// Funnel order for charts
export const FUNNEL_STATUSES: LeadStatus[] = [
  'conversation_engagee',
  'en_cours',
  'appel_propose',
  'rendez_vous_booke',
];

// Score weights labels for UI explanation
export const SCORE_WEIGHTS_LABELS = [
  { label: 'Conversation engagée', points: 1 },
  { label: 'Réponse obtenue', points: 3 },
  { label: 'Appel proposé', points: 5 },
  { label: 'Rendez-vous booké', points: 10 },
  { label: 'Follow-up traité à temps', points: 2 },
];
