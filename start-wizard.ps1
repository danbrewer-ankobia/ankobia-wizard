# Ankobia Wizard - set up (first run) and start on Windows.
# Easiest: double-click "Start Wizard.cmd" next to this file.
#
#   -Rebuild        force a fresh build
#   -NoStart        set up and build only (don't start the server)
#   -AdminPassword  set the admin password without being asked (first run only)
param(
    [switch]$Rebuild,
    [switch]$NoStart,
    [string]$AdminPassword
)

$ErrorActionPreference = "Stop"
$Port = 3100
$Url = "http://localhost:$Port"
Set-Location $PSScriptRoot

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host ""; Write-Host "ERROR: $text" -ForegroundColor Red; exit 1 }

function New-RandomString([int]$bytes, [switch]$Hex) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    if ($Hex) { return ($buf | ForEach-Object { $_.ToString("x2") }) -join "" }
    return ([Convert]::ToBase64String($buf) -replace "[^A-Za-z0-9]", "")
}

Write-Host "Ankobia Wizard" -ForegroundColor Green

# --- 1. Node.js 20+ ---
Step "Checking Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail "Node.js is not installed. Install the LTS version from https://nodejs.org, then run this again." }
$nodeMajor = [int]((node -v).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) { Fail "Node.js $(node -v) is too old. Install version 20 or newer from https://nodejs.org." }
Write-Host "Node.js $(node -v)"

# --- 2. pnpm ---
Step "Checking pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing pnpm..."
    npm install -g pnpm@10 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "Couldn't install pnpm. Run 'npm install -g pnpm@10' in a terminal and try again." }
}
Write-Host "pnpm $(pnpm -v)"

# --- 3. Settings file (.env.local) ---
if (-not (Test-Path ".env.local")) {
    Step "First-time setup"
    $generated = $false
    if (-not $AdminPassword) {
        Write-Host "Choose a password for the Admin page (where you add the AI key and edit prompts)."
        Write-Host "Leave it blank to generate one."
        $secure = Read-Host "Admin password" -AsSecureString
        $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    }
    if (-not $AdminPassword) { $AdminPassword = New-RandomString 12; $generated = $true }

    $envText = @(
        "# Created by start-wizard.ps1. Local settings - never commit this file."
        "ADMIN_PASSWORD=$AdminPassword"
        "ADMIN_SECRET=$(New-RandomString 32 -Hex)"
        "# Optional: a Claude API key here is used if none is saved on the Admin page."
        "# ANTHROPIC_API_KEY=sk-ant-..."
        ""
    ) -join "`r`n"
    # UTF-8 without a byte-order mark so the first setting is read correctly.
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot ".env.local"), $envText, (New-Object Text.UTF8Encoding $false))

    if ($generated) {
        Write-Host ""
        Write-Host "Your admin password is: $AdminPassword" -ForegroundColor Yellow
        Write-Host "(It's saved in .env.local in this folder if you forget it.)"
    }
    else {
        Write-Host "Saved. You can change it later in .env.local in this folder."
    }
}

# --- 4. Install packages ---
Step "Installing packages (first run takes a minute or two)"
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Fail "Package install failed. Check your internet connection and try again." }

# --- 5. Build when needed ---
$buildId = ".next\BUILD_ID"
$needBuild = $Rebuild -or -not (Test-Path $buildId)
if (-not $needBuild) {
    $built = (Get-Item $buildId).LastWriteTime
    # Folders are scanned recursively; files are checked directly (passing a file
    # name to -Recurse makes PowerShell 5.1 search all of node_modules).
    $sources = @(Get-ChildItem -Path src, public -Recurse -File -ErrorAction SilentlyContinue) +
        @(Get-Item -Path package.json, next.config.ts, pnpm-lock.yaml -ErrorAction SilentlyContinue)
    $newer = $sources | Where-Object { $_.LastWriteTime -gt $built } | Select-Object -First 1
    $needBuild = [bool]$newer
}
if ($needBuild) {
    Step "Building the app (about a minute)"
    pnpm build
    if ($LASTEXITCODE -ne 0) { Fail "The build failed. See the messages above." }
}
else {
    Step "App is already built"
}

if ($NoStart) { Write-Host ""; Write-Host "Setup complete. Run this again without -NoStart to start the Wizard."; exit 0 }

# --- 6. Start (or reuse a running copy) ---
$running = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($running) {
    Write-Host ""
    Write-Host "Something is already running on port $Port - opening it in your browser."
    Start-Process $Url
    exit 0
}

# Open the browser once the server answers.
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    "-NoProfile", "-Command",
    "for (`$i = 0; `$i -lt 60; `$i++) { try { Invoke-WebRequest '$Url/api/config' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process '$Url'; break } catch { Start-Sleep -Seconds 1 } }"
)

Write-Host ""
Write-Host "Ankobia Wizard is starting at $Url" -ForegroundColor Green
Write-Host "  Wizard: $Url"
Write-Host "  Admin:  $Url/admin  (add your Claude API key there first)"
Write-Host ""
Write-Host "Keep this window open while you use the Wizard. Close it to stop."
Write-Host ""
pnpm start
