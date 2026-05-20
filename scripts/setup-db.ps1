# Kirby Learning Academy — local database setup
# Run this once to create the dev user and database.
# Usage: .\scripts\setup-db.ps1

$pgbin = "C:\Program Files\PostgreSQL\17\bin"

$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kla') THEN
    CREATE ROLE kla WITH LOGIN PASSWORD 'kla_dev_password';
  END IF;
END
`$`$;

CREATE DATABASE kla_dev OWNER kla;
GRANT ALL PRIVILEGES ON DATABASE kla_dev TO kla;
"@

Write-Host "Creating KLA database user and database..."
Write-Host "(You will be prompted for the postgres superuser password)"

$sql | & "$pgbin\psql.exe" -U postgres

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅  Database setup complete." -ForegroundColor Green
    Write-Host "    User:     kla"
    Write-Host "    Password: kla_dev_password"
    Write-Host "    Database: kla_dev"
} else {
    Write-Host "`n❌  Something went wrong. Check the output above." -ForegroundColor Red
}
