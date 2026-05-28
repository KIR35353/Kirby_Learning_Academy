#Requires -Version 5.1
<#
.SYNOPSIS
    Local build validation script for Kirby Learning Academy
.DESCRIPTION
    Performs local build verification including dependency install, TypeScript
    check, linting, and full production build. Useful before deploying.
.PARAMETER Full
    Run full build including all checks (default)
.PARAMETER Quick
    Run only TypeScript and build checks (skip lint and tests)
.PARAMETER Clean
    Clean build artifacts before building
.PARAMETER Watch
    Run in watch mode (for development)
#>
param(
    [switch]$Full = $true,
    [switch]$Quick,
    [switch]$Clean,
    [switch]$Watch
)

# Configuration
$LOG_FILE = ".\build-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

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

function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Node.js found: $nodeVersion"
        } else {
            Write-Error-Custom "Node.js not found"
            exit 1
        }
    } catch {
        Write-Error-Custom "Node.js check failed: $_"
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "npm found: $npmVersion"
        } else {
            Write-Error-Custom "npm not found"
            exit 1
        }
    } catch {
        Write-Error-Custom "npm check failed: $_"
        exit 1
    }
}

function Clean-Build {
    Write-Info "Cleaning build artifacts..."
    
    try {
        Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Build artifacts cleaned"
    } catch {
        Write-Warning-Custom "Error during cleanup: $_"
    }
}

function Install-Dependencies {
    Write-Info "Installing dependencies with npm ci..."
    Write-Info "(Using npm ci for reproducible installs)"
    
    try {
        npm ci --prefer-offline
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Dependencies installed"
            return $true
        } else {
            Write-Error-Custom "npm ci failed"
            return $false
        }
    } catch {
        Write-Error-Custom "Dependency installation error: $_"
        return $false
    }
}

function Run-TypeScript-Check {
    Write-Info "Running TypeScript type check..."
    
    try {
        npm run typecheck 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "TypeScript check passed"
            return $true
        } else {
            Write-Error-Custom "TypeScript check failed"
            return $false
        }
    } catch {
        Write-Error-Custom "TypeScript check error: $_"
        return $false
    }
}

function Run-Linting {
    Write-Info "Running ESLint..."
    
    try {
        npm run lint 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Linting passed"
            return $true
        } else {
            Write-Warning-Custom "Linting found issues (see above)"
            return $false
        }
    } catch {
        Write-Error-Custom "Linting error: $_"
        return $false
    }
}

function Run-Format-Check {
    Write-Info "Checking code formatting..."
    
    try {
        npm run format:check 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Format check passed"
            return $true
        } else {
            Write-Warning-Custom "Format issues found (run 'npm run format' to fix)"
            return $false
        }
    } catch {
        Write-Error-Custom "Format check error: $_"
        return $false
    }
}

function Run-Build {
    Write-Info "Building application..."
    Write-Info "(This may take 3-5 minutes with TypeScript compilation)"
    
    try {
        npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Build completed successfully"
            return $true
        } else {
            Write-Error-Custom "Build failed"
            return $false
        }
    } catch {
        Write-Error-Custom "Build error: $_"
        return $false
    }
}

function Run-Dev {
    Write-Info "Starting development server on http://localhost:3000..."
    Write-Info "Press Ctrl+C to stop"
    
    try {
        npm run dev 2>&1
    } catch {
        Write-Error-Custom "Dev server error: $_"
        exit 1
    }
}

function Main {
    Write-Info "===== Kirby Learning Academy Build Validation ====="
    Write-Info "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Info "Log file: $LOG_FILE"
    Write-Info ""
    
    # Pre-flight checks
    Test-Prerequisites
    
    if ($Watch) {
        Write-Info "Starting development server..."
        Run-Dev
        exit 0
    }
    
    # Clean if requested
    if ($Clean) {
        Clean-Build
    }
    
    # Install dependencies
    if (-not (Install-Dependencies)) {
        Write-Error-Custom "Failed to install dependencies"
        exit 1
    }
    
    Write-Info ""
    
    # Quick or Full build
    if ($Quick) {
        Write-Info "Running QUICK build (TypeScript + Build only)..."
        $tsOk = Run-TypeScript-Check
        
        Write-Info ""
        $buildOk = Run-Build
        
        if ($tsOk -and $buildOk) {
            Write-Success "===== QUICK BUILD SUCCESSFUL ====="
            exit 0
        } else {
            Write-Error-Custom "===== BUILD FAILED ====="
            exit 1
        }
    } else {
        Write-Info "Running FULL build (all checks)..."
        
        $tsOk = Run-TypeScript-Check
        Write-Info ""
        
        $lintOk = Run-Linting
        Write-Info ""
        
        $formatOk = Run-Format-Check
        Write-Info ""
        
        $buildOk = Run-Build
        
        Write-Info ""
        Write-Info "===== BUILD SUMMARY ====="
        Write-Host "TypeScript check: $(if ($tsOk) { 'PASSED ✓' } else { 'FAILED ✗' })"
        Write-Host "Linting: $(if ($lintOk) { 'PASSED ✓' } else { 'WARNING ⚠' })"
        Write-Host "Format check: $(if ($formatOk) { 'PASSED ✓' } else { 'WARNING ⚠' })"
        Write-Host "Build: $(if ($buildOk) { 'PASSED ✓' } else { 'FAILED ✗' })"
        
        if ($tsOk -and $buildOk) {
            Write-Success "===== BUILD SUCCESSFUL ====="
            Write-Info "Ready to deploy"
            exit 0
        } else {
            Write-Error-Custom "===== BUILD FAILED ====="
            Write-Error-Custom "Fix errors above and try again"
            exit 1
        }
    }
}

# Run
Main
