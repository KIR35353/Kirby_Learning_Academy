<#
.SYNOPSIS
    Export users from Microsoft 365 / Azure AD to a CSV ready for the KLA user import.

.DESCRIPTION
    Three export paths — pick whichever matches your environment:

    1. GRAPH (recommended)  — Microsoft Graph PowerShell. Pulls the M365 directory.
    2. EXCHANGE             — Exchange Online PowerShell. Pulls the GAL (Global Address List).
    3. OUTLOOK-LOCAL        — Manual instructions for exporting from the Outlook desktop app.

    All three produce a CSV that the KLA Admin → Users → Import CSV feature can consume.

.EXAMPLE
    # Graph export (most complete data):
    .\Export-OutlookUsers.ps1 -Method Graph -OutputPath .\kla-users.csv

    # Exchange export:
    .\Export-OutlookUsers.ps1 -Method Exchange -OutputPath .\kla-users.csv

.NOTES
    Required modules (install once):
      Graph:    Install-Module Microsoft.Graph -Scope CurrentUser
      Exchange: Install-Module ExchangeOnlineManagement -Scope CurrentUser
#>

[CmdletBinding()]
param (
    [ValidateSet('Graph', 'Exchange', 'Help')]
    [string] $Method = 'Graph',

    [string] $OutputPath = '.\kla-users.csv',

    # Optional: filter to a specific domain suffix, e.g. "@kirbycorp.com"
    [string] $Domain = '',

    # Optional: only export enabled / active accounts
    [switch] $ActiveOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Normalize-Bool($val) {
    if ($null -eq $val) { return $false }
    if ($val -is [bool]) { return $val }
    return ($val -match '^(true|yes|1)$')
}

# ── Method: Graph ─────────────────────────────────────────────────────────────
if ($Method -eq 'Graph') {
    Write-Host "Connecting to Microsoft Graph (User.Read.All required)..." -ForegroundColor Cyan

    if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Users)) {
        Write-Error "Microsoft.Graph module not found. Run: Install-Module Microsoft.Graph -Scope CurrentUser"
    }

    Connect-MgGraph -Scopes "User.Read.All" -NoWelcome

    $props = @(
        'displayName', 'givenName', 'surname', 'mail', 'userPrincipalName',
        'department', 'jobTitle', 'officeLocation', 'city',
        'mobilePhone', 'businessPhones', 'accountEnabled',
        'employeeHireDate', 'employeeType', 'companyName', 'id'
    )

    Write-Host "Fetching users from Azure AD..." -ForegroundColor Cyan
    $filter = if ($ActiveOnly) { "accountEnabled eq true" } else { $null }

    $mgUsers = Get-MgUser -All -Property $props `
        -Filter $filter `
        -ConsistencyLevel eventual `
        -ErrorAction SilentlyContinue

    if ($Domain) {
        $mgUsers = $mgUsers | Where-Object {
            $_.mail -like "*$Domain" -or $_.userPrincipalName -like "*$Domain"
        }
    }

    $rows = $mgUsers | ForEach-Object {
        $email = if ($_.mail) { $_.mail } else { $_.userPrincipalName }
        [PSCustomObject]@{
            name          = $_.displayName
            first_name    = $_.givenName
            last_name     = $_.surname
            email         = $email
            department    = $_.department
            job_title     = $_.jobTitle
            location      = if ($_.officeLocation) { $_.officeLocation } else { $_.city }
            phone         = if ($_.mobilePhone) { $_.mobilePhone } elseif ($_.businessPhones) { $_.businessPhones[0] } else { '' }
            hire_date     = if ($_.employeeHireDate) { ([datetime]$_.employeeHireDate).ToString('yyyy-MM-dd') } else { '' }
            is_contractor = ($_.employeeType -in @('Vendor', 'Contractor', 'Consultant'))
            is_active     = [bool]$_.accountEnabled
            azure_ad_id   = $_.id
        }
    }

    Disconnect-MgGraph | Out-Null
}

# ── Method: Exchange ──────────────────────────────────────────────────────────
elseif ($Method -eq 'Exchange') {
    Write-Host "Connecting to Exchange Online..." -ForegroundColor Cyan

    if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
        Write-Error "ExchangeOnlineManagement module not found. Run: Install-Module ExchangeOnlineManagement -Scope CurrentUser"
    }

    Connect-ExchangeOnline -ShowBanner:$false

    Write-Host "Fetching users from Exchange GAL..." -ForegroundColor Cyan
    $exUsers = Get-User -ResultSize Unlimited -Filter "RecipientType -eq 'UserMailbox'"

    if ($ActiveOnly) {
        $exUsers = $exUsers | Where-Object { -not $_.IsDisabled }
    }
    if ($Domain) {
        $exUsers = $exUsers | Where-Object { $_.WindowsEmailAddress -like "*$Domain" }
    }

    $rows = $exUsers | ForEach-Object {
        [PSCustomObject]@{
            name          = $_.DisplayName
            first_name    = $_.FirstName
            last_name     = $_.LastName
            email         = $_.WindowsEmailAddress.ToString()
            department    = $_.Department
            job_title     = $_.Title
            location      = if ($_.Office) { $_.Office } else { $_.City }
            phone         = $_.Phone
            hire_date     = ''
            is_contractor = $false
            is_active     = -not $_.IsDisabled
            azure_ad_id   = ''
        }
    }

    Disconnect-ExchangeOnline -Confirm:$false | Out-Null
}

# ── Method: Help ──────────────────────────────────────────────────────────────
elseif ($Method -eq 'Help') {
    Write-Host @"

MANUAL OUTLOOK EXPORT (no PowerShell needed)
─────────────────────────────────────────────
1. Open Outlook desktop
2. File → Open & Export → Import/Export
3. "Export to a file" → Next
4. "Comma Separated Values" → Next
5. Select "Contacts" (or the contacts folder you want) → Next
6. Choose a save location and filename → Finish

The resulting CSV will have columns like:
  First Name, Last Name, Name, E-mail Address, Company,
  Department, Job Title, Business Phone, Business City

Upload that file directly to KLA Admin → Users → Import CSV.
KLA automatically maps Outlook's column names.

"@ -ForegroundColor Yellow
    exit 0
}

# ── Write output ──────────────────────────────────────────────────────────────
if ($rows) {
    $count = ($rows | Measure-Object).Count
    $rows | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8
    Write-Host "Exported $count users to: $OutputPath" -ForegroundColor Green
    Write-Host "Upload this file at: KLA Admin → User Management → Import CSV" -ForegroundColor Cyan
} else {
    Write-Warning "No users found with the current filters."
}
