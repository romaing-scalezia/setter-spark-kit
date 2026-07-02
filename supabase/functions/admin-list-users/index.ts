import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.match(/^Bearer\s+/i) || !anonKey) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Auto-sync orphaned users
    const { data: existingProfiles } = await supabaseAdmin.from("profiles").select("id");
    const existingProfileIds = new Set((existingProfiles || []).map((p: any) => p.id));
    for (const u of users.filter((u: any) => !existingProfileIds.has(u.id))) {
      const fullName = u.user_metadata?.full_name || u.user_metadata?.name || "";
      await supabaseAdmin.from("profiles").upsert({ id: u.id, email: u.email, full_name: fullName, role: "user" }, { onConflict: "id" });
      await supabaseAdmin.from("user_roles").upsert({ user_id: u.id, role: "user" }, { onConflict: "user_id" });
      await supabaseAdmin.from("memberships").upsert({ user_id: u.id, plan: "free", status: "active" }, { onConflict: "user_id" });
    }

    // Fetch all enrichment data in parallel
    const [
      { data: profiles },
      { data: memberships },
      { data: roles },
      { data: assignments },
      { data: unipileAccounts },
      { data: leadCounts },
      { data: campaignJobs },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, avatar_url, role, debug_role_switch_enabled, onboarding_completed, source, business_type"),
      supabaseAdmin.from("memberships").select("user_id, plan, status, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("coach_assignments").select("*"),
      supabaseAdmin.from("unipile_accounts" as any).select("user_id, status, account_id"),
      supabaseAdmin.from("leads").select("owner_id"),
      supabaseAdmin.from("campaign_jobs" as any).select("id, status, error_message, created_at").eq("status", "error").order("created_at", { ascending: false }).limit(50),
    ]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const membershipMap = new Map((memberships || []).map((m: any) => [m.user_id, m]));
    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
    const unipileMap = new Map((unipileAccounts || []).map((a: any) => [a.user_id, a]));

    // Count leads per user
    const leadsCountMap = new Map<string, number>();
    for (const l of leadCounts || []) {
      leadsCountMap.set(l.owner_id, (leadsCountMap.get(l.owner_id) || 0) + 1);
    }

    const now = new Date();
    const enrichedUsers = users.map((u: any) => {
      const profile = profileMap.get(u.id) || {};
      const membership = membershipMap.get(u.id);
      const role = roleMap.get(u.id) || profile.role || "user";
      const unipile = unipileMap.get(u.id);
      const providers = (u.app_metadata?.providers || []) as string[];
      const provider = u.app_metadata?.provider || (providers.length > 0 ? providers[0] : "email");
      const coachOf = (assignments || []).filter((a: any) => a.coach_id === u.id).map((a: any) => a.user_id);
      const coachedBy = (assignments || []).filter((a: any) => a.user_id === u.id).map((a: any) => a.coach_id);

      let trialDaysLeft: number | null = null;
      if (membership?.status === "trialing" && membership?.current_period_end) {
        const end = new Date(membership.current_period_end);
        trialDaysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      return {
        id: u.id,
        email: u.email,
        full_name: profile.full_name || u.user_metadata?.full_name || null,
        avatar_url: profile.avatar_url || null,
        role,
        source: (profile as any).source || null,
        business_type: (profile as any).business_type || null,
        onboarding_completed: (profile as any).onboarding_completed || false,
        provider,
        providers,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        debug_role_switch_enabled: profile.debug_role_switch_enabled || false,
        membership: membership ? {
          plan: membership.plan,
          status: membership.status,
          current_period_end: membership.current_period_end,
          trial_days_left: trialDaysLeft,
          stripe_customer_id: membership.stripe_customer_id,
          stripe_subscription_id: membership.stripe_subscription_id,
        } : null,
        linkedin_connected: !!unipile && unipile.status === "connected",
        leads_count: leadsCountMap.get(u.id) || 0,
        coach_of: coachOf,
        coached_by: coachedBy,
      };
    });

    return new Response(JSON.stringify({ users: enrichedUsers, system: { failed_jobs: campaignJobs || [] } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
