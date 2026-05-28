# Deployment Guide — Kirby Learning Academy

## Production Environment

**Server:** hanson01.eastus.cloudapp.azure.com  
**App Path:** /opt/kla  
**SSH Key:** `hanson01.pem` (in project root)  
**Process Manager:** PM2  
**Port:** 3000 (proxied via nginx on 443)

---

## SSH Access

```bash
ssh -i hanson01.pem -o StrictHostKeyChecking=no azureuser@hanson01.eastus.cloudapp.azure.com
```

---

## Build Instructions (Local)

### Prerequisites
- Node.js 22+
- npm 10+
- PostgreSQL 16 running (via Docker Compose or native)
- PowerShell 5.1+ (for build/deploy scripts)

### Automated Build Validation (Recommended)

Use the automated build script for comprehensive validation before deploying:

**Full Build with All Checks** (TypeScript, lint, format, build):
```powershell
.\scripts\Build-Local.ps1
```

**Quick Build** (TypeScript + Build only):
```powershell
.\scripts\Build-Local.ps1 -Quick
```

**Clean Build** (remove artifacts and rebuild):
```powershell
.\scripts\Build-Local.ps1 -Clean
```

**Development Server**:
```powershell
.\scripts\Build-Local.ps1 -Watch
```

### Manual Build Steps

If you prefer to build manually:

```bash
cd c:\S2L_Dev\Kirby_Learning_Academy
npm ci
npx prisma generate
npm run build
```

### Manual Development Server
```bash
npm run dev
# App runs on http://localhost:3000
```

### Manual Linting & Type Check
```bash
npm run lint
npm run typecheck
npm run format:check
```

---

## Deployment to Production

### Automated Deployment (Recommended)

Use the automated deployment script for reliable production deployments with error handling, verification, and automatic rollback:

**Standard Deployment**:
```powershell
.\scripts\Deploy-Prod.ps1
```

**Force Deployment** (skip confirmation):
```powershell
.\scripts\Deploy-Prod.ps1 -Force
```

**Dry Run** (show what would deploy without making changes):
```powershell
.\scripts\Deploy-Prod.ps1 -DryRun
```

**Rollback to Previous Commit**:
```powershell
.\scripts\Deploy-Prod.ps1 -Rollback
```

The script handles:
- ✅ SSH connection verification
- ✅ Error detection and reporting
- ✅ Proper timeouts for long-running builds
- ✅ Build verification (checking for BUILD_ID file)
- ✅ PM2 status verification
- ✅ HTTP health checks with retries
- ✅ Automatic rollback on failure

**Output**: Logs saved to `deploy-log-YYYYMMDD-HHMMSS.txt`

### One-Command Manual Deploy

If you prefer to deploy manually without the script:

```bash
ssh -i hanson01.pem -o StrictHostKeyChecking=no azureuser@hanson01.eastus.cloudapp.azure.com \
  "cd /opt/kla && git pull origin main && npm run build && pm2 restart kla && pm2 save"
```

**Note**: This lacks error handling and verification. The automated script is recommended for production safety.

### Step-by-Step Manual Deploy

If you prefer to deploy manually without the automated script:

1. **Commit & Push Changes**
   ```bash
   git add .
   git commit -m "your message"
   git push origin main
   ```

2. **Connect to Production Server**
   ```bash
   ssh -i hanson01.pem azureuser@hanson01.eastus.cloudapp.azure.com
   ```

3. **Pull Latest Code**
   ```bash
   cd /opt/kla
   git pull origin main
   ```

4. **Build**
   ```bash
   npm run build
   ```
   Expected output: "Compiled successfully" + TypeScript check

5. **Restart Application**
   ```bash
   pm2 restart kla
   pm2 save
   ```

6. **Verify Health**
   ```bash
   pm2 status
   pm2 logs kla --lines 20
   ```

**Recommendation**: Use the automated script (`.\scripts\Deploy-Prod.ps1`) for safer, more reliable deployments with automatic error handling and rollback.

---

## Monitoring & Logs

