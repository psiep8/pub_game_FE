# ============================================================
# 🚇 PubGame Tunnel Starter
# Avvia 2 tunnel Cloudflare (FE + BE) e aggiorna gli environment
# ============================================================

param(
    [int]$FePort = 4200,
    [int]$BePort = 8080
)

$ErrorActionPreference = "Stop"

$envFile = "$PSScriptRoot\src\app\environment\environment.tunnel.ts"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PubGame Tunnel Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica che cloudflared sia installato
try {
    $null = Get-Command cloudflared -ErrorAction Stop
} catch {
    Write-Host "cloudflared non trovato! Installalo con:" -ForegroundColor Red
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Yellow
    exit 1
}

# --- Avvia tunnel per il Backend ---
Write-Host "Avvio tunnel per Backend (porta $BePort)..." -ForegroundColor Yellow
$beTunnelLog = "$env:TEMP\cloudflared_be.log"
$beTunnelProcess = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--url", "http://localhost:$BePort", "--no-autoupdate" `
    -RedirectStandardError $beTunnelLog `
    -PassThru -WindowStyle Hidden

# --- Avvia tunnel per il Frontend ---
Write-Host "Avvio tunnel per Frontend (porta $FePort)..." -ForegroundColor Yellow
$feTunnelLog = "$env:TEMP\cloudflared_fe.log"
$feTunnelProcess = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--url", "http://localhost:$FePort", "--no-autoupdate" `
    -RedirectStandardError $feTunnelLog `
    -PassThru -WindowStyle Hidden

# --- Attendi che i tunnel siano pronti ---
Write-Host ""
Write-Host "Attendo che i tunnel siano pronti..." -ForegroundColor Yellow

function Wait-ForTunnelUrl {
    param([string]$LogFile, [string]$Name, [int]$TimeoutSec = 30)
    
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
        
        if (Test-Path $LogFile) {
            $content = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
            if ($content -match 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com') {
                $url = $Matches[0]
                Write-Host "  $Name tunnel: $url" -ForegroundColor Green
                return $url
            }
        }
    }
    
    Write-Host "  Timeout per il tunnel $Name!" -ForegroundColor Red
    return $null
}

$beUrl = Wait-ForTunnelUrl -LogFile $beTunnelLog -Name "Backend"
$feUrl = Wait-ForTunnelUrl -LogFile $feTunnelLog -Name "Frontend"

if (-not $beUrl -or -not $feUrl) {
    Write-Host ""
    Write-Host "Errore: uno o entrambi i tunnel non sono partiti." -ForegroundColor Red
    Write-Host "Controlla i log:" -ForegroundColor Yellow
    Write-Host "  BE: $beTunnelLog" -ForegroundColor Yellow
    Write-Host "  FE: $feTunnelLog" -ForegroundColor Yellow
    
    # Cleanup
    if ($beTunnelProcess -and !$beTunnelProcess.HasExited) { $beTunnelProcess.Kill() }
    if ($feTunnelProcess -and !$feTunnelProcess.HasExited) { $feTunnelProcess.Kill() }
    exit 1
}

# --- Aggiorna environment.tunnel.ts ---
Write-Host ""
Write-Host "Aggiorno environment.tunnel.ts..." -ForegroundColor Yellow

$envContent = @"
export const environment = {
  production: false,
  apiUrl: '$beUrl',
  wsUrl: '$beUrl/ws-pubgame',
  frontendUrl: '$feUrl'
};
"@

Set-Content -Path $envFile -Value $envContent -Encoding UTF8
Write-Host "  environment.tunnel.ts aggiornato!" -ForegroundColor Green

# --- Istruzioni finali ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TUNNEL PRONTI!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend: $feUrl" -ForegroundColor White
Write-Host "  Backend:  $beUrl" -ForegroundColor White
Write-Host ""
Write-Host "  Ora avvia Angular con:" -ForegroundColor Yellow
Write-Host "    ng serve -c tunnel" -ForegroundColor White
Write-Host ""
Write-Host "  Per aprire dal telefono, scansiona questo URL:" -ForegroundColor Yellow
Write-Host "    $feUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Premi CTRL+C per chiudere i tunnel" -ForegroundColor Gray
Write-Host ""

# --- Mantieni lo script attivo e gestisci cleanup ---
try {
    while ($true) {
        # Controlla che i processi siano ancora attivi
        if ($beTunnelProcess.HasExited -or $feTunnelProcess.HasExited) {
            Write-Host "Un tunnel si e' chiuso inaspettatamente!" -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 5
    }
} finally {
    Write-Host ""
    Write-Host "Chiusura tunnel..." -ForegroundColor Yellow
    if ($beTunnelProcess -and !$beTunnelProcess.HasExited) { $beTunnelProcess.Kill() }
    if ($feTunnelProcess -and !$feTunnelProcess.HasExited) { $feTunnelProcess.Kill() }
    
    # Cleanup log files
    Remove-Item $beTunnelLog -ErrorAction SilentlyContinue
    Remove-Item $feTunnelLog -ErrorAction SilentlyContinue
    
    Write-Host "Tunnel chiusi. Arrivederci!" -ForegroundColor Green
}
