Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\antho\.gemini\antigravity-ide\scratch\eprajadelivery01-del\pronto-agora-hub\public\icon-512x512.png"
$destPath = "C:\Users\antho\.gemini\antigravity-ide\scratch\eprajadelivery01-del\pronto-agora-hub\public\icon_correto_transparente.png"

try {
    $img = [System.Drawing.Bitmap]::FromFile($sourcePath)
    $bmp = New-Object System.Drawing.Bitmap($img)
    $img.Dispose()

    # The background color is usually at the top-left corner (0,0)
    $bgColor = $bmp.GetPixel(0,0)
    
    # Make that specific dark blue color transparent
    $bmp.MakeTransparent($bgColor)
    
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Imagem transparente gerada com sucesso em: $destPath"
} catch {
    Write-Error "Failed to process image: $_"
}
