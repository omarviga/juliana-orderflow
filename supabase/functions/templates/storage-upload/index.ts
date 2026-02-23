import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Example: create an upload URL for Supabase Storage using REST
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const BUCKET = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "public";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });

  try {
    const { filename } = await req.json();
    if (!filename) return new Response(JSON.stringify({ error: "filename required" }), { status: 400 });

    // Supabase Storage upload URL (we'll use direct upload via PUT signed URL)
    const url = `${SUPABASE_URL.replace(/\.co\/$|$/, "/") }storage/v1/object/sign/${BUCKET}/${encodeURIComponent(filename)}`;
    const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!resp.ok) return new Response(JSON.stringify({ error: "failed to create upload" }), { status: resp.status });
    const data = await resp.json();
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
