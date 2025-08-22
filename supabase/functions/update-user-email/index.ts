import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Criar cliente normal para obter o usuário atual
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { newEmail } = await req.json()

    if (!newEmail) {
      return new Response(
        JSON.stringify({ error: 'New email is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Atualizar email na auth.users via admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email: newEmail }
    )

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Atualizar email na tabela profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (profileError) {
      console.error('Erro ao atualizar perfil:', profileError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar perfil do usuário' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email atualizado com sucesso',
        user: authData.user 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
