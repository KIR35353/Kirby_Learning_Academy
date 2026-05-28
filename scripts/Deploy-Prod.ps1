#Requires -Version 5.1
<#
.SYNOPSIS
    Reliable production deployment script for Kirby Learning Academy
.DESCRIPTION
    Deploys to Azure VM with comprehensive error handling, timeout management,
    verification checks, and rollback capability.
.PARAMETER Force
    Skip confirmation prompt
.PARAMETER NoVerify
    Skip HTTP verification check (not recommended)
.PARAMETER Rollback
    Rollback to previous commit instead of deploying
.PARAMETER DryRun
    Show what would be deployed without actually deploying
#>
param(
    [switch]$Force,
    [switch]$NoVerify,
    [switch]$Rollback,
    [switch]$DryRun
)

# Configuration
$SERVER = "hanson01.eastus.cloudapp.azure.com"
$USER = "azureuser"
$KEYPATH = "hanson01.pem"
$APP_PATH = "/opt/kla"
$HTTP_CHECK_URL = "http://localhost:3000"
$LOG_FILE = ".\deploy-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

# Timeouts (in seconds)
$SSH_TIMEOUT = 300          # 5 minutes for SSH connection
$BUILD_TIMEOUT = 600        # 10 minutes for build process
$RESTART_TIMEOUT = 60       # 1 minute for PM2 restart
$VERIFY_TIMEOUT = 30        # 30 seconds for HTTP verification
$RETRY_ATTEMPTS = 3
$RETRY_DELAY = 5

# Colors
$SUCCESS = 'Green'
$ERROR_COLOR = 'Red'
$WARNING = 'Yellow'
$INFO = 'Cyan'

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $SUCCESS
    Write-Log "✓ $Message" "SUCCESS"
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $ERROR_COLOR
    Write-Log "✗ $Message" "ERROR"
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $WARNING
    Write-Log "⚠ $Message" "WARNING"
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor $INFO
    Write-Log "ℹ $Message" "INFO"
}

function Test-KeyFile {
    Write-Info "Checking SSH key file..."
    if (-not (Test-Path $KEYPATH)) {
        Write-Error-Custom "SSH key not found at: $KEYPATH"
        exit 1
    }
    Write-Success "SSH key found"
}

function Test-SSHConnection {
    Write-Info "Testing SSH connection to $SERVER..."
    try {
        $result = ssh -i $KEYPATH -o ConnectTimeout=10 -o StrictHostKeyChecking=no `
            $USER@$SERVER "echo 'Connection successful'" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "SSH connection verified"
            return $true
        } else {
            Write-Error-Custom "SSH connection failed: $result"
            return $false
        }
    } catch {
        Write-Error-Custom "SSH connection error: $_"
        return $false
    }
}

function Get-CurrentCommit {
    Write-Info "Getting current commit hash..."
    try {
        $commit = ssh -i $KEYPATH -o ConnectTimeout=10 $USER@$SERVER `
            "cd $APP_PATH && git rev-parse HEAD" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Current commit: $commit"
            return $commit
        } else {
            Write-Error-Custom "Could not get current commit: $commit"
            return $null
        }
    } catch {
        Write-Error-Custom "Error getting commit: $_"
        return $null
    }
}

function Deploy {
    Write-Info "Starting deployment process..."
    
    # Build the deployment command with explicit error handling
    $deployCommand = @"
set -e
cd $APP_PATH
echo '[1/5] Pulling latest code...'
git pull origin main
echo '[2/5] Installing dependencies...'
npm ci --prefer-offline
echo '[3/5] Building application...'
npm run build
echo '[4/5] Restarting PM2...'
pm2 restart kla
echo '[5/5] Saving PM2 config...'
pm2 save
echo 'Deployment completed successfully'
"@

    Write-Info "Executing deployment on $SERVER..."
    Write-Info "This will take 3-5 minutes. Waiting for completion..."
    
    try {
        $output = ssh -i $KEYPATH -o ConnectTimeout=$SSH_TIMEOUT `
            -o ServerAliveInterval=30 -o ServerAliveCountMax=10 `
            $USER@$SERVER $deployCommand 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Deployment command executed successfully"
            Write-Log $output "DEPLOY_OUTPUT"
            return $true
        } else {
            Write-Error-Custom "Deployment failed with exit code: $LASTEXITCODE"
            Write-Log $output "DEPLOY_ERROR"
            return $false
        }
    } catch {
        Write-Error-Custom "SSH deployment error: $_"
        return $false
    }
}

