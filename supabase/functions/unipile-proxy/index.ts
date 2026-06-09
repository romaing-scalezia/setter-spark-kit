import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UNIPILE_BASE_URL = "https://api15.unipile.com:14546";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function unipileJson(path: string, init: RequestInit, apiKey: string) {
  const res = await fetch(`${UNIPILE_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "X-API-KEY": apiKey,
      "accept": "application/json",
    },
  });
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    return jsonResponse(
      { error: "Unipile API error", status: res.status, details: data },
      res.status,
    );
  }
  return jsonResponse(data, 200);
}

async function unipileMultipart(path: string, formData: FormData, apiKey: string) {
  // Do NOT set Content-Type manually — runtime will set it with the boundary.
  const res = await fetch(`${UNIPILE_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    headers: {
      "X-API-KEY": apiKey,
      "accept": "application/json",
    },
  });
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    return jsonResponse(
      { error: "Unipile API error", status: res.status, details: data },
      res.status,
    );
  }
  return jsonResponse(data, 200);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("UNIPILE_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "UNIPILE_API_KEY not configured" }, 500);
    }

    // --- Verify Supabase JWT ---
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // --- Parse body ---
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    if (!action) {
      return jsonResponse({ error: "Missing 'action' in body" }, 400);
    }

    switch (action) {
      case "hosted_auth": {
        const { notify_url, success_redirect_url, failure_redirect_url } = body;
        if (!notify_url || !success_redirect_url) {
          return jsonResponse({ error: "Missing 'notify_url' or 'success_redirect_url'" }, 400);
        }
        const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const payload = {
          type: "create",
          providers: ["LINKEDIN"],
          api_url: UNIPILE_BASE_URL,
          expiresOn,
          notify_url,
          success_redirect_url,
          failure_redirect_url: failure_redirect_url ?? success_redirect_url,
          name: userId, // forced to Supabase user id (ignores client override)
        };
        return await unipileJson("/api/v1/hosted/accounts/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, apiKey);
      }

      case "get_conversations": {
        const { account_id, cursor } = body;
        if (!account_id) {
          return jsonResponse({ error: "Missing 'account_id'" }, 400);
        }
        const qs = new URLSearchParams({ account_id, limit: "50" });
        if (cursor && typeof cursor === "string") {
          qs.append("cursor", cursor);
        }
        return await unipileJson(`/api/v1/chats?${qs.toString()}`, { method: "GET" }, apiKey);
      }

      case "get_account": {
        const { account_id } = body;
        if (!account_id) {
          return jsonResponse({ error: "Missing 'account_id'" }, 400);
        }
        return await unipileJson(
          `/api/v1/accounts/${encodeURIComponent(account_id)}`,
          { method: "GET" },
          apiKey,
        );
      }

      case "get_attendee": {
        const { attendee_id } = body;
        if (!attendee_id) {
          return jsonResponse({ error: "Missing 'attendee_id'" }, 400);
        }
        return await unipileJson(
          `/api/v1/chat_attendees/${encodeURIComponent(attendee_id)}`,
          { method: "GET" },
          apiKey,
        );
      }

      case "get_messages": {
        const { chat_id } = body;
        if (!chat_id) {
          return jsonResponse({ error: "Missing 'chat_id'" }, 400);
        }
        const qs = new URLSearchParams({ limit: "50" });
        return await unipileJson(
          `/api/v1/chats/${encodeURIComponent(chat_id)}/messages?${qs.toString()}`,
          { method: "GET" },
          apiKey,
        );
      }

      case "send_message": {
        const { chat_id, text } = body;
        if (!chat_id || !text) {
          return jsonResponse({ error: "Missing 'chat_id' or 'text'" }, 400);
        }
        const fd = new FormData();
        fd.append("text", text);
        return await unipileMultipart(
          `/api/v1/chats/${encodeURIComponent(chat_id)}/messages`,
          fd,
          apiKey,
        );
      }

      case "start_conversation": {
        const { account_id, attendee_provider_id, text } = body;
        if (!account_id || !attendee_provider_id || !text) {
          return jsonResponse(
            { error: "Missing 'account_id', 'attendee_provider_id' or 'text'" },
            400,
          );
        }
        const fd = new FormData();
        fd.append("account_id", account_id);
        fd.append("attendees_ids", attendee_provider_id);
        fd.append("text", text);
        return await unipileMultipart("/api/v1/chats", fd, apiKey);
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});