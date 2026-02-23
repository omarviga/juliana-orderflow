import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Example: Query Supabase Postgres via REST (PostgREST) from an Edge Function
// Requires environment variables SUPABASE_URL and SUPABASE_SERVICE_KEY or ANON_KEY

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

serve(async (req) => {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(text, { status: resp.status });
    }

    const data = await resp.json();
    return new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
