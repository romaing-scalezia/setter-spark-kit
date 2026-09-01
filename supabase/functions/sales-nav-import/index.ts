import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UNIPILE_BASE_URL = "https://api20.unipile.com:15052";

// Supprime emojis, caractères de contrôle et espaces superflus
function cleanName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "") // emojis
    .replace(/[^\p{L}\p{N}\p{M}\s'\-\.]/gu, "")                        // garde lettres, chiffres, apostrophes, tirets, points
    .replace(/\s+/g, " ")                                                // espaces multiples
    .trim();
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").service_role;
    const unipileKey     = Deno.env.get("UNIPILE_API_KEY")!;

    // Auth : récupère l'utilisateur depuis le JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action, url, limit = 2500, cursor: startCursor = null } = body;

    // ── Action : preview — récupère les prospects depuis Unipile ──────────────
    if (action === "preview") {
      if (!url) return jsonResponse({ error: "missing url" }, 400);

      // Récupère le compte Unipile de l'utilisateur
      const { data: account } = await admin
        .from("unipile_accounts")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("status", "connected")
        .maybeSingle();

      if (!account?.account_id) {
        return jsonResponse({ error: "no_linkedin_account" }, 400);
      }

      // Pagination Unipile : max 100 par page, on boucle jusqu'à 2500 ou fin de liste
      // startCursor permet de reprendre là où on s'est arrêté (bouton "Charger plus")
      const maxResults = Math.min(limit, 2500);
      const items: any[] = [];
      let cursor: string | null = startCursor;
      let nextCursor: string | null = null;

      while (items.length < maxResults) {
        const pageLimit = Math.min(100, maxResults - items.length);
        const qs = new URLSearchParams({
          account_id: account.account_id,
          limit:      String(pageLimit),
          ...(cursor ? { cursor } : {}),
        });

        const searchRes = await fetch(`${UNIPILE_BASE_URL}/api/v1/linkedin/search?${qs}`, {
          method: "POST",
          headers: {
            "X-API-KEY": unipileKey,
            "accept":     "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ url }),
        });

        if (!searchRes.ok) {
          const err = await searchRes.text();
          console.error("[sales-nav-import] Unipile search error:", err);

          // Session Sales Navigator expirée côté Unipile (distincte de la connexion
          // LinkedIn générale, qui peut rester "connected" — voir /users/me.sales_navigator).
          // On le signale precisement pour proposer une reconnexion cablee sur le meme
          // account_id plutot qu'un message generique inexploitable.
          const looksExpired = searchRes.status === 401 || /expired_credentials/i.test(err);
          if (looksExpired) {
            return jsonResponse({ error: "linkedin_reauth_required", account_id: account.account_id }, 400);
          }

          return jsonResponse({ error: "unipile_error", details: err }, 400);
        }

        const page = await searchRes.json();
        const pageItems: any[] = page?.items ?? [];
        items.push(...pageItems);

        console.log(`[sales-nav-import] page items: ${pageItems.length}, paging:`, JSON.stringify(page?.paging ?? null));
        cursor = page?.paging?.next_cursor ?? page?.paging?.cursor ?? page?.cursor ?? null;
        if (!cursor || pageItems.length < pageLimit) {
          nextCursor = null;
          break;
        }
        nextCursor = cursor; // il reste des résultats après cette batch
      }

      if (items.length > 0) console.log("[sales-nav-import] raw item[0]:", JSON.stringify(items[0]));
      console.log(`[sales-nav-import] fetched: ${items.length}, has_more: ${!!nextCursor}`);

      // Normalise les profils
      const prospects = items.map((item: any) => ({
        provider_id:  item.provider_id ?? item.id ?? null,
        first_name:   cleanName(item.first_name ?? item.firstName),
        last_name:    cleanName(item.last_name ?? item.lastName),
        headline:     item.headline ?? item.occupation ?? null,
        company_name: item.company_name ?? item.current_company?.name ?? item.current_positions?.[0]?.company ?? null,
        job_title:    item.job_title ?? item.current_positions?.[0]?.role ?? item.headline ?? null,
        linkedin_url: item.public_profile_url ?? (item.public_identifier
          ? `https://www.linkedin.com/in/${item.public_identifier}/`
          : null),
        location:     item.location ?? null,
      }));

      // Vérification des doublons via linkedin_url
      const linkedinUrls = prospects
        .map((p) => p.linkedin_url)
        .filter(Boolean);

      const [existingLeads, activeCampaignLeads] = await Promise.all([
        admin.from("leads")
          .select("linkedin_url")
          .eq("owner_id", user.id)
          .in("linkedin_url", linkedinUrls),
        admin.from("campaign_leads" as any)
          .select("linkedin_url")
          .eq("user_id", user.id)
          .in("linkedin_url", linkedinUrls)
          .not("status", "in", "(completed,cancelled)"),
      ]);

      const inCrm      = new Set((existingLeads.data ?? []).map((l: any) => l.linkedin_url));
      const inCampaign = new Set((activeCampaignLeads.data ?? []).map((l: any) => l.linkedin_url));

      const enriched = prospects.map((p) => ({
        ...p,
        status: inCampaign.has(p.linkedin_url)
          ? "in_campaign"
          : inCrm.has(p.linkedin_url)
          ? "in_crm"
          : "new",
      }));

      const summary = {
        total:       enriched.length,
        new:         enriched.filter((p) => p.status === "new").length,
        in_crm:      enriched.filter((p) => p.status === "in_crm").length,
        in_campaign: enriched.filter((p) => p.status === "in_campaign").length,
        paging:      null,
      };

      return jsonResponse({ prospects: enriched, summary, next_cursor: nextCursor });
    }

    // ── Action : confirm — vérifie le quota et le réserve ───────────────────
    // L'insertion réelle dans campaign_leads se fait côté front au lancement
    if (action === "confirm") {
      const { count }: { count: number } = body;
      if (!count || count <= 0) return jsonResponse({ error: "invalid count" }, 400);

      const quotaRes = await admin.rpc("increment_prospect_imports", {
        p_user_id: user.id,
        p_count:   count,
      });

      if (quotaRes.data?.error === "quota_exceeded") {
        return jsonResponse({
          error:   "quota_exceeded",
          current: quotaRes.data.current,
          quota:   quotaRes.data.quota,
        }, 400);
      }

      return jsonResponse({ ok: true, counted: count });
    }

    return jsonResponse({ error: "unknown action" }, 400);

  } catch (err) {
    console.error("[sales-nav-import] fatal:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
