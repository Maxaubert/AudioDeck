# Fetches the pinned HeadsetControl release binary into vendor/.
# HeadsetControl (github.com/Sapd/HeadsetControl, GPL-3) is invoked by AudioDeck
# as a separate process; it is not linked into the app. The version is pinned so
# builds are reproducible and match the JSON schema the daemon parses.

[CmdletBinding()]
param(
    # Re-download even if vendor/headsetcontrol.exe already exists.
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$Version = "4.0.0"
$AssetUrl = "https://github.com/Sapd/HeadsetControl/releases/download/$Version/headsetcontrol-windows-x86_64.exe"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VendorDir = Join-Path $RepoRoot "vendor"
$Target = Join-Path $VendorDir "headsetcontrol.exe"

if ((Test-Path $Target) -and -not $Force) {
    Write-Host "vendor/headsetcontrol.exe already present, nothing to do (use -Force to re-download)."
    exit 0
}

New-Item -ItemType Directory -Force $VendorDir | Out-Null
$Download = "$Target.download"

Write-Host "Downloading HeadsetControl v$Version..."
try {
    Invoke-WebRequest -Uri $AssetUrl -OutFile $Download -UseBasicParsing
} catch {
    if (Test-Path $Download) { Remove-Item -Force $Download }
    throw ("Failed to download HeadsetControl v$Version from $AssetUrl. " +
        "AudioDeck cannot be packaged without it. Check your network connection, or download " +
        "headsetcontrol-windows-x86_64.exe manually from " +
        "https://github.com/Sapd/HeadsetControl/releases/tag/$Version and save it as " +
        "vendor\headsetcontrol.exe. Underlying error: $($_.Exception.Message)")
}

Move-Item -Force $Download $Target

# Sanity check: the binary must run and report the pinned version.
$Reported = (& $Target --version 2>&1) -join " "
if ($LASTEXITCODE -ne 0 -or $Reported -notmatch [regex]::Escape($Version)) {
    throw ("vendor/headsetcontrol.exe downloaded but failed verification " +
        "(exit $LASTEXITCODE, output '$Reported', expected version $Version). " +
        "Delete vendor\headsetcontrol.exe and re-run this script.")
}

Write-Host "OK: vendor/headsetcontrol.exe is HeadsetControl v$Version."
