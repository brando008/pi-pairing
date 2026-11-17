$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AgentDir = if ($env:PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR } else { Join-Path $HOME '.pi\agent' }
$SkillDir = Join-Path $AgentDir 'skills\pi-pairing'
$BinDir = Join-Path $AgentDir 'bin'
$StartServer = $true

foreach ($Argument in $args) {
    if ($Argument -eq '--no-server') {
        $StartServer = $false
    } else {
        Write-Error "Unknown option: $Argument"
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js 18 or newer is required.'
}

$NodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($NodeMajor -lt 18) {
    Write-Error "Node.js 18 or newer is required (found $(node --version))."
}

New-Item -ItemType Directory -Force -Path (Join-Path $AgentDir 'skills'), $BinDir | Out-Null

if (Test-Path $SkillDir) {
    $Backup = "$SkillDir.backup-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Move-Item $SkillDir $Backup
    Write-Host "Backed up the previous skill to $Backup"
}

Copy-Item (Join-Path $RootDir 'skills\pi-pairing') $SkillDir -Recurse
Write-Host "Installed the pi-pairing skill at $SkillDir"

$Wrapper = Join-Path $BinDir 'pi-pairing.cmd'
@"
@echo off
node "$RootDir\cli.js" %*
"@ | Set-Content -Path $Wrapper -Encoding ascii
Write-Host "Installed the CLI wrapper at $Wrapper"

if ($StartServer) {
    & (Join-Path $RootDir 'scripts\ensure-server.cmd')
}

Write-Host ''
Write-Host 'Pi Pairing is installed.'
Write-Host '  Dashboard: http://127.0.0.1:4173'
Write-Host '  CLI:       "pi-pairing" --help'
