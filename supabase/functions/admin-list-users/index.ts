import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("authorization") ??
      req.headers.get("Authorization");
    if (!authHeader?.match(/^Bearer\s+/i) || !anonKey) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the caller's identity first
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("user_id, role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (roleError || !roleData?.user_id) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all auth users (paginated, up to 1000)
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers(
      {
        page: 1,
        perPage: 1000,
      },
    );

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-sync: create missing profiles/roles/memberships for orphaned auth users
    const { data: existingProfiles } = await supabaseAdmin.from("profiles")
      .select("id");
    const existingProfileIds = new Set(
      (existingProfiles || []).map((p: any) => p.id),
    );
    const orphanedUsers = users.filter((u: any) =>
      !existingProfileIds.has(u.id)
    );

    for (const u of orphanedUsers) {
      const fullName = u.user_metadata?.full_name || u.user_metadata?.name ||
        "";
      await supabaseAdmin.from("profiles").upsert({
        id: u.id,
        email: u.email,
        full_name: fullName,
        role: "user",
      }, { onConflict: "id" });
      await supabaseAdmin.from("user_roles").upsert({
        user_id: u.id,
        role: "user",
      }, { onConflict: "user_id" });
      await supabaseAdmin.from("memberships").upsert({
        user_id: u.id,
        plan: "free",
        status: "active",
      }, { onConflict: "user_id" });
    }

    // Fetch profiles and memberships (after sync)
    const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
    const { data: memberships } = await supabaseAdmin.from("memberships")
      .select("*");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
    const { data: assignments } = await supabaseAdmin.from("coach_assignments")
      .select("*");

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const membershipMap = new Map(
      (memberships || []).map((m: any) => [m.user_id, m]),
    );
    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
    const assignmentList = assignments || [];

    const enrichedUsers = users.map((u: any) => {
      const profile = profileMap.get(u.id) || {};
      const membership = membershipMap.get(u.id);
      const role = roleMap.get(u.id) || profile.role || "user";

      // Determine provider
      const providers = (u.app_metadata?.providers || []) as string[];
      const provider = u.app_metadata?.provider ||
        (providers.length > 0 ? providers[0] : "email");

      // Coach assignments
      const coachOf = assignmentList.filter((a: any) => a.coach_id === u.id)
        .map((a: any) => a.user_id);
      const coachedBy = assignmentList.filter((a: any) => a.user_id === u.id)
        .map((a: any) => a.coach_id);

      return {
        id: u.id,
        email: u.email,
        full_name: profile.full_name || u.user_metadata?.full_name || null,
        avatar_url: profile.avatar_url || null,
        role,
        provider,
        providers,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        debug_role_switch_enabled: profile.debug_role_switch_enabled || false,
        membership: membership
          ? { plan: membership.plan, status: membership.status }
          : null,
        coach_of: coachOf,
        coached_by: coachedBy,
      };
    });

    return new Response(JSON.stringify({ users: enrichedUsers }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
