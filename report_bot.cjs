const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('../express-lane-nexus/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)="?(.*?)"?$/);
  if (match) { envVars[match[1]] = match[2]; }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.SUPABASE_PUBLISHABLE_KEY);

async function runReport() {
  console.log("Gerando relatório...");
  
  // Buscar a primeira e última entrega suspeita
  const { data: deliveries, error } = await supabase.from('deliveries')
    .select('created_at, customer_name, id')
    .gte('created_at', '2026-06-10T07:50:00Z') // 04:50 AM BRT
    .lte('created_at', '2026-06-10T08:05:00Z') // 05:05 AM BRT
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Erro ao buscar deliveries:", error);
    return;
  }

  // Filtrar os spams (nomes esquisitos)
  const botDeliveries = deliveries.filter(d => 
    d.customer_name && (d.customer_name === 'Vt t' || d.customer_name === 'Rfrf' || d.customer_name === 'Crxr' || d.customer_name.length <= 4)
  );

  if (!botDeliveries || botDeliveries.length === 0) {
    console.log("Nenhuma entrega bot encontrada via API pública (Pode estar protegida pelo RLS).");
    return;
  }

  console.log(`Encontradas ${botDeliveries.length} entregas suspeitas geradas pelo bot.`);
  console.log(`⏱️ Início exato: ${new Date(botDeliveries[0].created_at).toLocaleString('pt-BR')} (BRT) - Cliente: ${botDeliveries[0].customer_name}`);
  console.log(`⏱️ Término exato: ${new Date(botDeliveries[botDeliveries.length - 1].created_at).toLocaleString('pt-BR')} (BRT) - Cliente: ${botDeliveries[botDeliveries.length - 1].customer_name}`);
}

runReport();
