# Capture (and optionally click inside) a running installer window.
#
# The NSIS probes cannot be judged from a compile log, and screenshotting the
# whole desktop both leaks whatever else is on screen and makes small
# differences hard to see. This grabs the installer window alone, by handle.
#
#   -Exe    the installer to run
#   -Out    png path; a click adds -after.png next to it
#   -ClickX/-ClickY  window-relative pixel to click before the second capture

param(
  [Parameter(Mandatory = $true)][string]$Exe,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$ClickX = -1,
  [int]$ClickY = -1
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  public static readonly IntPtr TOPMOST = new IntPtr(-1);
  public static readonly IntPtr NOTOPMOST = new IntPtr(-2);
  public const uint NOMOVE_NOSIZE = 0x0002 | 0x0001;
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public const uint LEFTDOWN = 0x0002, LEFTUP = 0x0004;
}
'@
Add-Type -AssemblyName System.Drawing

# Measure in real pixels. Without this the capture process is itself scaled, so
# GetWindowRect hands back virtualised numbers and a DPI-unaware installer and
# a DPI-aware one report the same size, which is exactly the comparison the DPI
# probe needs to make. -4 is PER_MONITOR_AWARE_V2.
try { [Win]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null } catch { }

function Grab($handle, $path) {
  $r = New-Object Win+RECT
  [Win]::GetWindowRect($handle, [ref]$r) | Out-Null
  $w = $r.Right - $r.Left
  $h = $r.Bottom - $r.Top
  if ($w -le 0 -or $h -le 0) { throw "window has no size" }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  # PrintWindow asks the window to paint itself, so an occluded or unfocused
  # installer still captures correctly and we never have to steal focus from
  # whatever the user is doing. CopyFromScreen would photograph whatever
  # happens to be in front.
  $hdc = $g.GetHdc()
  $ok = [Win]::PrintWindow($handle, $hdc, 2)   # PW_RENDERFULLCONTENT
  $g.ReleaseHdc($hdc)
  if (-not $ok) {
    $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  $dpi = [Win]::GetDpiForWindow($handle)
  return "$w x $h physical at $($r.Left),$($r.Top), window dpi $dpi$(if (-not $ok) { ' (PrintWindow refused, fell back to screen)' })"
}

$proc = Start-Process $Exe -PassThru
try {
  # The window is not there the instant the process is.
  $handle = [IntPtr]::Zero
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 150
    $proc.Refresh()
    if ($proc.MainWindowHandle -ne [IntPtr]::Zero) { $handle = $proc.MainWindowHandle; break }
  }
  if ($handle -eq [IntPtr]::Zero) { throw "no window appeared" }

  [Win]::SetForegroundWindow($handle) | Out-Null
  Start-Sleep -Milliseconds 600
  "captured $(Grab $handle $Out)"

  if ($ClickX -ge 0 -and $ClickY -ge 0) {
    # A synthetic click goes to whatever window is physically on top, so the
    # installer has to be there. SetForegroundWindow alone is refused when the
    # caller is not already foreground; lifting it topmost is not.
    [Win]::SetWindowPos($handle, [Win]::TOPMOST, 0, 0, 0, 0, [Win]::NOMOVE_NOSIZE) | Out-Null
    [Win]::SetForegroundWindow($handle) | Out-Null
    Start-Sleep -Milliseconds 400

    $r = New-Object Win+RECT
    [Win]::GetWindowRect($handle, [ref]$r) | Out-Null
    [Win]::SetCursorPos($r.Left + $ClickX, $r.Top + $ClickY) | Out-Null
    Start-Sleep -Milliseconds 150

    # Report what is actually under the cursor. A DPI-unaware installer on a
    # scaled display makes it very easy to click a spot that only looks right,
    # and a silent miss is indistinguishable from a control that did not fire.
    $p = New-Object Win+POINT
    [Win]::GetCursorPos([ref]$p) | Out-Null
    $under = [Win]::WindowFromPoint($p)
    $cls = New-Object System.Text.StringBuilder 256
    [Win]::GetClassName($under, $cls, 256) | Out-Null
    $txt = New-Object System.Text.StringBuilder 256
    [Win]::GetWindowText($under, $txt, 256) | Out-Null
    "cursor at $($p.X),$($p.Y) is over $($cls.ToString()) '$($txt.ToString())'"

    [Win]::mouse_event([Win]::LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
    [Win]::mouse_event([Win]::LEFTUP, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 700
    $after = $Out -replace '\.png$', '-after.png'
    "clicked $ClickX,$ClickY then captured $(Grab $handle $after)"
  }
}
finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
