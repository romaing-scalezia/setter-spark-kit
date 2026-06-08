import type { Lead } from '@/lib/constants';
import { startOfDay, startOfWeek, endOfWeek, isWithinInterval, isBefore } from 'date-fns';

// ── Score weights ──────────────────────────────────────────────
export const SCORE_WEIGHTS = {
  conversation: 1,
  response: 3,
  call_proposed: 5,
  meeting_booked: 10,
  follow_up_on_time: 2,
} as const;

// ── Badge definitions ──────────────────────────────────────────
export interface BadgeDef {
  key: string;
  label: string;
  description: string;
  icon: string; // emoji
  check: (ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  leads: Lead[];
  totalMeetings: number;
  totalConversations: number;
  totalCalls: number;
  responseRate: number;
  bookingRate: number;
  currentStreak: number;
  overdueFollowUps: number;
}

export const BADGES: BadgeDef[] = [
  {
    key: 'first_meeting',
    label: 'Premier RDV',
    description: 'Booker votre premier rendez-vous',
    icon: '🎯',
    check: (ctx) => ctx.totalMeetings >= 1,
  },
  {
    key: 'five_meetings',
    label: '5 RDV',
    description: 'Booker 5 rendez-vous au total',
    icon: '🔥',
    check: (ctx) => ctx.totalMeetings >= 5,
  },
  {
    key: 'ten_meetings',
    label: '10 RDV',
    description: 'Booker 10 rendez-vous au total',
    icon: '💎',
    check: (ctx) => ctx.totalMeetings >= 10,
  },
  {
    key: 'fifty_conversations',
    label: '50 conversations',
    description: 'Engager 50 conversations au total',
    icon: '💬',
    check: (ctx) => ctx.totalConversations >= 50,
  },
  {
    key: 'twenty_calls',
    label: '20 appels proposés',
    description: 'Proposer 20 appels au total',
    icon: '📞',
    check: (ctx) => ctx.totalCalls >= 20,
  },
  {
    key: 'seven_day_streak',
    label: '7 jours consécutifs',
    description: '7 jours d\'activité consécutifs',
    icon: '⚡',
    check: (ctx) => ctx.currentStreak >= 7,
  },
  {
    key: 'thirty_day_streak',
    label: '30 jours consécutifs',
    description: '30 jours d\'activité consécutifs',
    icon: '🏆',
    check: (ctx) => ctx.currentStreak >= 30,
  },
  {
    key: 'zero_overdue',
    label: 'Zéro retard',
    description: 'Aucun follow-up en retard',
    icon: '✅',
    check: (ctx) => ctx.leads.some((l) => l.status === 'follow_up') && ctx.overdueFollowUps === 0,
  },
  {
    key: 'great_response_rate',
    label: 'Excellent taux de réponse',
    description: 'Taux de réponse supérieur à 50%',
    icon: '📈',
    check: (ctx) => ctx.totalConversations >= 10 && ctx.responseRate >= 50,
  },
  {
    key: 'great_booking_rate',
    label: 'Excellent taux de booking',
    description: 'Taux de booking supérieur à 30%',
    icon: '🚀',
    check: (ctx) => ctx.totalCalls >= 5 && ctx.bookingRate >= 30,
  },
];

// ── Missions ───────────────────────────────────────────────────
export interface Mission {
  key: string;
  label: string;
  target: number;
  unit: string;
  getValue: (leads: Lead[], range: { start: Date; end: Date }) => number;
}

function inRange(value: string | null | undefined, range: { start: Date; end: Date }): boolean {
  if (!value) return false;
  return isWithinInterval(new Date(value), range);
}

export const DAILY_MISSIONS: Mission[] = [
  {
    key: 'daily_conversations',
    label: 'Conversations engagées',
    target: 5,
    unit: 'conversations',
    getValue: (leads, range) =>
      leads.filter((l) => inRange(l.conversation_started_at || l.created_at, range)).length,
  },
  {
    key: 'daily_calls',
    label: 'Appels proposés',
    target: 2,
    unit: 'appels',
    getValue: (leads, range) =>
      leads.filter((l) => inRange(l.call_proposed_at, range)).length,
  },
  {
    key: 'daily_meetings',
    label: 'RDV bookés',
    target: 1,
    unit: 'RDV',
    getValue: (leads, range) =>
      leads.filter((l) => inRange(l.meeting_booked_at, range)).length,
  },
];

export const WEEKLY_MISSIONS: Mission[] = [
  {
    key: 'weekly_conversations',
    label: 'Conversations engagées',
    target: 25,
    unit: 'conversations',
    getValue: (leads, range) =>
      leads.filter((l) => inRange(l.conversation_started_at || l.created_at, range)).length,
  },
  {
    key: 'weekly_calls',
    label: 'Appels proposés',
    target: 10,
    unit: 'appels',
    getValue: (leads, range) =>
      leads.filter((l) => inRange(l.call_proposed_at, range)).length,
  },
  {
    key: 'weekly_meetings',
    label: 'RDV bookés',
    target: 3,
    unit: 'RDV',
    getValue: (leads, range) =>
      leads.filter((l) => inRange(l.meeting_booked_at, range)).length,
  },
  {
    key: 'weekly_zero_overdue',
    label: 'Follow-ups sans retard',
    target: 1,
    unit: '',
    getValue: (leads) => {
      const overdue = leads.filter(
        (l) => l.status === 'follow_up' && l.follow_up_date && isBefore(new Date(l.follow_up_date), startOfDay(new Date()))
      ).length;
      return overdue === 0 ? 1 : 0;
    },
  },
];

// ── Score computation ──────────────────────────────────────────
export function computeScore(leads: Lead[], range: { start: Date; end: Date }): number {
  let score = 0;
  for (const l of leads) {
    if (inRange(l.conversation_started_at || l.created_at, range)) score += SCORE_WEIGHTS.conversation;
    if (inRange(l.first_response_at, range)) score += SCORE_WEIGHTS.response;
    if (inRange(l.call_proposed_at, range)) score += SCORE_WEIGHTS.call_proposed;
    if (inRange(l.meeting_booked_at, range)) score += SCORE_WEIGHTS.meeting_booked;
  }
  // Follow-up on-time bonus
  const followUps = leads.filter((l) => l.status !== 'follow_up' && l.follow_up_date);
  for (const l of followUps) {
    if (l.follow_up_date && inRange(l.follow_up_date, range)) {
      score += SCORE_WEIGHTS.follow_up_on_time;
    }
  }
  return score;
}

// ── Level system ───────────────────────────────────────────────
export function getLevel(totalScore: number): { level: number; title: string; nextThreshold: number; progress: number } {
  const LEVELS = [
    { threshold: 0, title: 'Débutant' },
    { threshold: 25, title: 'Actif' },
    { threshold: 75, title: 'Confirmé' },
    { threshold: 150, title: 'Performant' },
    { threshold: 300, title: 'Expert' },
    { threshold: 500, title: 'Élite' },
    { threshold: 1000, title: 'Légende' },
  ];

  let currentLevel = LEVELS[0];
  let nextThreshold = LEVELS[1]?.threshold || Infinity;

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalScore >= LEVELS[i].threshold) {
      currentLevel = LEVELS[i];
      nextThreshold = LEVELS[i + 1]?.threshold || LEVELS[i].threshold * 2;
      break;
    }
  }

  const progress = Math.min(
    100,
    Math.round(((totalScore - currentLevel.threshold) / (nextThreshold - currentLevel.threshold)) * 100)
  );

  return {
    level: LEVELS.indexOf(currentLevel) + 1,
    title: currentLevel.title,
    nextThreshold,
    progress,
  };
}
