import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_BASE_URL = "https://api.apollo.io";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").service_role;
    const apolloKey = Deno.env.get("APOLLO_API_KEY");

    if (!apolloKey || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Missing env vars" }, 500);

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (roleData?.role !== "admin") return jsonResponse({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { apollo_ids, list_id, new_list_name } = body as { apollo_ids: string[]; list_id?: string; new_list_name?: string };

    if (!Array.isArray(apollo_ids) || apollo_ids.length === 0) {
      return jsonResponse({ error: "missing apollo_ids" }, 400);
    }
    if (!list_id && !new_list_name?.trim()) {
      return jsonResponse({ error: "missing list_id or new_list_name" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // ── Garde-fou credits (approximatif, cf. commentaire sur apollo_usage) ──
    const { data: usage } = await admin.from("apollo_usage" as any).select("*").eq("user_id", caller.id).maybeSingle();
    const enrichmentsUsed = (usage as any)?.enrichments_used ?? 0;
    const safetyCap = (usage as any)?.safety_cap ?? 40;
    if (enrichmentsUsed + apollo_ids.length > safetyCap) {
      return jsonResponse({
        error: "safety_cap_exceeded",
        enrichments_used: enrichmentsUsed,
        safety_cap: safetyCap,
        requested: apollo_ids.length,
      }, 400);
    }

    // ── Liste cible ──
    let targetListId = list_id;
    if (!targetListId) {
      const { data: newList, error: listErr } = await admin
        .from("prospect_lists" as any)
        .insert({ user_id: caller.id, name: new_list_name!.trim() })
        .select("id")
        .single();
      if (listErr) throw listErr;
      targetListId = (newList as any).id;
    } else {
      const { data: owned } = await admin.from("prospect_lists" as any).select("id").eq("id", targetListId).eq("user_id", caller.id).maybeSingle();
      if (!owned) return jsonResponse({ error: "list not found" }, 404);
    }

    // ── Enrichissement (sequentiel, appels individuels pour rester simple/fiable) ──
    const added: unknown[] = [];
    const errors: unknown[] = [];
    let successCount = 0;

    for (const apolloId of apollo_ids) {
      try {
        const res = await fetch(`${APOLLO_BASE_URL}/api/v1/people/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": apolloKey },
          body: JSON.stringify({ id: apolloId }),
        });
        const data = await res.json();
        if (!res.ok || !data?.person) {
          errors.push({ apollo_id: apolloId, details: data });
          continue;
        }
        const p = data.person;
        if (!p.linkedin_url) {
          errors.push({ apollo_id: apolloId, details: "no_linkedin_url" });
          continue;
        }
        const { data: inserted, error: insertErr } = await admin.from("prospect_list_items" as any).insert({
          list_id: targetListId,
          apollo_id: apolloId,
          linkedin_url: p.linkedin_url,
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          company_name: p.organization?.name ?? null,
          job_title: p.title ?? null,
          email: p.email ?? null,
        }).select("*").single();
        if (insertErr) {
          errors.push({ apollo_id: apolloId, details: insertErr.message });
          continue;
        }
        added.push(inserted);
        successCount++;
      } catch (err) {
        errors.push({ apollo_id: apolloId, details: String(err) });
      }
    }

    if (successCount > 0) {
      await admin.from("apollo_usage" as any).upsert({
        user_id: caller.id,
        enrichments_used: enrichmentsUsed + successCount,
        safety_cap: safetyCap,
        updated_at: new Date().toISOString(),
      });
    }

    return jsonResponse({ list_id: targetListId, added, errors, enrichments_used: enrichmentsUsed + successCount, safety_cap: safetyCap });
  } catch (err) {
    console.error("[apollo-enrich] fatal:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
