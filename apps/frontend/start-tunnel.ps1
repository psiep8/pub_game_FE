# ============================================================
#  PubGame — Tunnel Cloudflare (un solo tunnel)
#
#  Il frontend chiama sempre la propria origine: /games, /categories,
#  /questions e /ws-pubgame vengono inoltrati dal dev-server al backend
#  (proxy.conf.mjs). Un tunnel verso la porta del frontend basta quindi per
#  TV, admin e per tutti i telefoni: un URL solo, nessun tunnel backend.
#
#  Uso:  npm run dev            (in un terminale)
#        .\start-tunnel.ps1     (in un altro)
# ============================================================

param(
    [int]$FePort = 0
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repoRoot ".env"

function Get-EnvValue {
    param([string]$Key)

    if (-not (Test-Path $envFile)) { return $null }

    foreach ($line in Get-Content $envFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -match "^\s*$([regex]::Escape($Key))\s*=\s*(.*)$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

if ($FePort -le 0) {
    $envPort = Get-EnvValue "FE_PORT"
    if (-not [int]::TryParse($envPort, [ref]$FePort)) { $FePort = 4200 }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PubGame Tunnel Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $null = Get-Command cloudflared -ErrorAction Stop
} catch {
    Write-Host "cloudflared non trovato! Installalo con:" -ForegroundColor Red
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Yellow
    exit 1
}

# Fail fast: un tunnel verso una porta spenta risponde 502 e fa perdere minuti.
Write-Host "Verifico il dev-server su http://localhost:$FePort ..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "http://localhost:$FePort" -UseBasicParsing -TimeoutSec 3
} catch {
    Write-Host "  Nessuna risposta su http://localhost:$FePort" -ForegroundColor Red
    Write-Host "  Avvia prima il progetto con 'npm run dev' in un altro terminale." -ForegroundColor Yellow
    exit 1
}
Write-Host "  dev-server attivo" -ForegroundColor Green

$tunnelLog = Join-Path $env:TEMP "pubgame-tunnel.log"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

Write-Host ""
Write-Host "Avvio il tunnel verso il frontend (porta $FePort)..." -ForegroundColor Yellow
$tunnelProcess = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--url", "http://localhost:$FePort", "--no-autoupdate" `
    -RedirectStandardError $tunnelLog `
    -PassThru -WindowStyle Hidden

$publicUrl = $null
$elapsed = 0
while ($elapsed -lt 30 -and -not $publicUrl) {
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5

    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com') {
            $publicUrl = $Matches[0]
        }
    }
}

if (-not $publicUrl) {
    Write-Host ""
    Write-Host "Tunnel non avviato. Controlla il log:" -ForegroundColor Red
    Write-Host "  $tunnelLog" -ForegroundColor Yellow
    if ($tunnelProcess -and !$tunnelProcess.HasExited) { $tunnelProcess.Kill() }
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TUNNEL PRONTO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  TV (schermo):  $publicUrl/tv" -ForegroundColor White
Write-Host "  Admin:         $publicUrl/admin" -ForegroundColor White
Write-Host "  Telefoni:      $publicUrl/play" -ForegroundColor White
Write-Host ""
Write-Host "  Lo stesso URL vale per tutti i telefoni: aprono /play" -ForegroundColor Gray
Write-Host "  o inquadrano il QR mostrato dalla TV." -ForegroundColor Gray
Write-Host ""
Write-Host "  Premi CTRL+C per chiudere il tunnel" -ForegroundColor Gray
Write-Host ""

try {
    while ($true) {
        if ($tunnelProcess.HasExited) {
            Write-Host "Il tunnel si e' chiuso inaspettatamente!" -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 5
    }
} finally {
    Write-Host ""
    Write-Host "Chiusura tunnel..." -ForegroundColor Yellow
    if ($tunnelProcess -and !$tunnelProcess.HasExited) { $tunnelProcess.Kill() }
    Remove-Item $tunnelLog -ErrorAction SilentlyContinue
    Write-Host "Tunnel chiuso. Arrivederci!" -ForegroundColor Green
}
