
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OvertimeAlertRequest {
  employee_name: string;
  employee_email: string;
  date: string;
  overtime_hours: number;
  total_hours: number;
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
      date, 
      overtime_hours,
      total_hours 
    }: OvertimeAlertRequest = await req.json();

    console.log(`Sending overtime alert to ${employee_email} for date ${date}`);

    const emailResponse = await resend.emails.send({
      from: "Sistema de Ponto <onboarding@resend.dev>",
      to: [employee_email],
      subject: `⚠️ Alerta: Horas Extras Excessivas - ${new Date(date).toLocaleDateString('pt-BR')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin-top: 0;">⚠️ Alerta de Horas Extras Excessivas</h2>
            
            <p>Olá <strong>${employee_name}</strong>,</p>
            
            <p>Detectamos que você trabalhou uma quantidade elevada de horas extras hoje (${new Date(date).toLocaleDateString('pt-BR')}).</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">📊 Resumo do Dia:</h3>
              <p><strong>Total de horas trabalhadas:</strong> ${total_hours}h</p>
              <p><strong>Horas extras:</strong> <span style="color: #dc3545; font-weight: bold;">${overtime_hours}h</span></p>
              <p><strong>Data:</strong> ${new Date(date).toLocaleDateString('pt-BR')}</p>
            </div>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="color: #1976d2; margin-top: 0;">💡 Recomendações:</h4>
              <ul style="margin-bottom: 0;">
                <li>Certifique-se de que os registros de ponto estão corretos</li>
                <li>Se houver erro nos horários, solicite correção através do sistema</li>
                <li>Considere balancear a carga de trabalho para os próximos dias</li>
                <li>Mantenha um equilíbrio saudável entre trabalho e descanso</li>
              </ul>
            </div>
            
            <p>Este é um alerta automático para ajudar no monitoramento das horas de trabalho. Se você tem dúvidas sobre este alerta, entre em contato com o departamento de RH.</p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">
              Esta é uma notificação automática do Sistema de Ponto.<br>
              Se você não deseja mais receber estes alertas, pode desabilitá-los nas configurações do sistema.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Overtime alert email sent successfully:", emailResponse);

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
    console.error("Error in send-overtime-alert function:", error);
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
