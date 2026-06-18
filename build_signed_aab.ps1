$ErrorActionPreference = "Stop"
Write-Host "Setting JAVA_HOME..."
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'

Write-Host "Building SIGNED Android App Bundle (AAB)..."
cd android
.\gradlew.bat clean bundleRelease
