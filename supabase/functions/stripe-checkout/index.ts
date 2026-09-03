import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").service_role;
    const defaultPriceId = Deno.env.get("STRIPE_PRICE_ID");
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";

    if (!stripeKey || !supabaseUrl || !serviceRoleKey || !defaultPriceId) {
      return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500, headers: corsHeaders });
    }

    // Vérifie le JWT Supabase
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Vérifie côté serveur si l'utilisateur est sur une offre — ne pas faire confiance au frontend
    const starterpackPriceId = Deno.env.get("STRIPE_PRICE_STARTERPACK_ID");
    const { data: profile } = await supabase.from("profiles").select("source").eq("id", user.id).maybeSingle();
    const src = (profile as any)?.source;
    const { data: offer } = src
      ? await supabase.from("offers" as any).select("active").eq("slug", src).maybeSingle()
      : { data: null };
    const isStarterpack = !!(offer as any)?.active && !!starterpackPriceId;
    const priceId: string = isStarterpack ? starterpackPriceId! : defaultPriceId;

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });

    // Récupère ou crée le customer Stripe
    const { data: membership } = await supabase
      .from("memberships")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId: string | undefined = membership?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .single();
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? undefined,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("memberships").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/dashboard?subscribed=1`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { supabase_user_id: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-checkout]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
