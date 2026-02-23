import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() => {
  const payload = { message: "Hello from JSON endpoint", now: new Date().toISOString() };
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
});
