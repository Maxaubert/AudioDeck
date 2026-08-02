# Walk the built installer and photograph each screen.
#
# The probe harness proves the kit renders; this proves the real setup does,
# with electron-builder's own script around it. Coordinates are the design's
# pixels scaled by the window DPI and offset by the frame, so the same numbers
# work whatever the display scale.
#
# -Steps controls how far it goes. Two is safe and reaches the effects page;
# three enters the progress page, which really does start installing, so the
# caller has to be willing to clean up after it.

param(
  [string]$Exe = "C:\Users\Admin\Documents\Claude\Github\AudioDeck\dist\AudioDeck-Setup-0.1.0.exe",
  [string]$OutDir = "C:\Users\Admin\Documents\Claude\Github\AudioDeck\design\shots",
  [int]$Steps = 2,
  # Which step lands on the progress page, which advances itself.
  [int]$InstallStep = 99,
  # How long to let the install run. 365 MB takes well over a minute here once
  # a virus scanner is looking at every file.
  [int]$InstallWaitSeconds = 180
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static readonly IntPtr TOPMOST = new IntPtr(-1);
}
'@
try { [W]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null } catch { }
Add-Type -AssemblyName System.Drawing

$proc = Start-Process $Exe -PassThru
try {
  $h = [IntPtr]::Zero
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 200
    $proc.Refresh()
    if ($proc.MainWindowHandle -ne [IntPtr]::Zero) { $h = $proc.MainWindowHandle; break }
  }
  if ($h -eq [IntPtr]::Zero) { throw "setup never showed a window" }
  Start-Sleep -Milliseconds 1500   # let the first page size and paint

  $dpi = [W]::GetDpiForWindow($h)
  # Client origin inside the window, so design coordinates land where intended.
  $wr = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$wr) | Out-Null
  $cr = New-Object W+RECT; [W]::GetClientRect($h, [ref]$cr) | Out-Null
  $frameX = [int](($wr.Right - $wr.Left - $cr.Right) / 2)
  $frameY = ($wr.Bottom - $wr.Top - $cr.Bottom) - $frameX
  "dpi $dpi, client $($cr.Right)x$($cr.Bottom), frame offset $frameX,$frameY"

  function Shoot($name) {
    $r = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$r) | Out-Null
    $bmp = New-Object System.Drawing.Bitmap ($r.Right - $r.Left), ($r.Bottom - $r.Top)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    [W]::PrintWindow($h, $hdc, 2) | Out-Null
    $g.ReleaseHdc($hdc)
    $bmp.Save("$OutDir\setup-$name.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    "  shot setup-$name.png"
  }

  # Advance the page.
  #
  # A synthetic mouse click needs the window genuinely foreground, and anything
  # that steals focus mid-walk sends it somewhere else silently, which is what
  # produced three identical screenshots the first time. Posting the command the
  # drawn button posts is deterministic, and the mouse path itself is already
  # proven by design/probe/p1-buttons.nsi.
  function Advance {
    [W]::SendMessage($h, 0x0111, [IntPtr]1, [IntPtr]::Zero) | Out-Null   # WM_COMMAND, id 1
    Start-Sleep -Milliseconds 1500
  }

  # Numbered rather than named: the effects page skips itself when Equalizer APO
  # is already present, so which screen is third depends on the machine.
  $names = @("1", "2", "3", "4", "5")
  for ($s = 0; $s -le $Steps; $s++) {
    Shoot $names[$s]
    if ($s -lt $Steps) {
      # The progress page advances itself when the section finishes, so once it
      # is on screen the walk waits rather than pressing anything.
      if ($s -eq $InstallStep) { Start-Sleep -Seconds $InstallWaitSeconds } else { Advance }
    }
  }
}
finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  "setup closed, nothing installed"
}
