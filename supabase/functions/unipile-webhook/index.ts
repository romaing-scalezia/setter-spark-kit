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

    const supabaseUrl    = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
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

    const { status, event, account_id, name } = payload as {
      status?: string;
      event?: string;
      account_id?: string;
      name?: string;
    };

    const eventType = status ?? event ?? "";

    if (!eventType || !account_id) {
      return jsonResponse({ received: true, error: "missing fields" }, 200);
    }

    // ── Connexion compte ──
    if (eventType === "CREATION_SUCCESS" || eventType === "RECONNECTED") {
      if (!name) {
        return jsonResponse({ received: true, error: "missing name (user_id)" }, 200);
      }
      const { error } = await admin
        .from("unipile_accounts")
        .upsert(
          { user_id: name, account_id, status: "connected", updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) console.error("[unipile-webhook] upsert error:", error);
      return jsonResponse({ received: true, action: "connected" }, 200);
    }

    // ── Acceptation d'invitation LinkedIn ──
    if (eventType === "INVITATION_ACCEPTED" || eventType === "CONNECTION_ACCEPTED") {
      const attendeeProviderId = (payload as any)?.provider_id
        ?? (payload as any)?.attendee?.provider_id;
      if (attendeeProviderId) {
        const now = new Date().toISOString();
        await admin
          .from("campaign_leads")
          .update({ accepted_at: now, status: "accepted" })
          .eq("provider_id", attendeeProviderId)
          .is("accepted_at", null);
      }
      return jsonResponse({ received: true, action: "accepted" }, 200);
    }

    // ── Message entrant → réponse reçue ──
    if (eventType === "message_received" || eventType === "NEW_MESSAGE" || eventType === "INCOMING_MESSAGE") {
      const networkDistance = (payload as any)?.sender?.attendee_specifics?.network_distance ?? "";
      const isSelf = networkDistance === "SELF";

      if (!isSelf) {
        const senderProviderId = (payload as any)?.sender?.attendee_provider_id
          ?? (payload as any)?.sender?.provider_id;

        if (senderProviderId) {
          const now = new Date().toISOString();

          // Récupère les leads concernés
          const { data: matchedLeads } = await admin
            .from("campaign_leads")
            .select("id")
            .eq("provider_id", senderProviderId)
            .not("messaged_1_at", "is", null)
            .is("replied_at", null);

          if (matchedLeads && matchedLeads.length > 0) {
            const leadIds = matchedLeads.map((l: any) => l.id);

            // Marque replied + done
            await admin
              .from("campaign_leads")
              .update({ replied_at: now, status: "completed" })
              .in("id", leadIds);

            // Annule les jobs pending suivants
            await admin
              .from("campaign_jobs")
              .update({ status: "cancelled", executed_at: now })
              .in("campaign_lead_id", leadIds)
              .eq("status", "pending");
          }
        }
      }
      return jsonResponse({ received: true, action: "replied" }, 200);
    }

    // ── Déconnexion compte ──
    const { error } = await admin
      .from("unipile_accounts")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("account_id", account_id ?? "");

    if (error) console.error("[unipile-webhook] update error:", error);
    return jsonResponse({ received: true, action: "disconnected" }, 200);

  } catch (err) {
    console.error("[unipile-webhook] unexpected error:", err);
    return jsonResponse({ received: true, error: String(err) }, 200);
  }
});
