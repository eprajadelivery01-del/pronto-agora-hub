# É Pra Já - Lojista (Pronto Agora Hub)

## Como enviar atualizações para a App Store (Apple)
Este projeto utiliza Capacitor. Ao fazer alterações, se ocorrer problemas de compilação no Mac devido à falta de arquivos do iOS (`config.xml`, `capacitor.config.json` ou ícones faltando), certifique-se de rodar:
`npx cap sync ios` e `npx @capacitor/assets generate --ios` no ambiente de compilação, ou garantir que esses arquivos sejam forçados no Github. O erro `invalid escape sequence` no Mac também pode ocorrer se o `Package.swift` do Capacitor estiver usando barras invertidas de Windows (`\`) - troque por barras normais (`/`).

### 1. Pré-requisitos (Chave da API App Store Connect)
Você precisa de uma chave `.p8` gerada no App Store Connect com acesso de Administrador. Salve-a no Mac remoto:
```bash
mkdir -p ~/.private_keys
cat << 'EOF' > ~/.private_keys/AuthKey_GNCVF862P9.p8
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgTJxL5OlCpNhIz+as
NezPrhS68wdkOc3/sFRAfI99kDqgCgYIKoZIzj0DAQehRANCAARuj2UXxFLjeNzZ
hl+S6+PG1gXxM9TUNMtwXM7HGmqpO8dKnQuoyNiGmHHFdTkJ23saL7M/jDOc8ogm
0ChusLJa
-----END PRIVATE KEY-----
EOF
```

### 2. Script de Build e Upload (Sem Xcode App)
Este script usa o Team ID `4YULT95XAK`, Key ID `GNCVF862P9` e Issuer ID `b3214eff-b69b-4b7a-bfd0-0c476ed2605c`.

```bash
cd ~/Documents/pronto-agora-hub
git pull origin main

mkdir -p build
cat << EOF > build/ExportOptions.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>4YULT95XAK</string>
    <key>manageAppVersionAndBuildNumber</key>
    <true/>
</dict>
</plist>
EOF

rm -rf build/App.xcarchive build/App.ipa

# 1. Archive
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release archive -archivePath build/App.xcarchive DEVELOPMENT_TEAM="4YULT95XAK" -allowProvisioningUpdates -authenticationKeyPath "$HOME/.private_keys/AuthKey_GNCVF862P9.p8" -authenticationKeyID "GNCVF862P9" -authenticationKeyIssuerID "b3214eff-b69b-4b7a-bfd0-0c476ed2605c"

# 2. Export
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportOptionsPlist build/ExportOptions.plist -exportPath build/ -allowProvisioningUpdates -authenticationKeyPath "$HOME/.private_keys/AuthKey_GNCVF862P9.p8" -authenticationKeyID "GNCVF862P9" -authenticationKeyIssuerID "b3214eff-b69b-4b7a-bfd0-0c476ed2605c"

# 3. Upload
xcrun altool --upload-app -f build/App.ipa -t ios --apiKey "GNCVF862P9" --apiIssuer "b3214eff-b69b-4b7a-bfd0-0c476ed2605c"
```

### Bug 049
**Título**: Salto Abusivo de Etapas do Kanban (Pulo de Status) e Conflito de Assinatura
**Descrição**: Foi detectada uma falha estrutural gravíssima na segurança do painel: mesmo com *Compare-and-Set* (que evita race conditions de cliques simultâneos), a interface poderia disparar uma transição arbitrária e ilegal (ex: de `preparing` direto para `delivered`), e o servidor aceitaria cegamente, pois o `updateStatus` validaria apenas se a sessão conhecia o status anterior, mas não restringiria o próximo salto (não havia Whitelist de estado da máquina).
Além disso, a implementação forçada de uma Whitelist de mão única (`pending -> preparing -> ready`) esbarrou em outros botões já consolidados (como Cancelar Pedido ou os fluxos de `OrderDetailModal`), revelando que `updateStatus` é uma função super-utilizada no sistema todo, gerando exceções não tratadas ao tentar blindá-la de forma ingênua.
**Correção (Em Andamento)**: 
A correção consiste na implementação de uma proteção Tripla-Camada EXCLUSIVA para a função de controle do Kanban de Lojista:
1. **Whitelist Explícita (`ALLOWED_MANUAL_TRANSITIONS`)**: Mapeando cada nó para seu respectivo avanço lógico.
2. **Exceções Mapeadas**: Incorporando retornos válidos de ponta-a-ponta (como a rota de Cancelamento) sem quebrar o Board.
3. **Compare-and-Set e Strict Lock (`useRef`)**: Evitando que múltiplos toques atropelem o mesmo card e causem a duplicação na requisição para o Edge Function.

## Bug 051: Delivery Steal Vulnerability via RPC Bypassing
- **Description:** A security definer RPC (`update_delivery_status_safe`) designed to handle delivery status transitions allowed an authenticated driver to "steal" a delivery already accepted by another driver. The RPC failed to perform a global ownership check when the requested status was anything other than `accepted`, and blindly trusted the `p_driver_id` input parameter via a `COALESCE` assignment.
- **Impact:** Active deliveries could vanish from the original driver's screen, and financial compensation could be awarded to a malicious driver.
- **Root Cause:** Missing global ownership check against `auth.uid()` after acquiring the `SELECT ... FOR UPDATE` lock, combined with trusting client-side input in a `SECURITY DEFINER` function without strict identity validation.
- **Resolution:** The RPC was fundamentally rewritten to enforce strict zero-trust identity: `auth.uid()` is resolved against the `delivery_drivers` table, a global ownership check asserts that if the delivery has an owner it MUST match the authenticated driver, and `p_driver_id` is completely ignored for ownership assignment.
### Bug 052: Marketplace Evaluation PGRST116 Error (Multiple Rows)
- **Problem**: In the Marketplace Client (`eprajadelivery.com/marketplace`), users encountered the `[Console Error] [useEvaluation] Error checking rating: {"code":"PGRST116","details":"Results contain 2 rows..."}` when trying to load or submit a review.
- **Cause**: The `useEvaluation` hook called `.maybeSingle()` to check if the user had already rated the order. However, due to previous race conditions or missing constraints, multiple review entries could exist for a single order in the database. When the Supabase API returned 2 rows instead of 0 or 1, `maybeSingle()` crashed.
- **Fix**: Replaced `.maybeSingle()` with `.limit(1)` and modified the validation check to evaluate if the returned array length is greater than 0 (`data && data.length > 0`).
- **Location**: `instant-hub/src/hooks/useEvaluation.ts`
- **Status**: Fixed.
