<#
.SYNOPSIS
  Payo installer for Windows — https://payo.uttamgelot.com

.DESCRIPTION
  irm https://payo.uttamgelot.com/install.ps1 | iex

  Installs the `payo` CLI. If bun or a new enough node is already available the
  published npm package is used (a ~300 KB download you can update with tools
  you already have); otherwise a standalone binary is fetched from the GitHub
  release, so machines with no JavaScript runtime at all are supported.

  Configured with environment variables, since `irm | iex` cannot pass args:

    $env:PAYO_VERSION        install this version instead of latest
    $env:PAYO_INSTALL_DIR    where the binary goes (%LOCALAPPDATA%\payo\bin)
    $env:PAYO_INSTALL_METHOD auto | binary | npm | bun
    $env:PAYO_FORCE          1 to reinstall even if already current
#>

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 can still default to TLS 1.0, which GitHub rejects.
try {
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

$Repo = 'uttam-gelot/payo'
$Pkg = '@uge/payo'

# Overridable so the installer can be exercised against a local server before a
# release exists. Not part of the documented interface.
$ApiUrl = if ($env:PAYO_API_URL) { $env:PAYO_API_URL }
          else { "https://api.github.com/repos/$Repo/releases/latest" }
$ReleaseBase = if ($env:PAYO_RELEASE_BASE) { $env:PAYO_RELEASE_BASE }
               else { "https://github.com/$Repo/releases/download" }

$InstallDir = if ($env:PAYO_INSTALL_DIR) { $env:PAYO_INSTALL_DIR }
              else { Join-Path $env:LOCALAPPDATA 'payo\bin' }
$Method = if ($env:PAYO_INSTALL_METHOD) { $env:PAYO_INSTALL_METHOD } else { 'auto' }
$Version = $env:PAYO_VERSION
# Treat 0/false as off — [bool] on any non-empty string would be $true.
$Force = $env:PAYO_FORCE -and $env:PAYO_FORCE -notin @('0', 'false', 'no')

function Write-Step($msg) { Write-Host "> $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Write-Ok($msg) { Write-Host "$([char]0x2713) $msg" -ForegroundColor Green }
function Write-Dim($msg) { Write-Host "  $msg" -ForegroundColor DarkGray }

function Test-Command($name) {
  $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------- version ----

# Latest release tag. Needed up front by both the up-to-date check and the npm
# path, so the redirect trick (which only yields an asset URL) is not enough.
function Resolve-Version {
  if ($Version) { return $Version.TrimStart('v') }
  try {
    $release = Invoke-RestMethod -Uri $ApiUrl -Headers @{ 'User-Agent' = 'payo-installer' }
  } catch {
    throw "could not determine the latest version from $ApiUrl : $($_.Exception.Message)"
  }
  if (-not $release.tag_name) { throw "no tag_name in the response from $ApiUrl" }
  return ([string]$release.tag_name).TrimStart('v')
}

# Semver from `payo --version`, or $null if the install is broken.
function Get-InstalledVersion($path) {
  try {
    $out = & $path --version 2>$null
    if ($out -match '(\d+\.\d+\.\d+)') { return $Matches[1] }
  } catch { }
  return $null
}

function Test-NodeVersion {
  if (-not (Test-Command 'node')) { return $false }
  try { $v = (& node -v 2>$null).TrimStart('v') } catch { return $false }
  if ($v -notmatch '^(\d+)\.(\d+)') { return $false }
  $major = [int]$Matches[1]; $minor = [int]$Matches[2]
  # Matches the engines floor in package.json.
  return ($major -gt 20) -or ($major -eq 20 -and $minor -ge 12)
}

# --------------------------------------------------------------- strategy ----

# Prefer a runtime the user already has: a far smaller download, updated with a
# tool they already know.
function Select-Method {
  if ($Method -ne 'auto') { return $Method }
  if (Test-Command 'bun') { return 'bun' }
  if ((Test-Command 'npm') -and (Test-NodeVersion)) { return 'npm' }
  return 'binary'
}

# --------------------------------------------------------------- installs ----

function Install-Binary($version) {
  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($arch -ne 'AMD64') {
    throw "no prebuilt binary for $arch (Windows on ARM). Install with npm instead: npm i -g $Pkg"
  }
  $asset = 'payo-windows-x64.zip'
  $base = "$ReleaseBase/v$version"
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("payo-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null

  try {
    Write-Step "Downloading $asset (v$version)"
    $zip = Join-Path $tmp $asset
    try {
      Invoke-WebRequest -Uri "$base/$asset" -OutFile $zip -UseBasicParsing
    } catch {
      throw "download failed - is there a v$version release with a windows-x64 build?"
    }

    Confirm-Checksum -Dir $tmp -Asset $asset -Base $base

    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $exe = Join-Path $tmp 'payo.exe'
    if (-not (Test-Path $exe)) { throw "archive did not contain payo.exe" }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Move-Item -Path $exe -Destination (Join-Path $InstallDir 'payo.exe') -Force
    Write-Step "Installed to $(Join-Path $InstallDir 'payo.exe')"
  } finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
}

# Compare against the release SHA256SUMS before running anything.
function Confirm-Checksum($Dir, $Asset, $Base) {
  $sumsFile = Join-Path $Dir 'SHA256SUMS'
  try {
    Invoke-WebRequest -Uri "$Base/SHA256SUMS" -OutFile $sumsFile -UseBasicParsing
  } catch {
    Write-Warn "could not download SHA256SUMS - skipping checksum verification"
    return
  }

  $line = Get-Content $sumsFile | Where-Object { $_ -match "\s$([regex]::Escape($Asset))$" } | Select-Object -First 1
  if (-not $line) { throw "$Asset is missing from SHA256SUMS" }
  $expected = ($line -split '\s+')[0]
  $actual = (Get-FileHash -Path (Join-Path $Dir $Asset) -Algorithm SHA256).Hash.ToLower()
  if ($expected.ToLower() -ne $actual) {
    throw "checksum mismatch for $Asset`n  expected $expected`n  actual   $actual"
  }
  Write-Dim 'checksum ok'
}

# ---------------------------------------------------------------- cleanup ----

# Every place an install could live, so switching methods does not leave an
# older payo shadowing the new one earlier on PATH.
function Get-ExistingInstalls {
  $candidates = New-Object System.Collections.Generic.List[string]
  $candidates.Add((Join-Path $InstallDir 'payo.exe'))
  $candidates.Add((Join-Path $env:LOCALAPPDATA 'payo\bin\payo.exe'))
  if ($env:USERPROFILE) { $candidates.Add((Join-Path $env:USERPROFILE '.bun\bin\payo.exe')) }
  if (Test-Command 'npm') {
    try {
      $prefix = (& npm prefix -g 2>$null)
      if ($prefix) { $candidates.Add((Join-Path $prefix.Trim() 'payo.cmd')) }
    } catch { }
  }
  # Applications only — a function or alias named payo has no Source path.
  $onPath = Get-Command 'payo' -All -CommandType Application -ErrorAction SilentlyContinue
  foreach ($c in $onPath) { if ($c.Source) { $candidates.Add($c.Source) } }

  $candidates | Where-Object { $_ -and (Test-Path $_) } | Sort-Object -Unique
}

# Runs after a successful install, so a failed download never leaves the user
# with no payo at all.
function Remove-StaleInstalls($kept) {
  foreach ($p in Get-ExistingInstalls) {
    if ($p -eq $kept) { continue }
    if ($p -like "*\.bun\bin\*") {
      Write-Step 'Removing the older bun install'
      try { & bun remove -g $Pkg *> $null } catch { }
    } elseif ($p -like '*\npm\*' -or $p.EndsWith('.cmd')) {
      Write-Step 'Removing the older npm install'
      try { & npm rm -g $Pkg *> $null } catch { }
    } else {
      Write-Step "Removing the older binary at $p"
    }
    # A native command exiting nonzero does not throw, so check rather than
    # trusting the uninstall — a leftover here shadows the new install.
    if (Test-Path $p) { Remove-Item -Force $p -ErrorAction SilentlyContinue }
  }
}

# ------------------------------------------------------------------- path ----

# User PATH only — never the machine PATH, which would need admin.
function Add-ToUserPath($dir) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $entries = @()
  if ($userPath) { $entries = $userPath -split ';' | Where-Object { $_ } }
  if ($entries -contains $dir) { return $false }

  $newPath = if ($userPath) { "$userPath;$dir" } else { $dir }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  $env:Path = "$env:Path;$dir"
  return $true
}

# ------------------------------------------------------------------- main ----

function Main {
  $version = Resolve-Version
  $method = Select-Method

  # Already current? Say so and stop, unless there is more than one copy around
  # (in which case the run is worth doing just to clean up).
  $existing = @(Get-ExistingInstalls)
  if (-not $Force -and $existing.Count -eq 1) {
    $have = Get-InstalledVersion $existing[0]
    if ($have -eq $version) {
      Write-Ok "payo $version is already installed at $($existing[0])"
      Write-Dim 'Re-run with $env:PAYO_FORCE=1 to reinstall.'
      return
    }
    if ($have) { Write-Step "Upgrading payo $have -> $version" }
  }

  if ($method -eq 'bun') {
    Write-Step "Installing $Pkg@$version with bun"
    try { & bun add -g "$Pkg@$version"; if ($LASTEXITCODE -ne 0) { throw 'bun exited nonzero' } }
    catch {
      Write-Warn 'bun install failed - falling back to the standalone binary'
      $method = 'binary'
    }
  } elseif ($method -eq 'npm') {
    Write-Step "Installing $Pkg@$version with npm"
    try { & npm install -g "$Pkg@$version"; if ($LASTEXITCODE -ne 0) { throw 'npm exited nonzero' } }
    catch {
      Write-Warn 'npm install failed (a permissions error is the usual cause) - falling back to the standalone binary'
      $method = 'binary'
    }
  }
  if ($method -eq 'binary') { Install-Binary $version }

  $installedPath = switch ($method) {
    'bun' { Join-Path $env:USERPROFILE '.bun\bin\payo.exe' }
    'npm' { Join-Path (& npm prefix -g).Trim() 'payo.cmd' }
    default { Join-Path $InstallDir 'payo.exe' }
  }

  Remove-StaleInstalls $installedPath

  $binDir = Split-Path -Parent $installedPath
  if (Add-ToUserPath $binDir) {
    Write-Warn "$binDir was added to your PATH - open a new terminal before running payo."
  }

  Write-Host ''
  $got = if (Test-Path $installedPath) { Get-InstalledVersion $installedPath } else { $version }
  Write-Ok "payo $got installed via $method"
  Write-Dim 'Run it in any project: payo'
  switch ($method) {
    'bun' { Write-Dim "Remove with: bun remove -g $Pkg" }
    'npm' { Write-Dim "Remove with: npm rm -g $Pkg" }
    default { Write-Dim "Remove with: Remove-Item $installedPath" }
  }
}

Main
