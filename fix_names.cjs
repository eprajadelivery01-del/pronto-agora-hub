const fs = require('fs');

const apps = [
  { dir: '../speed-squad', name: 'É Pra Já - Entregador' },
  { dir: '../instant-hub-343007e1', name: 'É Pra Já - Cliente' },
  { dir: '.', name: 'É Pra Já - Lojista' }
];

for (const app of apps) {
  const capConfigPath = app.dir + '/capacitor.config.ts';
  let capConfig = fs.readFileSync(capConfigPath, 'utf8');
  capConfig = capConfig.replace(/appName:\s*'.*?'/, `appName: '${app.name}'`);
  fs.writeFileSync(capConfigPath, capConfig, 'utf8');

  const stringsPath = app.dir + '/android/app/src/main/res/values/strings.xml';
  if (fs.existsSync(stringsPath)) {
    let strings = fs.readFileSync(stringsPath, 'utf8');
    strings = strings.replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${app.name}<\/string>`);
    strings = strings.replace(/<string name="title_activity_main">.*?<\/string>/, `<string name="title_activity_main">${app.name}<\/string>`);
    fs.writeFileSync(stringsPath, strings, 'utf8');
  }
}
console.log('Nomes corrigidos com sucesso!');
