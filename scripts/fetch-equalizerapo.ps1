# Fetches the pinned Equalizer APO installer into vendor/.
# Equalizer APO (sourceforge.net/projects/equalizerapo, GPL-3) does the audio
# processing for the Studio tab. AudioDeck writes a config file it reads; it is
# not linked into the app. The version is pinned so builds are reproducible and
# match the config syntax the renderer emits.

[CmdletBinding()]
param(
    # Re-download even if the installer is already present.
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$Version = "1.4.2"
$FileName = "EqualizerAPO-x64-$Version.exe"
# The project/files/ and downloads. hosts both serve a mirror-selection page
# rather than the file; master.dl serves the bytes.
$AssetUrl = "https://master.dl.sourceforge.net/project/equalizerapo/$Version/$FileName" + "?viasf=1"
# This installer registers a component in the system audio path, so its
# integrity is pinned rather than merely its version.
$Sha256 = "7403BE7427BBE1936A40DDED082829B6E217FC4F5990FEE5CBA501F0AE055AFA"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VendorDir = Join-Path $RepoRoot "vendor"
$Target = Join-Path $VendorDir "equalizerapo-setup.exe"

if ((Test-Path $Target) -and -not $Force) {
    Write-Host "vendor/equalizerapo-setup.exe already present, nothing to do (use -Force to re-download)."
    exit 0
}

New-Item -ItemType Directory -Force $VendorDir | Out-Null
$Download = "$Target.download"

Write-Host "Downloading Equalizer APO v$Version..."
try {
    Invoke-WebRequest -Uri $AssetUrl -OutFile $Download -UseBasicParsing -MaximumRedirection 10
} catch {
    if (Test-Path $Download) { Remove-Item -Force $Download }
    throw ("Failed to download Equalizer APO v$Version from $AssetUrl. " +
        "The Studio tab cannot be packaged without it. Check your network connection, or " +
        "download $FileName manually from " +
        "https://sourceforge.net/projects/equalizerapo/files/$Version/ and save it as " +
        "vendor\equalizerapo-setup.exe. Underlying error: $($_.Exception.Message)")
}

# SourceForge serves an HTML interstitial when a mirror is unavailable, which
# would otherwise be saved as a perfectly valid-looking .exe.
$Head = [IO.File]::ReadAllBytes($Download)[0..1]
if ($Head[0] -ne 0x4D -or $Head[1] -ne 0x5A) {
    Remove-Item -Force $Download
    throw ("Downloaded file is not a Windows executable (no MZ header). SourceForge probably " +
        "returned a mirror-selection page. Download $FileName by hand from " +
        "https://sourceforge.net/projects/equalizerapo/files/$Version/ and save it as " +
        "vendor\equalizerapo-setup.exe.")
}

$Actual = (Get-FileHash -Algorithm SHA256 $Download).Hash
if ($Actual -ne $Sha256) {
    Remove-Item -Force $Download
    throw ("Equalizer APO v$Version failed its checksum. Expected $Sha256, got $Actual. " +
        "Refusing to package an installer that does not match the pinned release.")
}

Move-Item -Force $Download $Target
$Size = [math]::Round((Get-Item $Target).Length / 1MB, 1)
Write-Host "OK: vendor/equalizerapo-setup.exe is Equalizer APO v$Version ($Size MB, checksum verified)."
