# Corrigir ícones 404 do PWA (manifest)

## Diagnóstico

O navegador relata 404 para `icons/icon-192.webp` e o erro "resource isn't a valid image" no Manifest porque:

- `public/manifest.json` referencia os ícones como `../icons/icon-48.webp` ... `../icons/icon-512.webp`.
- Quando o navegador carrega `/manifest.json`, o caminho relativo `../icons/...` resolve para `/icons/...`.
- Mas os arquivos `.webp` estão em `./icons/` (raiz do projeto), **fora de `public/`**, então nunca são servidos. Não existe `public/icons/`.

Resultado: todos os 7 ícones do manifest devolvem 404 e o PWA não tem ícone válido.

## O que vamos fazer

### 1. Servir os ícones
Criar `public/icons/` e copiar os 7 arquivos `.webp` existentes em `./icons/` (icon-48, 72, 96, 128, 192, 256, 512) para dentro de `public/icons/`.

### 2. Corrigir caminhos no manifest
Trocar todos os `src` de `../icons/icon-XX.webp` para o caminho absoluto `/icons/icon-XX.webp` em `public/manifest.json`. Caminho absoluto evita ambiguidade de resolução relativa e funciona tanto na raiz quanto em subrotas.

### 3. (Opcional) Sincronizar o manifest do iOS
O `ios/App/App/public/manifest.json` tem os mesmos caminhos `../icons/`. Como o build do Capacitor copia `dist/` (que inclui `public/`), esse arquivo separado normalmente não é usado pelo web; deixamos como está, a menos que o build nativo precise.

## Fora de escopo

- Regenerar/converter ícones (os `.webp` atuais já existem e são válidos).
- Alterar favicon.png / apple-touch-icon.png (já servem corretamente de `public/`).
- Logs repetidos `[Lojista] companyId resolvido` / `[Lojista] entregas carregadas` são apenas `console.info` de diagnóstico — não são erros.
