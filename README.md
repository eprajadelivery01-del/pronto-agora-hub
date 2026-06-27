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
