# Lance le serveur local et le tunnel HTTPS, puis affiche l'adresse à ouvrir sur l'iPhone.
# Usage :  .\demarrer.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$cloudflared = Join-Path $PSScriptRoot "cloudflared.exe"
if (-not (Test-Path $cloudflared)) {
    Write-Host "Téléchargement de cloudflared (une seule fois)..."
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
        -OutFile $cloudflared -UseBasicParsing
}

$deja = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*serveur.py*" }
if (-not $deja) {
    Start-Process -FilePath "python" -ArgumentList "serveur.py", "8080" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Serveur local : http://localhost:8080"
Write-Host "Recherche de l'adresse publique (cela prend quelques secondes)..."
Write-Host "L'adresse https://........trycloudflare.com s'affiche ci-dessous :"
Write-Host ""

& $cloudflared tunnel --url http://localhost:8080 --no-autoupdate
