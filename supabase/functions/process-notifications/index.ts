
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  return new Response(JSON.stringify({ ok: true, message: 'Notification processing disabled' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
