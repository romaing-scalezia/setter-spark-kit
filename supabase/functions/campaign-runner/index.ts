import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UNIPILE_BASE_URL     = "https://api20.unipile.com:15052";
const MAX_VISITS_PER_DAY   = 20;
const MAX_INVITES_PER_DAY  = 20;
const MAX_MESSAGES_PER_DAY = 20;
const MAX_PARALLEL_USERS   = 20;

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

// Jour de la semaine (0=dimanche...6=samedi) d'une date donnée, en heure de Paris.
function parisWeekday(d: Date): number {
  return new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getDay();
}

// Heure locale (0-23) d'une date donnée, en heure de Paris.
function parisHour(d: Date): number {
  return new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getHours();
}

// Garde-fou : n'exécute jamais rien en dehors des jours ouvrés 8h-20h (Paris).
// Filet de sécurité indépendant de la programmation des jobs — même si un
// execute_at erroné ou un backlog en attente devient "dû", rien ne part
// tant qu'on n'est pas dans la fenêtre autorisée.
function isWithinWorkingHours(): boolean {
  const nowInstant = new Date();
  const day  = parisWeekday(nowInstant);
  const hour = parisHour(nowInstant);
  return day >= 1 && day <= 5 && hour >= 8 && hour < 20;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isWithinWorkingHours()) {
    return jsonResponse({ processed: 0, skipped: "outside_working_hours" });
  }

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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // ── 1. Récupère les users distincts avec des jobs pending ──────────────────
  const { data: pendingUsers, error: usersError } = await admin
    .rpc("get_pending_campaign_users");

  if (usersError) return jsonResponse({ error: usersError.message }, 500);
  if (!pendingUsers || pendingUsers.length === 0) return jsonResponse({ processed: 0 });

  const userIds = (pendingUsers as { user_id: string }[])
    .map((r) => r.user_id)
    .slice(0, MAX_PARALLEL_USERS);
  console.log(`[campaign-runner] ${userIds.length} users actifs`);

  // ── 2. Traite chaque user en parallèle ────────────────────────────────────
  const results = await Promise.all(userIds.map((userId: string) => processUser(userId)));

  const totalProcessed = results.reduce((sum, r) => sum + r, 0);
  console.log(`[campaign-runner] processed: ${totalProcessed}`);
  return jsonResponse({ processed: totalProcessed, users: userIds.length });

  // ── Traitement séquentiel des jobs d'un user ──────────────────────────────
  async function processUser(userId: string): Promise<number> {
    // Limites journalieres personnalisables par l'utilisateur (par defaut 20,
    // cf. LinkedInLimitsModal) — a defaut de ligne memberships, on retombe
    // sur les constantes globales.
    const { data: membership } = await admin
      .from("memberships")
      .select("visits_daily_limit, invites_daily_limit, messages_daily_limit")
      .eq("user_id", userId)
      .maybeSingle();

    const maxVisits   = membership?.visits_daily_limit   ?? MAX_VISITS_PER_DAY;
    const maxInvites  = membership?.invites_daily_limit  ?? MAX_INVITES_PER_DAY;
    const maxMessages = membership?.messages_daily_limit ?? MAX_MESSAGES_PER_DAY;

    // Récupère les compteurs journaliers AVANT de fetcher les jobs
    // pour exclure dès la requête les action_types dont le quota est plein
    const { data: doneToday } = await admin
      .from("campaign_jobs")
      .select("action_type")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("executed_at", todayStart.toISOString());

    const counts = { visits: 0, invites: 0, messages: 0 };
    for (const j of doneToday ?? []) {
      if (j.action_type === "visit")                counts.visits++;
      else if (j.action_type === "invite")          counts.invites++;
      else if (j.action_type.startsWith("message")) counts.messages++;
    }

    // Construit la liste des action_types dont le quota n'est pas plein
    const availableTypes: string[] = [];
    const fullTypes: string[] = [];
    if (counts.visits   < maxVisits)   availableTypes.push("visit");
    else                                fullTypes.push("visit");
    if (counts.invites  < maxInvites)  availableTypes.push("invite");
    else                                fullTypes.push("invite");
    if (counts.messages < maxMessages) {
      availableTypes.push("message_1", "message_2", "message_3");
    } else {
      fullTypes.push("message_1", "message_2", "message_3");
    }

    // Les jobs bloqués par un quota plein ne doivent pas rester en attente
    // avec un execute_at périmé jusqu'à la remise à zéro du quota à minuit —
    // c'est exactement ce qui provoquait des rafales d'exécution en pleine
    // nuit. On les replanifie tout de suite sur le prochain créneau ouvré valide.
    if (fullTypes.length > 0) {
      await admin
        .from("campaign_jobs")
        .update({ execute_at: scheduleInWorkingHours(1) })
        .eq("user_id", userId)
        .eq("status", "pending")
        .in("action_type", fullTypes)
        .lte("execute_at", now);
    }

    if (availableTypes.length === 0) {
      console.log(`[campaign-runner] user ${userId}: all quotas full`);
      return 0;
    }

    // Récupère uniquement les jobs dont le type n'est pas à quota
    const { data: jobs, error: jobsError } = await admin
      .from("campaign_jobs")
      .select("*, campaign_leads(*), campaigns(user_id, status)")
      .eq("status", "pending")
      .eq("user_id", userId)
      .eq("campaigns.status", "active")
      .lte("execute_at", now)
      .in("action_type", availableTypes)
      .order("execute_at", { ascending: true });

    console.log(`[campaign-runner] user ${userId}: ${jobs?.length ?? 0} jobs, error: ${jobsError?.message ?? 'none'}`);
    if (jobsError || !jobs || jobs.length === 0) return 0;

    // Récupère le compte Unipile une seule fois pour cet user
    const { data: unipileAccount } = await admin
      .from("unipile_accounts")
      .select("account_id")
      .eq("user_id", userId)
      .single();

    if (!unipileAccount) return 0;
    const accountId = unipileAccount.account_id;

    let processed = 0;

    for (const job of jobs) {
      const lead = job.campaign_leads;

      // Le quota a pu se remplir en cours de traitement (jobs précédents de
      // cette même exécution) : on replanifie plutôt que de laisser un
      // execute_at périmé trainer jusqu'à la remise à zéro du quota.
      const quotaJustFilled =
        (job.action_type === "visit"   && counts.visits   >= maxVisits)   ||
        (job.action_type === "invite"  && counts.invites  >= maxInvites)  ||
        (job.action_type.startsWith("message") && counts.messages >= maxMessages);
      if (quotaJustFilled) {
        await admin.from("campaign_jobs").update({ execute_at: scheduleInWorkingHours(1) }).eq("id", job.id);
        continue;
      }

      await admin.from("campaign_jobs").update({ status: "running" }).eq("id", job.id);

      let success     = false;
      let errorMsg    = "";
      let retryable   = false; // 422/429 LinkedIn → replanifier au lendemain

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
            retryable = res.status === 422 || res.status === 429;
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
              retryable = res.status === 422 || res.status === 429;
              errorMsg = JSON.stringify(res.data);
            }
          }

        /* ── MESSAGE ── */
        } else if (job.action_type.startsWith("message")) {

          if (lead.replied_at) {
            await admin.from("campaign_jobs")
              .update({ status: "cancelled", executed_at: now })
              .eq("id", job.id);
            continue;
          }

          if (job.action_type === "message_1" && !lead.accepted_at) {
            let isConnected = false;
            if (lead.provider_id) {
              const checkRes = await unipileRequest(
                `/api/v1/users/${encodeURIComponent(lead.provider_id)}?account_id=${accountId}`,
                "GET", apiKey
              );
              if (checkRes.ok) {
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
            const fd = new FormData();
            fd.append("account_id", accountId);
            fd.append("attendees_ids", lead.provider_id);
            fd.append("text", text);

            const res = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
              method: "POST",
              headers: { "X-API-KEY": apiKey, "accept": "application/json" },
              body: fd,
            });
            const resData = await res.json().catch(() => ({}));

            if (res.ok) {
              const chatId: string | null = resData?.id ?? resData?.chat_id ?? null;

              const updateData: Record<string, string> = {
                status: `messaged_${msgNum}`,
                [`messaged_${msgNum}_at`]: now,
              };
              await admin.from("campaign_leads").update(updateData).eq("id", lead.id);

              if (job.action_type === "message_1") {
                const { data: existingLead } = await admin
                  .from("leads")
                  .select("id, unipile_chat_id")
                  .eq("owner_id", userId)
                  .eq("linkedin_url", lead.linkedin_url)
                  .single();

                let leadId = existingLead?.id;
                if (!leadId) {
                  const { data: newLead, error: leadInsertError } = await admin.from("leads").insert({
                    owner_id:                userId,
                    first_name:              lead.first_name,
                    last_name:               lead.last_name,
                    company_name:            lead.company_name,
                    linkedin_url:            lead.linkedin_url,
                    status:                  "conversation_engagee",
                    outreach_type:           "message_texte",
                    conversation_started_at: now,
                    ...(chatId ? { unipile_chat_id: chatId } : {}),
                  }).select("id").single();
                  if (leadInsertError) console.error("[campaign-runner] leads insert failed:", leadInsertError);
                  leadId = newLead?.id;
                } else if (chatId && !existingLead?.unipile_chat_id) {
                  const { error: chatIdError } = await admin.from("leads")
                    .update({ unipile_chat_id: chatId })
                    .eq("id", leadId);
                  if (chatIdError) console.error("[campaign-runner] leads unipile_chat_id update failed:", chatIdError);
                }

                if (leadId) {
                  const { error: eventError } = await admin.from("lead_events").insert({
                    lead_id:    leadId,
                    user_id:    userId,
                    event_type: "status_changed",
                    new_value:  "conversation_engagee",
                  });
                  if (eventError) console.error("[campaign-runner] lead_events insert failed:", eventError);
                }
              }

              success = true;
              counts.messages++;
            } else {
              retryable = res.status === 422 || res.status === 429;
              errorMsg = JSON.stringify(resData);
            }
          }
        }

      } catch (err) {
        errorMsg = String(err);
      }

      if (success) {
        await admin.from("campaign_jobs").update({
          status:        "done",
          executed_at:   now,
          error_message: null,
        }).eq("id", job.id);
        await scheduleNextStep(job, lead);
      } else if (retryable) {
        // 422/429 LinkedIn → replanifie au lendemain dans la fenêtre 8h-20h
        const retryAt = scheduleInWorkingHours(1);
        await admin.from("campaign_jobs").update({
          status:        "pending",
          execute_at:    retryAt,
          error_message: `retryable: ${errorMsg}`,
        }).eq("id", job.id);
        console.log(`[campaign-runner] job ${job.id} retryable (${job.action_type}), rescheduled to ${retryAt}`);
      } else {
        await admin.from("campaign_jobs").update({
          status:        "failed",
          executed_at:   now,
          error_message: errorMsg || null,
        }).eq("id", job.id);
        await admin.from("campaign_leads")
          .update({ error_message: errorMsg })
          .eq("id", lead.id);
      }

      processed++;
    }

    return processed;
  }

  // Planifie à une heure aléatoire dans la fenêtre 8h-20h (Europe/Paris) du bon jour
  function scheduleInWorkingHours(delayDays: number): string {
    const target = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);

    // Heure actuelle en Europe/Paris
    const nowParis = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const currentHour = nowParis.getHours();

    // Si delayDays = 0 et qu'on est déjà après 18h, décale au lendemain
    if (delayDays === 0 && currentHour >= 18) {
      target.setDate(target.getDate() + 1);
    }

    // Ne jamais programmer un envoi le week-end : décale au lundi suivant
    while (parisWeekday(target) === 0 || parisWeekday(target) === 6) {
      target.setDate(target.getDate() + 1);
    }

    // Choisit une heure aléatoire entre 8h et 20h (en minutes depuis minuit)
    const WORK_START = 8 * 60;  // 8h00
    const WORK_END   = 20 * 60; // 20h00
    const randomMinute = WORK_START + Math.floor(Math.random() * (WORK_END - WORK_START));

    const parisOffset = target.toLocaleString("en-US", { timeZone: "Europe/Paris", timeZoneName: "short" })
      .includes("GMT+2") ? 2 : 1;

    target.setUTCHours(0, 0, 0, 0);
    target.setUTCMinutes(randomMinute - parisOffset * 60);

    return target.toISOString();
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
      await admin.from("campaign_leads")
        .update({ status: "completed" })
        .eq("id", lead.id);
      return;
    }

    const executeAt = scheduleInWorkingHours(nextStep.delay_days);

    await admin.from("campaign_jobs").insert({
      campaign_id:      job.campaign_id,
      campaign_lead_id: lead.id,
      user_id:          job.user_id,
      action_type:      stepToJobActionType(nextStep.action_type, nextStep.step_order),
      status:           "pending",
      execute_at:       executeAt,
    });
  }
});
