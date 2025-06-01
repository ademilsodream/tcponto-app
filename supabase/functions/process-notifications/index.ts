
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing pending notifications...");

    // Buscar notificações pendentes
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_logs')
      .select('*')
      .eq('status', 'pending')
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${pendingNotifications?.length || 0} pending notifications`);

    let processed = 0;
    let errors = 0;

    for (const notification of pendingNotifications || []) {
      try {
        const metadata = notification.metadata;
        let emailResponse;

        switch (notification.notification_type) {
          case 'incomplete_records':
            emailResponse = await supabase.functions.invoke('send-incomplete-records-notification', {
              body: {
                employee_name: metadata.employee_name,
                employee_email: metadata.employee_email,
                missing_records: metadata.missing_records,
                date: metadata.date,
                records_count: metadata.records_count
              }
            });
            break;

          case 'overtime_alert':
            emailResponse = await supabase.functions.invoke('send-overtime-alert', {
              body: {
                employee_name: metadata.employee_name,
                employee_email: metadata.employee_email,
                date: metadata.date,
                overtime_hours: metadata.overtime_hours,
                total_hours: metadata.total_hours
              }
            });
            break;

          default:
            console.log(`Unknown notification type: ${notification.notification_type}`);
            continue;
        }

        if (emailResponse.error) {
          throw new Error(emailResponse.error.message);
        }

        // Marcar como enviada
        await supabase
          .from('notification_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        processed++;
        console.log(`Notification ${notification.id} sent successfully`);

      } catch (error: any) {
        errors++;
        console.error(`Error processing notification ${notification.id}:`, error);

        // Marcar como falha
        await supabase
          .from('notification_logs')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', notification.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed,
      errors,
      total: pendingNotifications?.length || 0
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in process-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
