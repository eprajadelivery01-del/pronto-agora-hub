const https = require('https');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const loginRes = await request({
    hostname: 'api.supabase.com',
    path: '/v1/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'davinynsilva@gmail.com', password: 'Helo2023' }));

  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes.body);
    process.exit(1);
  }
  const token = loginRes.body?.access_token;
  const projectRef = 'nptkxlrhrlssdsevpgqe'; // VITE_SUPABASE_PROJECT_ID might be 'mqhzlhuaxdntkupnkmdk', let's check both

  const queryProject = async (ref) => {
    const sql = `
      SELECT tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('profiles', 'companies', 'delivery_drivers', 'deliveries');
    `;
    const sqlRes = await request({
      hostname: 'api.supabase.com',
      path: '/v1/projects/' + ref + '/database/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    }, JSON.stringify({ query: sql }));
    
    const sqlColumns = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name IN ('profiles', 'companies', 'delivery_drivers', 'deliveries');
    `;
    const colRes = await request({
      hostname: 'api.supabase.com',
      path: '/v1/projects/' + ref + '/database/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    }, JSON.stringify({ query: sqlColumns }));

    console.log(`\n=== Project: ${ref} ===`);
    console.log('Policies:');
    if (sqlRes.body && Array.isArray(sqlRes.body)) {
      sqlRes.body.forEach(p => console.log(`- ${p.tablename}: ${p.policyname} (${p.cmd}) [roles: ${p.roles}]`));
    } else {
      console.log('Failed to fetch policies:', sqlRes.body);
    }

    console.log('\nColumns:');
    if (colRes.body && Array.isArray(colRes.body)) {
      const tables = {};
      colRes.body.forEach(c => {
        if (!tables[c.table_name]) tables[c.table_name] = [];
        tables[c.table_name].push(c.column_name);
      });
      for (const t in tables) {
        console.log(`- ${t}: ${tables[t].join(', ')}`);
      }
    }
  };

  await queryProject('nptkxlrhrlssdsevpgqe'); // The one from SUPABASE_URL
  await queryProject('mqhzlhuaxdntkupnkmdk'); // The one from VITE_SUPABASE_PROJECT_ID
}
main();
