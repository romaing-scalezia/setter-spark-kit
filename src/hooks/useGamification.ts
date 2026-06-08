import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead } from '@/lib/constants';
import { computeScore, getLevel, BADGES, type BadgeContext } from '@/lib/gamification';
import { startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isBefore } from 'date-fns';

export function useGamification() {
  const { user } = useAuth();

  const { data: leads = [] } = useQuery({
    queryKey: ['gamification-leads', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').eq('owner_id', user!.id);
      return (data || []) as Lead[];
    },
    enabled: !!user,
  });

  const { data: streak = { current_streak: 0, longest_streak: 0 } } = useQuery({
    queryKey: ['user-streak', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_streak', { _user_id: user!.id });
      return (data as any)?.[0] || { current_streak: 0, longest_streak: 0 };
    },
    enabled: !!user,
  });

  const { data: unlockedBadges = [] } = useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_achievements').select('badge_key, unlocked_at').eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const now = new Date();
  const allTimeRange = { start: new Date('2020-01-01'), end: now };
  const weekRange = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  const monthRange = { start: startOfMonth(now), end: endOfMonth(now) };
  const todayRange = { start: startOfDay(now), end: now };

  const totalScore = computeScore(leads, allTimeRange);
  const weekScore = computeScore(leads, weekRange);
  const monthScore = computeScore(leads, monthRange);
  const todayScore = computeScore(leads, todayRange);
  const level = getLevel(totalScore);

  // Badge context
  const totalMeetings = leads.filter((l) => l.meeting_booked_at).length;
  const totalConversations = leads.filter((l) => l.conversation_started_at || l.created_at).length;
  const totalCalls = leads.filter((l) => l.call_proposed_at).length;
  const totalResponses = leads.filter((l) => l.first_response_at).length;
  const overdueFollowUps = leads.filter(
    (l) => l.status === 'follow_up' && l.follow_up_date && isBefore(new Date(l.follow_up_date), startOfDay(now))
  ).length;
  const responseRate = totalConversations > 0 ? Math.round((totalResponses / totalConversations) * 100) : 0;
  const bookingRate = totalCalls > 0 ? Math.round((totalMeetings / totalCalls) * 100) : 0;

  const badgeCtx: BadgeContext = {
    leads,
    totalMeetings,
    totalConversations,
    totalCalls,
    responseRate,
    bookingRate,
    currentStreak: streak.current_streak,
    overdueFollowUps,
  };

  const unlockedKeys = new Set(unlockedBadges.map((b) => b.badge_key));
  const earnedBadges = BADGES.filter((b) => b.check(badgeCtx));
  const newBadges = earnedBadges.filter((b) => !unlockedKeys.has(b.key));

  return {
    leads,
    totalScore,
    weekScore,
    monthScore,
    todayScore,
    level,
    streak,
    earnedBadges,
    allBadges: BADGES,
    unlockedKeys,
    newBadges,
    badgeCtx,
    todayRange,
    weekRange,
    monthRange,
  };
}

export function useLeaderboard(from: Date, to: Date, coachId?: string | null) {
  return useQuery({
    queryKey: ['leaderboard', from.toISOString(), to.toISOString(), coachId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        _from: from.toISOString(),
        _to: to.toISOString(),
        _coach_id: coachId || null,
      });
      if (error) throw error;
      return (data || []) as Array<{
        user_id: string;
        full_name: string;
        avatar_url: string | null;
        conversations: number;
        responses: number;
        calls_proposed: number;
        meetings_booked: number;
        score: number;
      }>;
    },
  });
}
