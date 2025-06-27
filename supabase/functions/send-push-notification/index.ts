
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
  tokens?: { token: string; platform: string }[];
  userId?: string;
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
    const payload: PushNotificationPayload = await req.json();
    let { tokens, userId, title, body, data = {} } = payload;

    if (!title || !body) {
      throw new Error("Título e corpo da notificação são obrigatórios");
    }

    // Se não foram fornecidos tokens, buscar tokens ativos do usuário
    if (!tokens && userId) {
      const { data: userTokens, error } = await supabase
        .from('push_tokens')
        .select('token, platform')
        .eq('employee_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Erro ao buscar tokens:', error);
        throw new Error('Erro ao buscar tokens do usuário');
      }

      tokens = userTokens || [];
    }

    if (!tokens || tokens.length === 0) {
      console.log('Nenhum token ativo encontrado');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Nenhum token ativo encontrado',
        results: [],
        sent: 0,
        failed: 0
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const results = [];

    for (const tokenInfo of tokens) {
      try {
        let response;

        if (tokenInfo.platform === 'android') {
          // Enviar via Firebase Admin SDK
          response = await sendFirebaseNotification(tokenInfo.token, title, body, data);
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

async function sendFirebaseNotification(token: string, title: string, body: string, data: any) {
  const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  
  if (!serviceAccountJson) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON não configurado");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (error) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON inválido");
  }

  // Obter access token usando JWT
  const accessToken = await getFirebaseAccessToken(serviceAccount);
  
  const projectId = serviceAccount.project_id;
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: data,
      android: {
        priority: "high",
        notification: {
          channel_id: "default",
          sound: "default"
        }
      }
    }
  };

  const response = await fetch(fcmUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firebase Error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function getFirebaseAccessToken(serviceAccount: any): Promise<string> {
  // Usar a biblioteca JWT do Deno
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  // Criar JWT manualmente (implementação simplificada)
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Importar chave privada
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    encoder.encode(serviceAccount.private_key.replace(/\\n/g, '\n')),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Assinar o token
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Trocar JWT por access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Erro ao obter access token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(handler);
