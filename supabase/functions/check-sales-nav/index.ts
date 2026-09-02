import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UNIPILE_BASE_URL = "https://api20.unipile.com:15052";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").service_role;
    const unipileKey     = Deno.env.get("UNIPILE_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !unipileKey) {
      return new Response("Missing env vars", { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Récupère tous les users avec un compte LinkedIn connecté
    const { data: accounts, error } = await admin
      .from("unipile_accounts")
      .select("user_id, account_id")
      .eq("status", "connected");

    if (error) throw error;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), { status: 200 });
    }

    let updated = 0;
    let errors  = 0;

    for (const { user_id, account_id } of accounts) {
      try {
        const meRes = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/me?account_id=${account_id}`, {
          headers: { "X-API-KEY": unipileKey, "accept": "application/json" },
        });

        if (!meRes.ok) {
          console.warn(`[check-sales-nav] /me failed for account ${account_id}: ${meRes.status}`);
          errors++;
          continue;
        }

        const meData = await meRes.json();
        // meData.sales_navigator est un objet meme deconnecte
        // ({ error: "DISCONNECTED" }), donc toujours "truthy" — il faut
        // verifier l'absence d'erreur, pas juste la presence de la cle.
        const salesNav = meData?.sales_navigator;
        const hasSalesNav = !!(
          (salesNav && !salesNav.error) ||
          meData?.premium_subscriber === true ||
          meData?.subscriptions?.some((s: any) =>
            typeof s === "string"
              ? s.toLowerCase().includes("sales")
              : s?.type?.toLowerCase?.()?.includes("sales")
          )
        );

        await admin
          .from("profiles")
          .update({ has_sales_nav: hasSalesNav, sales_nav_checked_at: new Date().toISOString() })
          .eq("id", user_id);

        updated++;
        console.log(`[check-sales-nav] user=${user_id} has_sales_nav=${hasSalesNav}`);

        // Délai pour éviter de spammer l'API Unipile
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`[check-sales-nav] error for user ${user_id}:`, err);
        errors++;
      }
    }

    return new Response(JSON.stringify({ checked: accounts.length, updated, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[check-sales-nav] fatal:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