### Check Application Status
```bash
ssh -i hanson01.pem azureuser@hanson01.eastus.cloudapp.azure.com "pm2 status"
```

### View Recent Logs
```bash
ssh -i hanson01.pem azureuser@hanson01.eastus.cloudapp.azure.com "pm2 logs kla --lines 50"
```

### Restart Application
```bash
ssh -i hanson01.pem azureuser@hanson01.eastus.cloudapp.azure.com "pm2 restart kla && pm2 save"
```

---

## Rollback

If deployment fails or introduces bugs:

```bash
ssh -i hanson01.pem azureuser@hanson01.eastus.cloudapp.azure.com \
  "cd /opt/kla && git revert HEAD && npm run build && pm2 restart kla && pm2 save"
```

Or checkout a specific commit:
```bash
ssh -i hanson01.pem azureuser@hanson01.eastus.cloudapp.azure.com \
  "cd /opt/kla && git checkout <commit-hash> && npm run build && pm2 restart kla && pm2 save"
```

---

## Environment Configuration

### Production .env
Located at `/opt/kla/.env` (managed separately for secrets)

Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection
- `AUTH_SECRET`: NextAuth.js secret
- `NEXTAUTH_URL`: https://hanson01.eastus.cloudapp.azure.com
- `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: MinIO/S3 credentials
- `S3_BUCKET_NAME`: kirby-learning-academy-dev

Do **not** commit `.env` to git.

---

## Recent Deployments

| Commit | Message | Date | Status |
|--------|---------|------|--------|
| 766cff5 | add dynamic favicon with Kirby brand colors | 2026-05-26 | ✅ Deployed |
| d1ab32d | display tenant Portal Name (appName) in dashboard welcome banner | 2026-05-26 | ✅ Deployed |
| 241ad31 | make credentials login email case-insensitive | 2026-05-26 | ✅ Deployed |

---

## Common Issues & Troubleshooting

### Build Fails: "Cannot find module"
```bash
cd /opt/kla
rm -rf node_modules package-lock.json
npm ci
npm run build
```

### Port Already in Use
```bash
# Kill whatever is using port 3000
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Git Push Rejected
Make sure you're on the main branch:
```bash
git branch
git checkout main
git pull origin main
git push origin main
```

### Prisma Schema Changes
After schema changes, migrations run automatically on first deployment. If needed manually:
```bash
ssh -i hanson01.pem azureuser@hanson01.eastus.cloudapp.azure.com \
  "cd /opt/kla && npx prisma migrate deploy"
```

---

## Pre-Deployment Checklist

### Recommended Approach
- [ ] Run `.\scripts\Build-Local.ps1` locally and verify success
- [ ] Code committed to git
- [ ] Changes pushed to origin main
- [ ] No untracked `.env` files being tracked by git

### Manual Approach (if not using script)
- [ ] Code committed to git
- [ ] `npm run lint` passes locally
- [ ] `npm run typecheck` passes locally
- [ ] `npm run build` succeeds locally
- [ ] All tests pass (if applicable)
- [ ] Changes pushed to origin main
- [ ] No untracked `.env` files being tracked by git

---

## nginx Configuration

Reverse proxy configured at `/etc/nginx/sites-available/cbt-island`

Key settings:
- `client_max_body_size 5m;` (allows large file uploads)
- Proxy to localhost:3000
- SSL/TLS termination

Restart nginx after changes:
```bash
sudo systemctl restart nginx
```

---

## Database Backups

PostgreSQL is running in Docker at `/opt/kla` with volume mounts.

To backup:
```bash
docker exec kla_postgres pg_dump -U kla kla_dev > backup_$(date +%Y%m%d_%H%M%S).sql
```

To restore:
```bash
docker exec -i kla_postgres psql -U kla kla_dev < backup_YYYYMMDD_HHMMSS.sql
```

---

## Next Steps

- Set up GitHub Actions for CI/CD (automate builds on push to main)
- Add monitoring/alerting (Sentry, CloudWatch)
- Document database migration procedures
- Set up automated backups
