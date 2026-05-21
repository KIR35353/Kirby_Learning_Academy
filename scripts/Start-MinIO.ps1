# Start-MinIO.ps1
# Starts MinIO in the foreground using the same credentials as .env
# Data is stored in scripts\services\minio-data\
#
# MinIO console: http://localhost:9001
# S3 API:        http://localhost:9000
# Login:         kla_minio / kla_minio_dev

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$MinioExe   = Join-Path $ScriptDir "services\minio.exe"
$DataDir    = Join-Path $ScriptDir "services\minio-data"

if (-not (Test-Path $MinioExe)) {
    Write-Error "minio.exe not found at $MinioExe`nRun: scripts\Download-Services.ps1"
    exit 1
}

$env:MINIO_ROOT_USER     = "kla_minio"
$env:MINIO_ROOT_PASSWORD = "kla_minio_dev"

Write-Host ""
Write-Host "  Starting MinIO..." -ForegroundColor Cyan
Write-Host "  S3 API   -> http://localhost:9000" -ForegroundColor Green
Write-Host "  Console  -> http://localhost:9001" -ForegroundColor Green
Write-Host "  Login    -> kla_minio / kla_minio_dev" -ForegroundColor Green
Write-Host "  Bucket   -> kirby-learning-academy-dev  (create in console on first run)" -ForegroundColor Yellow
Write-Host ""

& $MinioExe server $DataDir --console-address ":9001"
