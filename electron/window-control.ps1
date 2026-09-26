param(
  [ValidateSet('list', 'left', 'right', 'minimize', 'restore')][string]$Action = 'list',
  [long]$Handle = 0,
  [int]$OwnerProcess = 0,
  [int]$ExcludeProcess = 0
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class PetWindows {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr param);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint process);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hwnd, int command);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
}
'@
if ($Action -eq 'list') {
  $items = [System.Collections.Generic.List[object]]::new()
  $callback = [PetWindows+EnumProc] {
    param($hwnd, $unused)
    if (-not [PetWindows]::IsWindowVisible($hwnd)) { return $true }
    if ([PetWindows]::GetWindow($hwnd, 4) -ne [IntPtr]::Zero) { return $true }
    [uint32]$windowProcess = 0
    [void][PetWindows]::GetWindowThreadProcessId($hwnd, [ref]$windowProcess)
    if ($windowProcess -eq $ExcludeProcess) { return $true }
    $title = [System.Text.StringBuilder]::new(512)
    [void][PetWindows]::GetWindowText($hwnd, $title, $title.Capacity)
    if ($title.Length -eq 0 -or $title.ToString() -eq 'Program Manager') { return $true }
    $items.Add(@{ handle = $hwnd.ToInt64().ToString(); process = $windowProcess; title = $title.ToString() })
    return $true
  }
  [void][PetWindows]::EnumWindows($callback, [IntPtr]::Zero)
  ConvertTo-Json -InputObject @($items.ToArray()) -Compress
  exit
}
$target = [IntPtr]::new($Handle)
[uint32]$actualProcess = 0
[void][PetWindows]::GetWindowThreadProcessId($target, [ref]$actualProcess)
if (-not [PetWindows]::IsWindow($target) -or $OwnerProcess -le 0 -or $actualProcess -ne $OwnerProcess -or $actualProcess -eq $ExcludeProcess) {
  throw 'Window is no longer available.'
}
if ($Action -eq 'minimize') {
  [void][PetWindows]::ShowWindowAsync($target, 6)
} elseif ($Action -eq 'restore') {
  [void][PetWindows]::ShowWindowAsync($target, 9)
} else {
  $area = [System.Windows.Forms.Screen]::FromHandle($target).WorkingArea
  [void][PetWindows]::ShowWindowAsync($target, 9)
  Start-Sleep -Milliseconds 150
  $half = [int][Math]::Floor($area.Width / 2)
  $windowX = $area.X
  $windowWidth = $half
  if ($Action -eq 'right') { $windowX += $half; $windowWidth = $area.Width - $half }
  if (-not [PetWindows]::SetWindowPos($target, [IntPtr]::Zero, $windowX, $area.Y, $windowWidth, $area.Height, 0x0014)) {
    throw 'Could not move window.'
  }
}
Start-Sleep -Milliseconds 150
if ($Action -eq 'minimize' -and -not [PetWindows]::IsIconic($target)) { throw 'Could not minimize window.' }
if ($Action -eq 'restore' -and [PetWindows]::IsIconic($target)) { throw 'Could not restore window.' }
'{"ok":true}'
