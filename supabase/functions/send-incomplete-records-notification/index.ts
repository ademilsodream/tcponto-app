
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncompleteRecordsRequest {
  employee_name: string;
  employee_email: string;
  missing_records: string[];
  date: string;
  records_count: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      employee_name, 
      employee_email, 
      missing_records, 
      date, 
      records_count 
    }: IncompleteRecordsRequest = await req.json();

    console.log(`Sending incomplete records notification to ${employee_email} for date ${date}`);

    const missingRecordsList = missing_records.join(", ");
    const recordsCompleted = 4 - missing_records.length;

    const emailResponse = await resend.emails.send({
      from: "Sistema de Ponto <onboarding@resend.dev>",
      to: [employee_email],
      subject: `⚠️ Registros de Ponto Incompletos - ${new Date(date).toLocaleDateString('pt-BR')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin-top: 0;">Registros de Ponto Incompletos</h2>
            
            <p>Olá <strong>${employee_name}</strong>,</p>
            
            <p>Identificamos que alguns registros de ponto não foram realizados hoje (${new Date(date).toLocaleDateString('pt-BR')}).</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">Status dos Registros:</h3>
              <p><strong>Registros realizados:</strong> ${recordsCompleted}/4</p>
              <p><strong>Registros faltantes:</strong></p>
              <ul style="color: #dc3545;">
                ${missing_records.map(record => `<li>${record}</li>`).join('')}
              </ul>
            </div>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="color: #1976d2; margin-top: 0;">📋 Lembrete:</h4>
              <p style="margin-bottom: 0;">Para dias anteriores, você pode solicitar edição através do sistema, preenchendo todos os 4 registros de uma vez e informando o motivo da alteração.</p>
            </div>
            
            <p>Por favor, certifique-se de registrar todos os pontos diariamente para manter seus registros de trabalho em ordem.</p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">
              Esta é uma notificação automática do Sistema de Ponto.<br>
              Se você tem dúvidas, entre em contato com o departamento de RH.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-incomplete-records-notification function:", error);
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
