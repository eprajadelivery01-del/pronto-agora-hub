import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Limita o tamanho do corpo para impedir abuso/flood de dados arbitrários
const MAX_BODY_BYTES = 16 * 1024 // 16 KB

serve(async (req) => {
  // Trata requisições preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    // Autenticação: exige um JWT válido do Supabase (usuário autenticado ou service role).
    // Um simples header Bearer não basta — validamos o token de verdade.
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Aceita chamadas internas com a service role key; caso contrário valida o JWT do usuário.
    let isAuthorized = SERVICE_ROLE_KEY.length > 0 && token === SERVICE_ROLE_KEY
    if (!isAuthorized) {
      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('Supabase env vars ausentes para validação de auth.')
        return new Response(JSON.stringify({ error: 'Configuração de autenticação ausente' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      const { data: { user }, error: authErr } = await authClient.auth.getUser(token)
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }
      isAuthorized = true
    }


    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8798211446:AAHLAxDhYh81qj7o39qBkkaez3vZvEJnXqw"
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Telegram credentials missing in Edge Function.")
      return new Response(JSON.stringify({ error: "Configurações do Telegram ausentes" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // --- VALIDAÇÃO DE ENTRADA ---
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload muito grande' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 413,
      })
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ error: 'Corpo inválido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    let message = "";

    // Check if it is a Supabase Database Webhook payload (from system_alerts)
    if (payload.type === 'INSERT' && payload.table === 'system_alerts') {
      const record = (payload.record ?? {}) as Record<string, any>;
      const title = "🚨 ALERTA DO SISTEMA (Sentinela) 🚨";
      message = `
${title}
📍 *Tipo:* ${record.type || 'N/A'}
🕒 *Hora:* ${record.created_at ? new Date(record.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}

❌ *Mensagem:* ${record.message || 'N/A'}

📝 *Detalhes:*
\`\`\`json
${JSON.stringify(record.details || {}, null, 2).substring(0, 500)}
\`\`\`
`.trim();
    } else {
      const { app_name, error_message, stack_trace, user_id, user_email, url, additional_info, is_attack } = payload as Record<string, any>
      
      const msgLower = (error_message || "").toLowerCase()
      if (msgLower.includes("deliveryoverlay is not defined") || msgLower.includes("permissão de sobreposição")) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      // Extrair IP do atacante a partir dos Headers (se disponível)
      const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'Desconhecido'
      const country = req.headers.get('cf-ipcountry') || 'Desconhecido'

      // Formatar a mensagem dependendo se for um ataque ou erro normal
      let title = "⚠️ Erro no Sistema"
      if (is_attack || (typeof error_message === 'string' && error_message.includes("[ATAQUE DETECTADO]"))) {
        title = "🚨 ATAQUE / ATIVIDADE SUSPEITA DETECTADA 🚨"
      }

      message = `
${title}
📱 *App:* ${app_name || 'Desconhecido'}
🕒 *Hora:* ${new Date().toLocaleString('pt-BR')}

👤 *Usuário:* ${user_email || 'Anônimo'} (${user_id || 'N/A'})
🌐 *IP do Cliente:* ${clientIp}
📍 *País de Origem:* ${country}

🔗 *URL:* ${url || 'N/A'}

❌ *Mensagem:* ${error_message || 'N/A'}

📝 *Detalhes:*
\`\`\`json
${JSON.stringify(additional_info || {}, null, 2).substring(0, 500)}${JSON.stringify(additional_info || {}).length > 500 ? '...' : ''}
\`\`\`
`.trim();
    }

    // Enviar para a API do Telegram
    const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    if (!telegramResponse.ok) {
      throw new Error(`Telegram API responded with ${telegramResponse.status}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
