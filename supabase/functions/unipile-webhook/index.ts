import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Always return 200 to prevent Unipile retry loops, even on errors.
  try {
    if (req.method !== "POST") {
      return jsonResponse({ received: true, ignored: "non-POST" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").service_role;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[unipile-webhook] Missing env vars");
      return jsonResponse({ received: true, error: "config" }, 200);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = await req.json().catch(() => null);
    console.log("[unipile-webhook] payload:", JSON.stringify(payload));

    if (!payload || typeof payload !== "object") {
      return jsonResponse({ received: true, error: "invalid payload" }, 200);
    }

    const { status, account_id, name } = payload as {
      status?: string;
      account_id?: string;
      name?: string;
    };

    if (!status || !account_id) {
      return jsonResponse({ received: true, error: "missing fields" }, 200);
    }

    if (status === "CREATION_SUCCESS" || status === "RECONNECTED") {
      if (!name) {
        return jsonResponse({ received: true, error: "missing name (user_id)" }, 200);
      }

      const { error } = await admin
        .from("unipile_accounts")
        .upsert(
          {
            user_id: name,
            account_id,
            status: "connected",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (error) {
        console.error("[unipile-webhook] upsert error:", error);
        return jsonResponse({ received: true, error: error.message }, 200);
      }

      return jsonResponse({ received: true, action: "connected" }, 200);
    }

    // Any other status (e.g. "CREDENTIALS") -> mark disconnected
    const { error } = await admin
      .from("unipile_accounts")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("account_id", account_id);

    if (error) {
      console.error("[unipile-webhook] update error:", error);
      return jsonResponse({ received: true, error: error.message }, 200);
    }

    return jsonResponse({ received: true, action: "disconnected" }, 200);
  } catch (err) {
    console.error("[unipile-webhook] unexpected error:", err);
    return jsonResponse({ received: true, error: String(err) }, 200);
  }
});