function Verify-Build {
    Write-Info "Verifying build completed..."
    
    try {
        $result = ssh -i $KEYPATH -o ConnectTimeout=$SSH_TIMEOUT $USER@$SERVER `
            "ls -lh $APP_PATH/.next/BUILD_ID 2>/dev/null && echo 'Build verified' || echo 'Build not found'" 2>&1
        
        if ($result -match "Build verified") {
            Write-Success "Build file verified on server"
            return $true
        } else {
            Write-Warning-Custom "Could not verify build file on server"
            return $false
        }
    } catch {
        Write-Warning-Custom "Error verifying build: $_"
        return $false
    }
}

function Get-PM2Status {
    Write-Info "Checking PM2 status..."
    
    try {
        $status = ssh -i $KEYPATH -o ConnectTimeout=$SSH_TIMEOUT $USER@$SERVER `
            "pm2 status" 2>&1
        Write-Log $status "PM2_STATUS"
        
        if ($status -match "online") {
            Write-Success "PM2 status: online"
            return $true
        } else {
            Write-Warning-Custom "PM2 status unclear. Full output:"
            Write-Host $status
            return $false
        }
    } catch {
        Write-Warning-Custom "Error checking PM2 status: $_"
        return $false
    }
}

function Test-HTTPHealth {
    Write-Info "Testing HTTP health check (attempt 1/$RETRY_ATTEMPTS)..."
    
    $attempt = 1
    while ($attempt -le $RETRY_ATTEMPTS) {
        try {
            $response = Invoke-WebRequest -Uri $HTTP_CHECK_URL `
                -TimeoutSec $VERIFY_TIMEOUT `
                -MaximumRetryCount 0 `
                -SkipHttpErrorCheck
            
            $statusCode = $response.StatusCode
            
            # 307 (auth redirect) or 200 is success - app is responding
            if ($statusCode -in @(200, 307)) {
                Write-Success "HTTP check passed (Status: $statusCode)"
                return $true
            } else {
                Write-Warning-Custom "Unexpected status code: $statusCode"
            }
        } catch {
            if ($attempt -lt $RETRY_ATTEMPTS) {
                Write-Warning-Custom "HTTP check failed (attempt $attempt/$RETRY_ATTEMPTS). Retrying in ${RETRY_DELAY}s..."
                Start-Sleep -Seconds $RETRY_DELAY
                $attempt++
            } else {
                Write-Error-Custom "HTTP health check failed after $RETRY_ATTEMPTS attempts"
                Write-Log "HTTP error: $_" "HTTP_ERROR"
                return $false
            }
        }
    }
    
    return $false
}

function RollbackDeployment {
    param([string]$PreviousCommit)
    
    Write-Warning-Custom "Initiating rollback to $PreviousCommit..."
    
    try {
        $rollbackCommand = @"
set -e
cd $APP_PATH
git reset --hard $PreviousCommit
npm ci --prefer-offline
npm run build
pm2 restart kla
pm2 save
echo 'Rollback completed'
"@

        $output = ssh -i $KEYPATH -o ConnectTimeout=$SSH_TIMEOUT `
            -o ServerAliveInterval=30 -o ServerAliveCountMax=10 `
            $USER@$SERVER $rollbackCommand 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Rollback completed successfully"
            Write-Log $output "ROLLBACK_OUTPUT"
            return $true
        } else {
            Write-Error-Custom "Rollback failed: $output"
            return $false
        }
    } catch {
        Write-Error-Custom "Rollback error: $_"
        return $false
    }
}

function DoRollback {
    Write-Warning-Custom "Rolling back to previous commit..."
    
    # Get previous commit
    try {
        $prevCommit = ssh -i $KEYPATH -o ConnectTimeout=$SSH_TIMEOUT $USER@$SERVER `
            "cd $APP_PATH && git rev-parse HEAD~1" 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Could not get previous commit"
            exit 1
        }
        
        Write-Info "Rolling back to commit: $prevCommit"
        
        if (RollbackDeployment $prevCommit) {
            Write-Success "Rollback successful. Verifying..."
            Start-Sleep -Seconds 5
            
            if (Test-HTTPHealth) {
                Write-Success "Application verified after rollback"
            } else {
                Write-Warning-Custom "Could not verify application after rollback"
            }
        } else {
            Write-Error-Custom "Rollback failed. Manual intervention may be required."
            exit 1
        }
    } catch {
        Write-Error-Custom "Rollback error: $_"
        exit 1
    }
}

