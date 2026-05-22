
/**
 * Diagnóstico e correção do convite para lojista
 * Token: 8d1b7309-72fa-4569-915f-1d7b5b3038ef
 * URL: https://lojista.eprajadelivery.com/invite/8d1b7309-72fa-4569-915f-1d7b5b3038ef
 */

const { createClient } = require('@supabase/supabase-js');

// Cliente com anon key (diagnóstico apenas)
const supabase = createClient(
  "https://nptkxlrhrlssdsevpgqe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGt4bHJocmxzc2RzZXZwZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDE4MTQsImV4cCI6MjA5MDYxNzgxNH0.t8Cu-yFnSqOURT4GXCZ_mBghpxucT89nRBFlBNA1vZs"
);

const TOKEN = '8d1b7309-72fa-4569-915f-1d7b5b3038ef';

async function diagnose() {
  console.log('=== DIAGNÓSTICO DO CONVITE ===');
  console.log('Token:', TOKEN);
  console.log('');

  // 1. Buscar pelo token (campo token)
  console.log('1. Buscando por campo "token"...');
  const { data: byToken, error: err1 } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', TOKEN);
  
  if (err1) {
    console.error('   ERRO ao buscar por token:', err1.message);
  } else {
    console.log('   Resultado:', JSON.stringify(byToken, null, 2));
  }

  // 2. Buscar pelo id (o token pode ser o ID)
  console.log('\n2. Buscando por campo "id"...');
  const { data: byId, error: err2 } = await supabase
    .from('invitations')
    .select('*')
    .eq('id', TOKEN);
  
  if (err2) {
    console.error('   ERRO ao buscar por id:', err2.message);
  } else {
    console.log('   Resultado:', JSON.stringify(byId, null, 2));
  }

  // 3. Listar os últimos 5 convites para ver a estrutura
  console.log('\n3. Últimos 5 convites (para ver estrutura da tabela)...');
  const { data: recent, error: err3 } = await supabase
    .from('invitations')
    .select('id, token, role, status, expires_at, created_at, email')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (err3) {
    console.error('   ERRO ao listar convites:', err3.message);
  } else {
    console.log('   Resultado:', JSON.stringify(recent, null, 2));
  }

  // 4. Verificar se o registro existe por qualquer campo com esse UUID
  console.log('\n=== CONCLUSÃO ===');
  const found = byToken?.length > 0 || byId?.length > 0;
  if (!found) {
    console.log('❌ Convite NÃO encontrado no banco de dados.');
    console.log('   Solução: Criar um novo convite no painel administrativo.');
  } else {
    const record = byToken?.[0] || byId?.[0];
    console.log('✅ Convite ENCONTRADO:');
    console.log('   Status:', record.status);
    console.log('   Expira em:', record.expires_at);
    console.log('   Expirado?', new Date(record.expires_at) < new Date() ? 'SIM ❌' : 'NÃO ✅');
    
    if (record.status !== 'pending') {
      console.log(`\n⚠️  Status é "${record.status}" - precisa ser "pending" para funcionar.`);
    }
    if (new Date(record.expires_at) < new Date()) {
      console.log(`\n⚠️  Convite EXPIRADO em ${record.expires_at}.`);
    }
  }
}

diagnose().catch(console.error);
