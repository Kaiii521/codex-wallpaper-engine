param(
    [switch]$InstallShortcut,
    [string]$NodePath
)

$ErrorActionPreference = 'Stop'
$project = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$cli = Join-Path $project 'src\cli.mjs'
$helper = Join-Path $HOME '.codex\heige-codex-skin-studio\scripts\windows\lib\common.ps1'
$shell = New-Object -ComObject WScript.Shell
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (!$NodePath) {
    $NodePath = (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    if (!$NodePath) {
        $NodePath = Join-Path $HOME '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
}
if (!(Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw 'Install Node.js 22.4 or newer first.' }
if (!(Test-Path -LiteralPath $helper -PathType Leaf)) { throw 'The Windows launcher requires the installed HeiGe Codex Skin Studio startup helper.' }

if ($InstallShortcut) {
    $desktop = [Environment]::GetFolderPath('DesktopDirectory')
    $path = Join-Path $desktop 'Codex Wallpaper.lnk'
    $shortcut = $shell.CreateShortcut($path)
    if ((Test-Path -LiteralPath $path) -and !$shortcut.Arguments.Contains('"' + $PSCommandPath + '"')) {
        throw 'A different shortcut named Codex Wallpaper already exists on the desktop.'
    }
    $shortcut.TargetPath = $powershell
    $shortcut.Arguments = '-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $PSCommandPath + '" -NodePath "' + $NodePath + '"'
    $shortcut.WorkingDirectory = $project
    $shortcut.WindowStyle = 7
    $shortcut.Description = 'Open Codex and restore the last Steam Workshop wallpaper'
    $shortcut.Save()
    Write-Output $path
    return
}

$lock = New-Object System.Threading.Mutex($false, 'Local\CodexWallpaperEngine-9341')
$acquired = $false
try {
    try { $acquired = $lock.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $acquired = $true }
    if (!$acquired) { return }

    . $helper
    $app = Resolve-CodexApp
    $debugReady = $false
    try {
        $targets = Invoke-RestMethod -Uri 'http://127.0.0.1:9341/json/list' -TimeoutSec 2
        $debugReady = @($targets | Where-Object { $_.type -eq 'page' -and $_.url -eq 'app://-/index.html' }).Count -gt 0
    } catch {
        # A normal Codex launch does not expose the local debugging port.
    }
    if (!$debugReady) {
        if (@(Get-RunningCodex -AppInfo $app).Count -gt 0) {
            throw 'Codex is already running. Quit it from the app menu or system tray, then open Codex Wallpaper again.'
        }
        Start-CodexWithCdp -AppInfo $app -Port 9341 -StopProvider {
            throw 'Codex opened without the wallpaper port. Quit it completely and try again.'
        }
    }
    & $NodePath $cli library --restore
    if ($LASTEXITCODE -ne 0) { throw 'The wallpaper controller exited with an error.' }
} catch {
    [void]$shell.Popup($_.Exception.Message, 0, 'Codex Wallpaper', 48)
} finally {
    if ($acquired) { $lock.ReleaseMutex() }
    $lock.Dispose()
}