# Main execution
function Main {
    Write-Info "===== Kirby Learning Academy Deployment ====="
    Write-Info "Target: $SERVER"
    Write-Info "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Info "Log file: $LOG_FILE"
    
    # Pre-flight checks
    Test-KeyFile
    if (-not (Test-SSHConnection)) {
        Write-Error-Custom "Cannot establish SSH connection. Aborting."
        exit 1
    }
    
    $previousCommit = Get-CurrentCommit
    if (-not $previousCommit) {
        Write-Error-Custom "Could not determine current commit. Aborting."
        exit 1
    }
    
    # Show what we're about to do
    Write-Info "Current commit: $previousCommit"
    Write-Info "Next action: Pull latest, build, and restart PM2"
    
    if ($DryRun) {
        Write-Info "DRY RUN mode - no changes will be made"
        exit 0
    }
    
    if (-not $Rollback -and -not $Force) {
        Write-Host ""
        Write-Warning-Custom "Ready to deploy. Continue? (y/n)"
        $confirm = Read-Host
        if ($confirm -ne 'y') {
            Write-Warning-Custom "Deployment cancelled"
            exit 0
        }
    }
    
    # Rollback mode
    if ($Rollback) {
        DoRollback
        exit 0
    }
    
    # Normal deployment
    Write-Info ""
    
    if (Deploy) {
        Write-Success "Deployment command completed"
        
        Write-Info ""
        Write-Info "Post-deployment verification..."
        Start-Sleep -Seconds 3
        
        # Verify deployment
        $buildOk = Verify-Build
        $pm2Ok = Get-PM2Status
        $httpOk = $NoVerify ? $true : (Test-HTTPHealth)
        
        Write-Info ""
        if ($buildOk -and $pm2Ok -and $httpOk) {
            Write-Success "===== DEPLOYMENT SUCCESSFUL ====="
            Write-Success "New commit deployed and verified"
            Write-Log "Deployment completed successfully" "FINAL_STATUS"
            exit 0
        } else {
            Write-Warning-Custom "Deployment completed but verification had issues:"
            Write-Warning-Custom "  Build verified: $buildOk"
            Write-Warning-Custom "  PM2 online: $pm2Ok"
            Write-Warning-Custom "  HTTP healthy: $httpOk"
            Write-Warning-Custom ""
            Write-Warning-Custom "Check server status manually:"
            Write-Info "  ssh -i $KEYPATH $USER@$SERVER 'pm2 logs kla --lines 20'"
            Write-Log "Deployment completed with verification warnings" "FINAL_STATUS"
            exit 0
        }
    } else {
        Write-Error-Custom "===== DEPLOYMENT FAILED ====="
        Write-Error-Custom "Build or restart failed. Attempting rollback..."
        Write-Log "Deployment failed, initiating rollback" "FINAL_STATUS"
        
        if (RollbackDeployment $previousCommit) {
            Write-Success "Rollback successful"
            exit 1
        } else {
            Write-Error-Custom "ROLLBACK FAILED - Manual intervention required!"
            Write-Error-Custom "Previous commit: $previousCommit"
            exit 1
        }
    }
}

# Run
Main
