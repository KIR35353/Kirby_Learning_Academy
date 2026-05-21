# Download-Services.ps1
# Downloads MinIO and Meilisearch standalone Windows executables into scripts\services\
# Run this once; the executables are gitignored.

$ErrorActionPreference = "Stop"

$ServicesDir = Join-Path $PSScriptRoot "services"
New-Item -ItemType Directory -Force $ServicesDir | Out-Null

# ── MinIO ──────────────────────────────────────────────────────────────────────
$MinioExe = Join-Path $ServicesDir "minio.exe"
if (Test-Path $MinioExe) {
    Write-Host "  minio.exe already present — skipping" -ForegroundColor Yellow
} else {
    Write-Host "  Downloading MinIO (~100 MB)..." -ForegroundColor Cyan
    Invoke-WebRequest `
        -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" `
        -OutFile $MinioExe `
        -UseBasicParsing
    Write-Host "  minio.exe downloaded." -ForegroundColor Green
}

# ── Meilisearch ────────────────────────────────────────────────────────────────
$MeiliExe = Join-Path $ServicesDir "meilisearch.exe"
if (Test-Path $MeiliExe) {
    Write-Host "  meilisearch.exe already present — skipping" -ForegroundColor Yellow
} else {
    Write-Host "  Resolving latest Meilisearch release..." -ForegroundColor Cyan
    $release  = Invoke-RestMethod -Uri "https://api.github.com/repos/meilisearch/meilisearch/releases/latest" -UseBasicParsing
    $asset    = $release.assets | Where-Object { $_.name -eq "meilisearch-windows-amd64.exe" }
    if (-not $asset) { Write-Error "Could not find meilisearch-windows-amd64.exe in latest release."; exit 1 }
    Write-Host "  Downloading Meilisearch $($release.tag_name) (~40 MB)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $MeiliExe -UseBasicParsing
    Write-Host "  meilisearch.exe downloaded." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Done! Start the services with:" -ForegroundColor Cyan
Write-Host "    PowerShell -File scripts\Start-MinIO.ps1"
Write-Host "    PowerShell -File scripts\Start-Meilisearch.ps1"
