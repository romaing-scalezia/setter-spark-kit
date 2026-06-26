import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").service_role;

    if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
      return new Response("Missing env vars", { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature") ?? "";
    let event: Stripe.Event;

    const skipSig = Deno.env.get("STRIPE_SKIP_SIG") === "true";
    if (skipSig) {
      event = JSON.parse(body) as Stripe.Event;
      console.log("[stripe-webhook] signature check skipped (dev mode)");
    } else {
      try {
        event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      } catch (err) {
        console.error("[stripe-webhook] Invalid signature:", err);
        return new Response("Invalid signature", { status: 400 });
      }
    }

    console.log("[stripe-webhook] event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        await admin.from("memberships").update({
          plan: "starter",
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          trial_ends_at: null,
        }).eq("user_id", userId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: membership } = await admin
          .from("memberships")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (!membership) break;

        const status = sub.status === "active" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" ? "canceled"
          : "incomplete";

        await admin.from("memberships").update({
          status,
          ...(sub.status === "canceled" ? { plan: "free" } : {}),
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq("user_id", membership.user_id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: membership } = await admin
          .from("memberships")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (!membership) break;

        await admin.from("memberships").update({
          plan: "free",
          status: "canceled",
          stripe_subscription_id: null,
        }).eq("user_id", membership.user_id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await admin.from("memberships").update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
