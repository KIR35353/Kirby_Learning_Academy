# Start-Meilisearch.ps1
# Starts Meilisearch in the foreground using the same master key as .env
# Data is stored in scripts\services\meili-data\
#
# Meilisearch API: http://localhost:7700

$ErrorActionPreference = "Stop"

$ScriptDir       = Split-Path -Parent $MyInvocation.MyCommand.Path
$MeiliExe        = Join-Path $ScriptDir "services\meilisearch.exe"
$DataDir         = Join-Path $ScriptDir "services\meili-data"

if (-not (Test-Path $MeiliExe)) {
    Write-Error "meilisearch.exe not found at $MeiliExe`nRun: scripts\Download-Services.ps1"
    exit 1
}

Write-Host ""
Write-Host "  Starting Meilisearch..." -ForegroundColor Cyan
Write-Host "  API   -> http://localhost:7700" -ForegroundColor Green
Write-Host "  Key   -> kla_meili_dev_key" -ForegroundColor Green
Write-Host ""

& $MeiliExe --master-key "kla_meili_dev_key" --db-path $DataDir
