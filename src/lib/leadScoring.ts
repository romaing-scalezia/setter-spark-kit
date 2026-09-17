import type { Lead, LeadStatus } from '@/lib/constants';
import { differenceInDays, differenceInHours, isBefore, startOfDay } from 'date-fns';

// ── Lead Temperature ─────────────────────────────────────
export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface LeadScore {
  score: number;        // 0-100
  temperature: LeadTemperature;
  signals: string[];    // human-readable reasons
}

const STATUS_WEIGHT: Record<LeadStatus, number> = {
  conversation_engagee: 10,
  en_cours: 25,
  appel_propose: 50,
  follow_up: 20,
  rendez_vous_booke: 70,
  ferme_perdu: 0,
  non_qualifie: 0,
};

export function scoreLead(lead: Lead): LeadScore {
  const now = new Date();
  let score = 0;
  const signals: string[] = [];

  // 1. Status weight
  score += STATUS_WEIGHT[lead.status] || 0;

  // 2. Recency of activity
  const lastUpdate = new Date(lead.updated_at || lead.created_at);
  const hoursSinceUpdate = differenceInHours(now, lastUpdate);
  if (hoursSinceUpdate < 24) {
    score += 15;
    signals.push('Activité < 24h');
  } else if (hoursSinceUpdate < 48) {
    score += 8;
    signals.push('Activité < 48h');
  } else if (hoursSinceUpdate > 168) {
    score -= 15;
    signals.push('Inactif > 7 jours');
  }

  // 3. Quick progression (created recently + advanced status)
  const daysSinceCreated = differenceInDays(now, new Date(lead.created_at));
  if (daysSinceCreated <= 7 && ['appel_propose', 'rendez_vous_booke'].includes(lead.status)) {
    score += 10;
    signals.push('Progression rapide');
  }

  // 4. Follow-up discipline
  if (lead.status === 'follow_up' && lead.follow_up_date) {
    const fuDate = new Date(lead.follow_up_date);
    if (isBefore(fuDate, startOfDay(now))) {
      score -= 10;
      signals.push('Follow-up en retard');
    } else {
      score += 5;
      signals.push('Follow-up planifié');
    }
  }

  // 5. Has response → engagement
  if (lead.first_response_at) {
    score += 10;
    signals.push('Réponse obtenue');
  }

  // 6. Call proposed but not yet booked → close to conversion
  if (lead.status === 'appel_propose' && !lead.meeting_booked_at) {
    score += 5;
    signals.push('Proche du booking');
  }

  // 7. Stale leads penalty
  if (lead.last_status_change_at) {
    const daysSinceStatusChange = differenceInDays(now, new Date(lead.last_status_change_at));
    if (daysSinceStatusChange > 14 && !['rendez_vous_booke', 'ferme_perdu', 'non_qualifie'].includes(lead.status)) {
      score -= 10;
      signals.push(`Bloqué depuis ${daysSinceStatusChange}j`);
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Temperature
  let temperature: LeadTemperature;
  if (score >= 50) temperature = 'hot';
  else if (score >= 25) temperature = 'warm';
  else temperature = 'cold';

  return { score, temperature, signals };
}

// ── Hot opportunities ─────────────────────────────────────
// Signal display-only : un lead chaud proche du booking. Ne passe pas par le
// systeme de tasks (pas de date d'echeance naturelle), donc pas de
// fait/plus-tard/historique dessus — juste un encart informatif sur le
// dashboard, a cote des vraies actions (tasks).
export interface HotOpportunity {
  lead: Lead;
  reason: string;
}

export function getHotOpportunities(leads: Lead[]): HotOpportunity[] {
  return leads
    .filter((lead) => lead.status === 'appel_propose' && scoreLead(lead).temperature === 'hot')
    .map((lead) => ({ lead, reason: 'Lead chaud, proche du booking' }));
}

// ── User Alerts ──────────────────────────────────────────
export interface UserAlert {
  key: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
}

export function getUserAlerts(leads: Lead[]): UserAlert[] {
  const alerts: UserAlert[] = [];
  const activeLeads = leads.filter((l) => !['ferme_perdu', 'non_qualifie'].includes(l.status));
  const now = new Date();

  // Follow-ups en retard
  const overdueFollowUps = activeLeads.filter(
    (l) => l.status === 'follow_up' && l.follow_up_date && isBefore(new Date(l.follow_up_date), startOfDay(now))
  ).length;
  if (overdueFollowUps > 0) {
    alerts.push({
      key: 'overdue_followups', severity: 'high',
      title: `${overdueFollowUps} follow-up${overdueFollowUps > 1 ? 's' : ''} en retard`,
      description: 'Des leads attendent votre relance. Ne laissez pas ces opportunités refroidir.',
      action: 'Voir les follow-ups',
    });
  }

  // Volume de conversations (cette semaine)
  const thisWeekConversations = leads.filter((l) => {
    const d = l.conversation_started_at || l.created_at;
    return differenceInDays(now, new Date(d)) <= 7;
  }).length;
  if (thisWeekConversations < 5) {
    alerts.push({
      key: 'low_conversations', severity: 'medium',
      title: 'Volume de conversations faible',
      description: `Seulement ${thisWeekConversations} conversations cette semaine. Augmentez votre prospection.`,
      action: 'Créer des leads',
    });
  }

  // Taux de réponse
  const totalContacted = leads.filter((l) => l.conversation_started_at).length;
  const totalResponded = leads.filter((l) => l.first_response_at).length;
  const responseRate = totalContacted >= 10 ? Math.round((totalResponded / totalContacted) * 100) : -1;
  if (responseRate >= 0 && responseRate < 20) {
    alerts.push({
      key: 'low_response_rate', severity: 'medium',
      title: `Taux de réponse faible (${responseRate}%)`,
      description: 'Vos messages n\'obtiennent pas assez de réponses. Travaillez votre accroche.',
      action: 'Voir les scripts',
    });
  }

  // Pas assez d'appels proposés
  const respondedLeads = leads.filter((l) => l.first_response_at && !['ferme_perdu', 'non_qualifie'].includes(l.status));
  const callProposed = leads.filter((l) => l.call_proposed_at).length;
  if (respondedLeads.length >= 5 && callProposed < respondedLeads.length * 0.3) {
    alerts.push({
      key: 'low_calls', severity: 'medium',
      title: 'Pas assez d\'appels proposés',
      description: `Vous avez ${respondedLeads.length} réponses mais seulement ${callProposed} appels proposés. Convertissez !`,
      action: 'Proposer des appels',
    });
  }

  // Taux de booking faible
  const totalCalls = leads.filter((l) => l.call_proposed_at).length;
  const totalMeetings = leads.filter((l) => l.meeting_booked_at).length;
  const bookingRate = totalCalls >= 5 ? Math.round((totalMeetings / totalCalls) * 100) : -1;
  if (bookingRate >= 0 && bookingRate < 20) {
    alerts.push({
      key: 'low_booking', severity: 'low',
      title: `Taux de booking faible (${bookingRate}%)`,
      description: 'Beaucoup d\'appels proposés mais peu de RDV. Améliorez votre closing.',
      action: 'Voir les objections',
    });
  }

  return alerts;
}

// ── Coach Student Alerts ─────────────────────────────────
export type CoachAlertSeverity = 'high' | 'medium' | 'low';

export interface CoachStudentAlert {
  key: string;
  severity: CoachAlertSeverity;
  label: string;
  detail: string;
}

export function getCoachStudentAlerts(stats: {
  contacted: number;
  respRate: number;
  calls: number;
  rdv: number;
  bookRate: number;
  followUpOverdue: number;
  lost: number;
  unqualified: number;
  totalLeads: number;
}): CoachStudentAlert[] {
  const alerts: CoachStudentAlert[] = [];

  if (stats.followUpOverdue > 2) {
    alerts.push({ key: 'overdue', severity: 'high', label: `${stats.followUpOverdue} FU en retard`, detail: 'Manque de discipline sur le suivi' });
  }

  if (stats.contacted < 3) {
    alerts.push({ key: 'low_volume', severity: 'high', label: 'Faible volume', detail: `Seulement ${stats.contacted} conversations` });
  }

  if (stats.contacted >= 5 && stats.respRate < 15) {
    alerts.push({ key: 'low_resp', severity: 'high', label: `Taux réponse ${stats.respRate}%`, detail: 'Messages à retravailler' });
  } else if (stats.contacted >= 5 && stats.respRate < 25) {
    alerts.push({ key: 'medium_resp', severity: 'medium', label: `Taux réponse ${stats.respRate}%`, detail: 'Peut mieux faire sur l\'accroche' });
  }

  if (stats.contacted >= 5 && stats.calls === 0) {
    alerts.push({ key: 'no_calls', severity: 'high', label: 'Aucun appel proposé', detail: 'Ne propose pas d\'appels' });
  } else if (stats.contacted >= 8 && stats.calls < 2) {
    alerts.push({ key: 'few_calls', severity: 'medium', label: `${stats.calls} appel(s) proposé(s)`, detail: 'Faible passage en appel' });
  }

  if (stats.calls >= 3 && stats.bookRate < 15) {
    alerts.push({ key: 'low_book', severity: 'high', label: `Taux booking ${stats.bookRate}%`, detail: 'Ne convertit pas les appels en RDV' });
  } else if (stats.calls >= 3 && stats.bookRate < 30) {
    alerts.push({ key: 'medium_book', severity: 'medium', label: `Taux booking ${stats.bookRate}%`, detail: 'Taux de booking à améliorer' });
  }

  if (stats.totalLeads >= 10 && stats.lost > stats.totalLeads * 0.4) {
    alerts.push({ key: 'high_loss', severity: 'medium', label: `${stats.lost} pertes`, detail: 'Taux de perte élevé' });
  }

  if (stats.totalLeads >= 10 && stats.unqualified > stats.totalLeads * 0.3) {
    alerts.push({ key: 'high_unqual', severity: 'low', label: `${stats.unqualified} non qualifiés`, detail: 'Ciblage à revoir' });
  }

  // Sort by severity
  const sevOrder: Record<CoachAlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  return alerts;
}

// ── Temperature display helpers ──────────────────────────
export const TEMPERATURE_CONFIG: Record<LeadTemperature, { label: string; emoji: string; className: string }> = {
  hot:  { label: 'Chaud', emoji: '🔥', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  warm: { label: 'Tiède', emoji: '🟡', className: 'bg-warning/10 text-warning border-warning/20' },
  cold: { label: 'Froid', emoji: '❄️', className: 'bg-muted text-muted-foreground border-border' },
};
