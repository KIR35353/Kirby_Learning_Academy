# Start-Dev.ps1
# Starts all local dev services (MinIO, Meilisearch) in background jobs,
# initialises the MinIO bucket, then launches the Next.js dev server.
#
# Usage:  .\scripts\Start-Dev.ps1
# Stop:   Ctrl+C  (background jobs are cleaned up automatically)

$ErrorActionPreference = "Stop"

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$ScriptDir = Join-Path $Root "scripts"
$ServicesDir = Join-Path $ScriptDir "services"

$MinioExe  = Join-Path $ServicesDir "minio.exe"
$MeiliExe  = Join-Path $ServicesDir "meilisearch.exe"
$MinioData = Join-Path $ServicesDir "minio-data"
$MeiliData = Join-Path $ServicesDir "meili-data"

# ── Validate binaries ─────────────────────────────────────────────────────────
$missing = @()
if (-not (Test-Path $MinioExe))  { $missing += "minio.exe" }
if (-not (Test-Path $MeiliExe))  { $missing += "meilisearch.exe" }
if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "  Missing binaries: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "  Run: .\scripts\Download-Services.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# ── Helper: check if a port is already in use ─────────────────────────────────
function Test-Port($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

# ── Start MinIO (background) ──────────────────────────────────────────────────
if (Test-Port 9000) {
    Write-Host "  MinIO      already running on :9000" -ForegroundColor DarkGray
} else {
    $env:MINIO_ROOT_USER     = "kla_minio"
    $env:MINIO_ROOT_PASSWORD = "kla_minio_dev"
    $minioJob = Start-Job -Name "MinIO" -ScriptBlock {
        param($exe, $data)
        $env:MINIO_ROOT_USER     = "kla_minio"
        $env:MINIO_ROOT_PASSWORD = "kla_minio_dev"
        & $exe server $data --console-address ":9001" 2>&1
    } -ArgumentList $MinioExe, $MinioData
    Write-Host "  MinIO      started  -> S3 :9000  Console :9001  (job $($minioJob.Id))" -ForegroundColor Green

    # Wait up to 8 s for MinIO to be ready
    $ready = $false
    for ($i = 0; $i -lt 16; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) {
        Write-Host "  WARNING: MinIO did not respond within 8 s" -ForegroundColor Yellow
    }
}

# ── Initialise MinIO bucket (idempotent) ──────────────────────────────────────
try {
    $bucketOut = node "$Root\scripts\init-minio-bucket.mjs" 2>&1
    Write-Host "  MinIO      bucket   -> $bucketOut" -ForegroundColor DarkGray
} catch {
    Write-Host "  WARNING: Could not initialise MinIO bucket: $_" -ForegroundColor Yellow
}

# ── Start Meilisearch (background) ────────────────────────────────────────────
if (Test-Port 7700) {
    Write-Host "  Meili      already running on :7700" -ForegroundColor DarkGray
} else {
    $meiliJob = Start-Job -Name "Meilisearch" -ScriptBlock {
        param($exe, $data, $key)
        & $exe --master-key $key --db-path $data 2>&1
    } -ArgumentList $MeiliExe, $MeiliData, "kla_meili_dev_key"
    Write-Host "  Meilisearch started  -> :7700  (job $($meiliJob.Id))" -ForegroundColor Green

    # Wait up to 8 s for Meilisearch to be ready
    $meiliReady = $false
    for ($i = 0; $i -lt 16; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:7700/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $meiliReady = $true; break }
        } catch { }
    }
    if (-not $meiliReady) {
        Write-Host "  WARNING: Meilisearch did not respond within 8 s" -ForegroundColor Yellow
    }
}

# ── Reindex courses into Meilisearch ─────────────────────────────────────────
try {
    node "$Root\scripts\reindex-courses.mjs" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
} catch {
    Write-Host "  WARNING: Course reindex failed (catalog may be empty): $_" -ForegroundColor Yellow
}

# ── Ensure Prisma client is generated ────────────────────────────────────────
Write-Host "  Prisma     generating client..." -ForegroundColor Cyan
node "$Root\node_modules\prisma\build\index.js" generate | Out-Null
Write-Host "  Prisma     client ready" -ForegroundColor Green

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Services ready. Starting Next.js dev server..." -ForegroundColor Cyan
Write-Host "  App  -> http://localhost:3000" -ForegroundColor White
Write-Host ""

# ── Start Next.js dev server (foreground) ────────────────────────────────────
# Runs in the foreground so Ctrl+C stops everything cleanly.
try {
    Set-Location $Root
    node node_modules/next/dist/bin/next dev
} finally {
    # ── Cleanup background jobs on exit ──────────────────────────────────────
    Write-Host ""
    Write-Host "  Stopping background services..." -ForegroundColor Cyan
    Get-Job -Name "MinIO","Meilisearch" -ErrorAction SilentlyContinue | Stop-Job -PassThru | Remove-Job
    Write-Host "  Done." -ForegroundColor Green
}
