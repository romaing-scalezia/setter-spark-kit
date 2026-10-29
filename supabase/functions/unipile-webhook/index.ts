import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UNIPILE_BASE_URL = "https://api20.unipile.com:15052";

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

    // Support both flat payload and nested AccountStatus format
    const accountStatus = (payload as any)?.AccountStatus;
    const account_id: string | undefined = accountStatus?.account_id ?? (payload as any)?.account_id;
    const name: string | undefined = (payload as any)?.name;
    const status: string | undefined = accountStatus?.message ?? (payload as any)?.status;
    const event: string | undefined = (payload as any)?.event;
    // Sales Nav détecté directement depuis le payload Unipile
    const productIsSalesNav = (payload as any)?.Product === "sales_navigator";

    const eventType = status ?? event ?? "";

    if (!eventType || !account_id) {
      return jsonResponse({ received: true, error: "missing fields" }, 200);
    }

    // ── Connexion compte ──
    if (
      eventType === "CREATION_SUCCESS" ||
      eventType === "RECONNECTED" ||
      eventType === "SYNC_SUCCESS" ||
      eventType === "CONNECTED"
    ) {
      let userId: string | undefined;

      if (name) {
        // Flat format with user UUID in name field
        const { error } = await admin
          .from("unipile_accounts")
          .upsert(
            { user_id: name, account_id, status: "connected", updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          );
        if (error) console.error("[unipile-webhook] upsert error:", error);
        userId = name;
      } else {
        // Nested format (AccountStatus) — find user by existing account_id or skip
        const { data: existing } = await admin
          .from("unipile_accounts")
          .select("user_id")
          .eq("account_id", account_id)
          .maybeSingle();
        if (existing?.user_id) {
          await admin
            .from("unipile_accounts")
            .update({ status: "connected", updated_at: new Date().toISOString() })
            .eq("account_id", account_id);
          userId = existing.user_id;
        } else {
          console.warn("[unipile-webhook] SYNC_SUCCESS without name, account_id:", account_id);
          return jsonResponse({ received: true, action: "skipped_no_name" }, 200);
        }
      }

      // ── Détection Sales Navigator ──
      if (userId) {
        try {
          let hasSalesNav = productIsSalesNav;

          // Si le payload ne le précise pas, on appelle l'API Unipile pour vérifier
          if (!hasSalesNav) {
            const unipileKey = Deno.env.get("UNIPILE_API_KEY");
            if (unipileKey) {
              const meRes = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/me?account_id=${account_id}`, {
                headers: { "X-API-KEY": unipileKey, "accept": "application/json" },
              });
              if (meRes.ok) {
                const meData = await meRes.json();
                // meData.sales_navigator est un objet meme deconnecte
                // ({ error: "DISCONNECTED" }), donc toujours "truthy" — il faut
                // verifier l'absence d'erreur, pas juste la presence de la cle.
                const salesNav = meData?.sales_navigator;
                hasSalesNav = !!(
                  (salesNav && !salesNav.error) ||
                  meData?.premium_subscriber === true ||
                  meData?.subscriptions?.some((s: any) =>
                    typeof s === "string"
                      ? s.toLowerCase().includes("sales")
                      : s?.type?.toLowerCase?.()?.includes("sales")
                  )
                );
              }
            }
          }

          await admin
            .from("profiles")
            .update({ has_sales_nav: hasSalesNav, sales_nav_checked_at: new Date().toISOString() })
            .eq("id", userId);
          console.log(`[unipile-webhook] has_sales_nav=${hasSalesNav} for user ${userId} (source: ${productIsSalesNav ? 'payload' : 'api'})`);
        } catch (err) {
          console.error("[unipile-webhook] sales nav check error:", err);
        }
      }

      return jsonResponse({ received: true, action: "connected" }, 200);
    }

    // ── Acceptation d'invitation LinkedIn ──
    if (
      eventType === "INVITATION_ACCEPTED" ||
      eventType === "CONNECTION_ACCEPTED" ||
      eventType === "new_relation"
    ) {
      const attendeeProviderId = (payload as any)?.provider_id
        ?? (payload as any)?.attendee?.provider_id
        ?? (payload as any)?.user_provider_id;
      if (attendeeProviderId) {
        const now = new Date().toISOString();
        const { data: updatedLeads, error } = await admin
          .from("campaign_leads")
          .update({ accepted_at: now, status: "accepted" })
          .eq("provider_id", attendeeProviderId)
          .is("accepted_at", null)
          .select("id, campaign_id, user_id, first_name, last_name, company_name, linkedin_url");

        if (error) {
          console.error("[unipile-webhook] accepted update error:", error);
        } else {
          console.log("[unipile-webhook] accepted update matched rows:", updatedLeads?.length ?? 0);

          // Scenario A (visite + invitation, sans message automatise) : il n'y a
          // pas de job "message_1" pour detecter l'acceptation et creer le lead
          // + la tache de suivi (contrairement aux scenarios B/C/D). On le fait
          // ici, directement a l'acceptation, avec une tache "Demarrer la
          // conversation" plutot que "Relancer la conversation" puisqu'aucun
          // message n'a encore ete envoye.
          for (const cl of updatedLeads ?? []) {
            const { data: campaign } = await admin
              .from("campaigns")
              .select("scenario_type")
              .eq("id", cl.campaign_id)
              .maybeSingle();
            if (campaign?.scenario_type !== "A") continue;

            const { data: existingLead } = await admin
              .from("leads")
              .select("id")
              .eq("owner_id", cl.user_id)
              .eq("linkedin_url", cl.linkedin_url)
              .maybeSingle();

            let leadId = existingLead?.id;
            if (!leadId) {
              const { data: newLead, error: leadInsertError } = await admin.from("leads").insert({
                owner_id:                cl.user_id,
                first_name:              cl.first_name,
                last_name:               cl.last_name,
                company_name:            cl.company_name,
                linkedin_url:            cl.linkedin_url,
                status:                  "conversation_engagee",
                outreach_type:           "autre",
                conversation_started_at: now,
              }).select("id").single();
              if (leadInsertError) console.error("[unipile-webhook] scenario A leads insert failed:", leadInsertError);
              leadId = newLead?.id;

              if (leadId) {
                await admin.from("lead_events").insert({
                  lead_id: leadId, user_id: cl.user_id,
                  event_type: "status_changed", new_value: "conversation_engagee",
                });
              }
            }

            if (leadId) {
              // L'insert ci-dessus declenche handle_lead_status_task(), qui cree
              // automatiquement un "conversation_followup" — on le remplace par
              // "start_conversation", plus juste pour ce cas (rien n'a ete envoye).
              await admin.from("tasks")
                .update({ status: "cancelled", updated_at: now })
                .eq("lead_id", leadId)
                .eq("status", "pending")
                .eq("task_type", "conversation_followup")
                .eq("source", "auto");

              await admin.from("tasks").insert({
                lead_id: leadId, user_id: cl.user_id, task_type: "start_conversation",
                priority: "high", due_date: now.slice(0, 10), source: "auto",
              });
            }
          }
        }
      } else {
        console.warn("[unipile-webhook] acceptance event without provider id:", eventType);
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

          // Récupère les leads concernés. On exigeait auparavant messaged_1_at
          // non nul, mais une note d'invitation (message joint à la demande de
          // connexion) peut recevoir une réponse avant même l'envoi de
          // message_1 — cette réponse n'était alors jamais comptabilisée.
          // invited_at suffit : le prospect a bien été contacté par la campagne.
          const { data: matchedLeads } = await admin
            .from("campaign_leads")
            .select("id")
            .eq("provider_id", senderProviderId)
            .not("invited_at", "is", null)
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

    // ── Déconnexion compte — seulement sur events explicites ──
    if (eventType === "DISCONNECTED" || eventType === "ACCOUNT_DISCONNECTED" || eventType === "ERROR") {
      const { error } = await admin
        .from("unipile_accounts")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("account_id", account_id ?? "");
      if (error) console.error("[unipile-webhook] update error:", error);
      return jsonResponse({ received: true, action: "disconnected" }, 200);
    }

    // Event inconnu → on ignore sans toucher au statut
    console.log("[unipile-webhook] unhandled event, ignored:", eventType);
    return jsonResponse({ received: true, action: "ignored", event: eventType }, 200);

  } catch (err) {
    console.error("[unipile-webhook] unexpected error:", err);
    return jsonResponse({ received: true, error: String(err) }, 200);
  }
});
