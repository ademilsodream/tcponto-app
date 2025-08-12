
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  return new Response(JSON.stringify({ ok: true, message: 'Push notifications disabled' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
