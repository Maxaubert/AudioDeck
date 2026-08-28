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
# The project/files/ page serves a mirror-selection page rather than the file,
# and any single mirror (master.dl included) sometimes serves that page too.
# Tried in order; the MZ and checksum gates below decide what counts as a
# successful download, so a bad mirror just falls through to the next.
$AssetUrls = @(
    ("https://master.dl.sourceforge.net/project/equalizerapo/$Version/$FileName" + "?viasf=1"),
    "https://downloads.sourceforge.net/project/equalizerapo/$Version/$FileName"
)
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
$Fetched = $false
foreach ($AssetUrl in $AssetUrls) {
    try {
        Invoke-WebRequest -Uri $AssetUrl -OutFile $Download -UseBasicParsing -MaximumRedirection 10
    } catch {
        Write-Host "  mirror failed ($($_.Exception.Message)), trying the next one..."
        if (Test-Path $Download) { Remove-Item -Force $Download }
        continue
    }
    # SourceForge serves an HTML interstitial when a mirror is unavailable,
    # which would otherwise be saved as a perfectly valid-looking .exe.
    $Head = [IO.File]::ReadAllBytes($Download)[0..1]
    if ($Head[0] -ne 0x4D -or $Head[1] -ne 0x5A) {
        Write-Host "  mirror returned a web page instead of the file, trying the next one..."
        Remove-Item -Force $Download
        continue
    }
    $Fetched = $true
    break
}
# When every plain mirror serves the interstitial (SourceForge does this in
# waves), the interstitial itself carries a tokened downloads.sourceforge.net
# URL that does serve the bytes. curl.exe rather than Invoke-WebRequest: it
# ships with Windows, and the tokened redirect chain 403s PowerShell's client.
if (-not $Fetched) {
    Write-Host "  every mirror served a web page; extracting the tokened link from the download page..."
    $PageFile = "$Download.page"
    curl.exe -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -o $PageFile `
        "https://sourceforge.net/projects/equalizerapo/files/$Version/$FileName/download"
    if (Test-Path $PageFile) {
        $Page = [IO.File]::ReadAllText($PageFile)
        Remove-Item -Force $PageFile
        $Match = [regex]::Match($Page, 'https://downloads\.sourceforge\.net/project/equalizerapo/[^"'']+')
        if ($Match.Success) {
            $TokenUrl = $Match.Value -replace '&amp;', '&'
            curl.exe -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -o $Download $TokenUrl
            if (Test-Path $Download) {
                $Head = [IO.File]::ReadAllBytes($Download)[0..1]
                if ($Head[0] -eq 0x4D -and $Head[1] -eq 0x5A) { $Fetched = $true }
                else { Remove-Item -Force $Download }
            }
        }
    }
}
if (-not $Fetched) {
    throw ("Failed to download Equalizer APO v$Version from every mirror. " +
        "The Studio tab cannot be packaged without it. Check your network connection, or " +
        "download $FileName manually from " +
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
