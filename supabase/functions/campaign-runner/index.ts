import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UNIPILE_BASE_URL = "https://api15.unipile.com:14546";
const MAX_VISITS_PER_DAY   = 80;
const MAX_INVITES_PER_DAY  = 20;
const MAX_MESSAGES_PER_DAY = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function unipileRequest(path: string, method: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${UNIPILE_BASE_URL}${path}`, {
    method,
    headers: {
      "X-API-KEY": apiKey,
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

function actionTypeToStepOrder(actionType: string): number {
  if (actionType === "visit")     return 1;
  if (actionType === "invite")    return 2;
  if (actionType === "message_1") return 3;
  if (actionType === "message_2") return 4;
  if (actionType === "message_3") return 5;
  return 0;
}

function stepToJobActionType(actionType: string, stepOrder: number): string {
  if (actionType === "visit")   return "visit";
  if (actionType === "invite")  return "invite";
  if (actionType === "message") return `message_${stepOrder - 2}`;
  return actionType;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey         = Deno.env.get("UNIPILE_API_KEY");
  const supabaseUrl    = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").service_role;

  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing env vars" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();

  const { data: jobs, error: jobsError } = await admin
    .from("campaign_jobs")
    .select("*, campaign_leads(*), campaigns(user_id)")
    .eq("status", "pending")
    .lte("execute_at", now)
    .order("execute_at", { ascending: true })
    .limit(100);

  if (jobsError) return jsonResponse({ error: jobsError.message }, 500);
  if (!jobs || jobs.length === 0) return jsonResponse({ processed: 0 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dailyCounts: Record<string, { visits: number; invites: number; messages: number }> = {};

  async function getDailyCount(userId: string) {
    if (dailyCounts[userId]) return dailyCounts[userId];
    const { data } = await admin
      .from("campaign_jobs")
      .select("action_type")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("executed_at", todayStart.toISOString());
    const counts = { visits: 0, invites: 0, messages: 0 };
    for (const j of data ?? []) {
      if (j.action_type === "visit")                counts.visits++;
      else if (j.action_type === "invite")          counts.invites++;
      else if (j.action_type.startsWith("message")) counts.messages++;
    }
    dailyCounts[userId] = counts;
    return counts;
  }

  async function scheduleNextStep(job: any, lead: any) {
    const currentStepOrder = actionTypeToStepOrder(job.action_type);
    const { data: nextStep } = await admin
      .from("campaign_steps")
      .select("step_order, action_type, delay_days")
      .eq("campaign_id", job.campaign_id)
      .eq("step_order", currentStepOrder + 1)
      .maybeSingle();

    if (!nextStep) {
      // Séquence terminée → marque le lead comme done
      await admin.from("campaign_leads")
        .update({ status: "completed" })
        .eq("id", lead.id);
      return;
    }

    const executeAt = new Date(
      Date.now() + nextStep.delay_days * 24 * 60 * 60 * 1000
    ).toISOString();

    await admin.from("campaign_jobs").insert({
      campaign_id:      job.campaign_id,
      campaign_lead_id: lead.id,
      user_id:          job.user_id,
      action_type:      stepToJobActionType(nextStep.action_type, nextStep.step_order),
      status:           "pending",
      execute_at:       executeAt,
    });
  }

  let processed = 0;

  for (const job of jobs) {
    const lead   = job.campaign_leads;
    const userId = job.user_id;
    const counts = await getDailyCount(userId);

    if (job.action_type === "visit"   && counts.visits   >= MAX_VISITS_PER_DAY)   continue;
    if (job.action_type === "invite"  && counts.invites  >= MAX_INVITES_PER_DAY)  continue;
    if (job.action_type.startsWith("message") && counts.messages >= MAX_MESSAGES_PER_DAY) continue;

    await admin.from("campaign_jobs").update({ status: "running" }).eq("id", job.id);

    const { data: unipileAccount } = await admin
      .from("unipile_accounts")
      .select("account_id")
      .eq("user_id", userId)
      .single();

    if (!unipileAccount) {
      await admin.from("campaign_jobs").update({
        status: "failed",
        error_message: "No Unipile account",
        executed_at: now,
      }).eq("id", job.id);
      continue;
    }

    const accountId = unipileAccount.account_id;
    let success  = false;
    let errorMsg = "";

    try {

      /* ── VISIT ── */
      if (job.action_type === "visit") {
        const slug = lead.linkedin_url.split("/in/")[1]?.replace(/\/$/, "") ?? lead.provider_id;
        const res = await unipileRequest(
          `/api/v1/users/${encodeURIComponent(slug)}?account_id=${accountId}&notify=true`,
          "GET", apiKey
        );
        if (res.ok) {
          const updateData: Record<string, string> = { status: "visiting" };
          if (!lead.provider_id && res.data?.provider_id) {
            updateData.provider_id = res.data.provider_id;
          }
          await admin.from("campaign_leads").update(updateData).eq("id", lead.id);
          success = true;
          counts.visits++;
        } else {
          errorMsg = JSON.stringify(res.data);
        }

      /* ── INVITE ── */
      } else if (job.action_type === "invite") {
        let providerId = lead.provider_id;

        if (!providerId) {
          const slug = lead.linkedin_url.split("/in/")[1]?.replace(/\/$/, "");
          const lookupRes = await unipileRequest(
            `/api/v1/users/${encodeURIComponent(slug)}?account_id=${accountId}`,
            "GET", apiKey
          );
          if (lookupRes.ok && lookupRes.data?.provider_id) {
            providerId = lookupRes.data.provider_id;
            await admin.from("campaign_leads").update({ provider_id: providerId }).eq("id", lead.id);
          }
        }

        if (!providerId) {
          errorMsg = "Missing provider_id for invite";
        } else {
          const { data: step } = await admin
            .from("campaign_steps")
            .select("message_content")
            .eq("campaign_id", job.campaign_id)
            .eq("action_type", "invite")
            .single();

          const message = step?.message_content
            ? step.message_content
                .replace(/{{first_name}}/g,   lead.first_name   ?? "")
                .replace(/{{last_name}}/g,    lead.last_name    ?? "")
                .replace(/{{company_name}}/g, lead.company_name ?? "")
            : undefined;

          const res = await unipileRequest("/api/v1/users/invite", "POST", apiKey, {
            provider_id: providerId,
            account_id:  accountId,
            ...(message ? { message } : {}),
          });

          if (res.ok) {
            await admin.from("campaign_leads")
              .update({ status: "invited", invited_at: now })
              .eq("id", lead.id);
            success = true;
            counts.invites++;
          } else {
            errorMsg = JSON.stringify(res.data);
          }
        }

      /* ── MESSAGE ── */
      } else if (job.action_type.startsWith("message")) {

        // Si le lead a déjà répondu, on annule le job sans envoyer
        if (lead.replied_at) {
          await admin.from("campaign_jobs")
            .update({ status: "cancelled", executed_at: now })
            .eq("id", job.id);
          continue;
        }

        // message_1 : vérifie que la connexion est acceptée
        if (job.action_type === "message_1" && !lead.accepted_at) {
          let isConnected = false;
          if (lead.provider_id) {
            const checkRes = await unipileRequest(
              `/api/v1/users/${encodeURIComponent(lead.provider_id)}?account_id=${accountId}`,
              "GET", apiKey
            );
            if (checkRes.ok) {
              console.log("[check-connection]", JSON.stringify(checkRes.data));
              isConnected = checkRes.data?.network_distance === "FIRST_DEGREE";
            }
          }
          if (isConnected) {
            await admin.from("campaign_leads")
              .update({ accepted_at: now })
              .eq("id", lead.id);
            lead.accepted_at = now;
          } else {
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await admin.from("campaign_jobs")
              .update({ status: "pending", execute_at: tomorrow })
              .eq("id", job.id);
            continue;
          }
        }

        const msgNum    = parseInt(job.action_type.replace("message_", ""), 10);
        const stepOrder = msgNum + 2;

        const { data: step } = await admin
          .from("campaign_steps")
          .select("message_content")
          .eq("campaign_id", job.campaign_id)
          .eq("action_type", "message")
          .eq("step_order", stepOrder)
          .single();

        const text = step?.message_content
          ? step.message_content
              .replace(/{{first_name}}/g,   lead.first_name   ?? "")
              .replace(/{{last_name}}/g,    lead.last_name    ?? "")
              .replace(/{{company_name}}/g, lead.company_name ?? "")
          : null;

        if (!text) {
          errorMsg = `Missing message content for step ${stepOrder}`;
        } else {
          // Envoie le message via POST /chats (crée ou retrouve le chat + envoie en une requête)
          const fd = new FormData();
          fd.append("account_id", accountId);
          fd.append("attendees_ids", lead.provider_id);
          fd.append("text", text);

          const res = await fetch(
            `${UNIPILE_BASE_URL}/api/v1/chats`,
            {
              method: "POST",
              headers: { "X-API-KEY": apiKey, "accept": "application/json" },
              body: fd,
            }
          );
          const resData = await res.json().catch(() => ({}));
          console.log("[send-message]", JSON.stringify(resData));

          if (res.ok) {
            const chatId: string | null = resData?.id ?? resData?.chat_id ?? null;

            const updateData: Record<string, string> = {
              status: `messaged_${msgNum}`,
              [`messaged_${msgNum}_at`]: now,
            };
            await admin.from("campaign_leads").update(updateData).eq("id", lead.id);

            // Crée / lie le lead dans la table leads au premier message
            if (job.action_type === "message_1") {
              const { data: existingLead } = await admin
                .from("leads")
                .select("id, unipile_chat_id")
                .eq("owner_id", userId)
                .eq("linkedin_url", lead.linkedin_url)
                .single();

              let leadId = existingLead?.id;
              if (!leadId) {
                const { data: newLead } = await admin.from("leads").insert({
                  owner_id:                userId,
                  first_name:              lead.first_name,
                  last_name:               lead.last_name,
                  company_name:            lead.company_name,
                  linkedin_url:            lead.linkedin_url,
                  status:                  "conversation_engagee",
                  outreach_type:           "message texte",
                  conversation_started_at: now,
                  ...(chatId ? { unipile_chat_id: chatId } : {}),
                }).select("id").single();
                leadId = newLead?.id;
              } else if (chatId && !existingLead?.unipile_chat_id) {
                // Met à jour le chat_id si le lead existait déjà sans chat_id
                await admin.from("leads")
                  .update({ unipile_chat_id: chatId })
                  .eq("id", leadId);
              }

              if (leadId) {
                await admin.from("lead_events").insert({
                  lead_id:    leadId,
                  user_id:    userId,
                  event_type: "status_changed",
                  new_value:  "conversation_engagee",
                });
              }
            }

            success = true;
            counts.messages++;
          } else {
            errorMsg = JSON.stringify(resData);
          }
        }
      }

    } catch (err) {
      errorMsg = String(err);
    }

    await admin.from("campaign_jobs").update({
      status:        success ? "done" : "failed",
      executed_at:   now,
      error_message: errorMsg || null,
    }).eq("id", job.id);

    if (success) {
      await scheduleNextStep(job, lead);
    } else {
      await admin.from("campaign_leads")
        .update({ error_message: errorMsg })
        .eq("id", lead.id);
    }

    processed++;
  }

  return jsonResponse({ processed });
});
