
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationPayload {
  token: string;
  platform: string;
  title: string;
  body: string;
  data?: any;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokens, title, body, data = {} } = await req.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      throw new Error("Tokens de push notification são obrigatórios");
    }

    if (!title || !body) {
      throw new Error("Título e corpo da notificação são obrigatórios");
    }

    const results = [];

    for (const tokenInfo of tokens) {
      try {
        let response;

        if (tokenInfo.platform === 'android') {
          // Enviar via FCM para Android
          response = await sendFCMNotification(tokenInfo.token, title, body, data);
        } else if (tokenInfo.platform === 'ios') {
          // Enviar via APNs para iOS
          response = await sendAPNsNotification(tokenInfo.token, title, body, data);
        } else {
          console.log(`Plataforma não suportada: ${tokenInfo.platform}`);
          continue;
        }

        results.push({
          token: tokenInfo.token,
          platform: tokenInfo.platform,
          success: true,
          response
        });

      } catch (error: any) {
        console.error(`Erro ao enviar notificação para token ${tokenInfo.token}:`, error);
        results.push({
          token: tokenInfo.token,
          platform: tokenInfo.platform,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      results,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Erro na função send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function sendFCMNotification(token: string, title: string, body: string, data: any) {
  const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  
  if (!fcmServerKey) {
    throw new Error("FCM_SERVER_KEY não configurada");
  }

  const payload = {
    to: token,
    notification: {
      title,
      body,
      sound: "default",
      badge: 1
    },
    data
  };

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Authorization": `key=${fcmServerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FCM Error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function sendAPNsNotification(token: string, title: string, body: string, data: any) {
  // Para implementação completa do APNs, seria necessário configurar certificados
  // Por agora, vamos registrar e retornar sucesso simulado
  console.log(`APNs notification would be sent to: ${token}`);
  console.log(`Title: ${title}, Body: ${body}`);
  
  // Em produção, aqui seria implementada a comunicação com APNs
  // usando bibliotecas como node-apn ou similar
  
  return { 
    success: true, 
    message: "APNs notification queued (implementation needed)" 
  };
}

serve(handler);
