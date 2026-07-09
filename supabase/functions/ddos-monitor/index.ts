import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8798211446:AAHLAxDhYh81qj7o39qBkkaez3vZvEJnXqw";
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || "538563060";

const TARGETS = [
  { name: "Marketplace (Cliente)", url: "https://eprajadelivery.com/marketplace" },
  { name: "Painel Lojista", url: "https://pronto-agora-hub.vercel.app" },
  { name: "Painel Admin", url: "https://express-lane-nexus.vercel.app" }
];

const TIMEOUT_MS = 5000; // Limite de 5 segundos

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return { 
      success: response.ok, 
      status: response.status, 
      time: Date.now() - start 
    };
  } catch (error: any) {
    clearTimeout(id);
    return { success: false, status: 'TIMEOUT_OR_ERROR', time: Date.now() - start, error: error.message };
  }
}

async function sendTelegramAlert(message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("Missing Telegram configuration");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown"
      })
    });
  } catch (err) {
    console.error("Failed to send telegram message", err);
  }
}

serve(async (req) => {
  const results = [];
  let hasAlerts = false;
  let alertMessage = `🚨 *ALERTA DE MONITORAMENTO (DDOS/QUEDA)* 🚨\n\n`;

  for (const target of TARGETS) {
    const res = await fetchWithTimeout(target.url, TIMEOUT_MS);
    results.push({ name: target.name, ...res });
    
    if (!res.success) {
      hasAlerts = true;
      if (res.status === 'TIMEOUT_OR_ERROR') {
        alertMessage += `❌ *${target.name}* INACESSÍVEL ou LENTO (>5s)!\n_Tempo de resposta: ${res.time}ms_\n\n`;
      } else {
        alertMessage += `⚠️ *${target.name}* ERRO ${res.status}\n_Tempo de resposta: ${res.time}ms_\n\n`;
      }
    }
  }

  if (hasAlerts) {
    await sendTelegramAlert(alertMessage);
    return new Response(JSON.stringify({ status: "alerts_sent", results }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  }

  return new Response(JSON.stringify({ status: "all_healthy", results }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
});
