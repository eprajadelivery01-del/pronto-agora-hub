import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Trata requisições preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Telegram credentials missing in Edge Function.")
      return new Response(JSON.stringify({ error: "Configurações do Telegram ausentes" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const payload = await req.json()
    const { app_name, error_message, stack_trace, user_id, user_email, url, additional_info, is_attack } = payload

    // Extrair IP do atacante a partir dos Headers (se disponível)
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'Desconhecido'
    const country = req.headers.get('cf-ipcountry') || 'Desconhecido'

    // Formatar a mensagem dependendo se for um ataque ou erro normal
    let title = "⚠️ Erro no Sistema"
    if (is_attack || (error_message && error_message.includes("[ATAQUE DETECTADO]"))) {
      title = "🚨 ATAQUE / ATIVIDADE SUSPEITA DETECTADA 🚨"
    }

    const message = `
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
`.trim()

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
