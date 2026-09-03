import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_BASE_URL = "https://api.apollo.io";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// Feature en mode test (pas de contrat de partenariat Apollo) — reservee a
// l'admin, pas de rollout utilisateurs pour l'instant.
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const APOLLO_FILTERS_TOOL = {
  name: "apollo_filters",
  description: "Structured Apollo.io people-search filters extracted from a natural language prospecting request. Omit any field that isn't clearly implied by the request.",
  input_schema: {
    type: "object",
    properties: {
      person_titles: { type: "array", items: { type: "string" }, description: "Job titles to search for, e.g. 'sales director'" },
      person_seniorities: {
        type: "array",
        items: { type: "string", enum: ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager", "senior", "entry", "intern"] },
      },
      person_locations: { type: "array", items: { type: "string" }, description: "Where the PERSON is based (city/region/country)" },
      organization_locations: { type: "array", items: { type: "string" }, description: "Where the COMPANY is headquartered" },
      q_keywords: { type: "string", description: "Free-text keywords (e.g. industry jargon) not covered by the other fields" },
      organization_num_employees_ranges: {
        type: "array",
        items: { type: "string" },
        description: "Company headcount ranges formatted as 'min,max', e.g. '10,200'",
      },
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const apolloKey = Deno.env.get("APOLLO_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apolloKey || !anonKey) return jsonResponse({ error: "Missing env vars" }, 500);

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (roleData?.role !== "admin") return jsonResponse({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { query, filters: manualFilters, page = 1, per_page = 25 } = body;

    let filters: Record<string, unknown> = manualFilters ?? {};

    if (query && !manualFilters) {
      if (!anthropicKey) return jsonResponse({ error: "Missing ANTHROPIC_API_KEY" }, 500);

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          tools: [APOLLO_FILTERS_TOOL],
          tool_choice: { type: "tool", name: "apollo_filters" },
          messages: [{ role: "user", content: query }],
        }),
      });

      if (!claudeRes.ok) {
        const details = await claudeRes.text();
        return jsonResponse({ error: "claude_error", details }, 502);
      }

      const claudeData = await claudeRes.json();
      const toolUse = claudeData?.content?.find((c: any) => c.type === "tool_use");
      filters = toolUse?.input ?? {};
    }

    const apolloRes = await fetch(`${APOLLO_BASE_URL}/api/v1/mixed_people/api_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": apolloKey },
      body: JSON.stringify({ ...filters, page, per_page }),
    });
    const apolloData = await apolloRes.json();

    if (!apolloRes.ok) {
      return jsonResponse({ error: "apollo_error", details: apolloData }, apolloRes.status);
    }

    return jsonResponse({
      filters,
      people: apolloData.people ?? [],
      total_entries: apolloData.total_entries ?? 0,
      page,
      per_page,
    });
  } catch (err) {
    console.error("[apollo-search] fatal:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
