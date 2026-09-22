<#
  Renders marketing/ad.html to MP4.

  The spot is a pure function of time, so instead of screen-recording it in
  real time this drives a headless Chrome over the DevTools Protocol, asks for
  one frame at a time, and hands the PNGs to ffmpeg. Nothing can drop a frame
  or run slow, and the result is identical every time.

  There are two cuts of the spot (see CUTS in src/engine1.js) and four aspects,
  so a bare run makes eight files. The full cut keeps its original filenames;
  the offer-first cut is named samhall-ad-offerfirst-<aspect>.mp4.

  Usage:
    .\render.ps1                        # both cuts, all four aspects, 30fps
    .\render.ps1 -Formats 9x16          # just the Reels frame, both cuts
    .\render.ps1 -Cuts offerfirst       # just the new cut
    .\render.ps1 -Cuts full -Formats 9x16,16x9
    .\render.ps1 -Fps 60 -KeepFrames    # smoother, and leave the PNGs behind
#>
param(
  [ValidateSet('9x16', '4x5', '1x1', '16x9')]
  [string[]] $Formats = @('9x16', '4x5', '1x1', '16x9'),
  [ValidateSet('full', 'offerfirst')]
  [string[]] $Cuts    = @('full', 'offerfirst'),
  [int]      $Fps     = 30,
  [string]   $Out     = (Join-Path $PSScriptRoot 'out'),
  [switch]   $KeepFrames
)

$ErrorActionPreference = 'Stop'

# --- tools -------------------------------------------------------------------

function Find-Exe([string[]] $candidates, [string] $onPath) {
  $c = Get-Command $onPath -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in $candidates) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

$chrome = Find-Exe @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) 'chrome'

$ffmpegGuess = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
               Select-Object -First 1 -ExpandProperty FullName
$ffmpeg = Find-Exe @($ffmpegGuess) 'ffmpeg'

if (-not $chrome) { throw "Could not find Chrome or Edge." }
if (-not $ffmpeg) { throw "Could not find ffmpeg. Install it with: winget install Gyan.FFmpeg --scope user" }

$page = Join-Path $PSScriptRoot 'ad.html'
if (-not (Test-Path $page)) { throw "Could not find $page" }
$pageUrl = 'file:///' + ($page -replace '\\', '/')

New-Item -ItemType Directory -Force -Path $Out | Out-Null

# --- a minimal DevTools Protocol client --------------------------------------

function Connect-Cdp([string] $url) {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
  $ws.ConnectAsync([Uri]$url, [Threading.CancellationToken]::None).Wait(20000) | Out-Null
  if ($ws.State -ne 'Open') { throw "Could not open a DevTools connection." }
  return $ws
}

function Send-Cdp($ws, [string] $text) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($text)
  $seg = New-Object 'System.ArraySegment[byte]' -ArgumentList @(, $bytes)
  $ws.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true,
                [Threading.CancellationToken]::None).Wait()
}

function Receive-Cdp($ws) {
  $buf = New-Object byte[] 262144
  $seg = New-Object 'System.ArraySegment[byte]' -ArgumentList @(, $buf)
  $sb  = New-Object Text.StringBuilder
  do {
    $task = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None)
    if (-not $task.Wait(120000)) { throw "Timed out waiting for the browser." }
    [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $task.Result.Count))
  } while (-not $task.Result.EndOfMessage)
  return $sb.ToString()
}

$script:cdpId = 0

# Evaluates JS in the page and returns the value. Events arrive on the same
# socket, so keep reading until the reply carrying our id shows up.
function Invoke-Js($ws, [string] $expression) {
  $script:cdpId++
  $mine = $script:cdpId
  $msg = @{
    id     = $mine
    method = 'Runtime.evaluate'
    params = @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
  } | ConvertTo-Json -Depth 10 -Compress
  Send-Cdp $ws $msg

  while ($true) {
    $reply = ConvertFrom-Json (Receive-Cdp $ws)
    if ($reply.id -eq $mine) {
      if ($reply.error) { throw "DevTools error: $($reply.error.message)" }
      if ($reply.result.exceptionDetails) {
        throw "Page error: $($reply.result.exceptionDetails.exception.description)"
      }
      return $reply.result.result.value
    }
  }
}

# --- render ------------------------------------------------------------------

$made = @()

foreach ($cut in $Cuts) {

# The full cut keeps the plain names it has always had, so anything already
# uploaded or linked still points at the same file.
$tag = if ($cut -eq 'full') { '' } else { "-$cut" }

foreach ($fmt in $Formats) {
  Write-Host ""
  Write-Host "=== $cut / $fmt ===" -ForegroundColor Cyan

  $port    = Get-Random -Minimum 9500 -Maximum 9899
  $profile = Join-Path ([IO.Path]::GetTempPath()) ("adrender-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  $frames  = Join-Path $Out "frames$tag-$fmt"
  New-Item -ItemType Directory -Force -Path $frames | Out-Null

  # t=0 makes the page hold a single frame instead of running its own loop,
  # so the only thing moving the clock is us.
  $args = @(
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--mute-audio', '--disable-background-timer-throttling',
    "--remote-debugging-port=$port", "--user-data-dir=$profile",
    ($pageUrl + "?bare=1&cut=$cut&fmt=$fmt&t=0")
  )
  $proc = Start-Process -FilePath $chrome -ArgumentList $args -PassThru -WindowStyle Hidden

  try {
    # wait for the debugging endpoint, then find the page target
    $wsUrl = $null
    for ($i = 0; $i -lt 60 -and -not $wsUrl; $i++) {
      Start-Sleep -Milliseconds 400
      try {
        $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list" -TimeoutSec 5
        $t = $targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'file:*' } | Select-Object -First 1
        if ($t) { $wsUrl = $t.webSocketDebuggerUrl }
      } catch { }
    }
    if (-not $wsUrl) { throw "Chrome never exposed a page to drive." }

    $ws = Connect-Cdp $wsUrl
    try {
      Write-Host "  waiting for art + fonts..." -NoNewline
      $ready = $false
      for ($i = 0; $i -lt 100 -and -not $ready; $i++) {
        Start-Sleep -Milliseconds 300
        $ready = [bool](Invoke-Js $ws "document.body && document.body.dataset.ready === '1'")
      }
      if (-not $ready) { throw "The page never finished loading its art and fonts." }
      Write-Host " ok"

      $dur   = [double](Invoke-Js $ws 'DUR')
      $w     = [int](Invoke-Js $ws 'W')
      $h     = [int](Invoke-Js $ws 'H')
      $count = [int][Math]::Round($dur * $Fps)
      Write-Host "  $w x $h, $dur s, $count frames at $Fps fps"

      $sw = [Diagnostics.Stopwatch]::StartNew()
      for ($i = 0; $i -lt $count; $i++) {
        $t = [Math]::Round($i / $Fps, 6)
        # render, then hand back just the base64 payload of the canvas
        $b64 = Invoke-Js $ws "(function(){render($t);return document.getElementById('stage').toDataURL('image/png').slice(22)})()"
        $file = Join-Path $frames ("f{0:D5}.png" -f $i)
        [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($b64))

        if ($i % 30 -eq 0 -or $i -eq $count - 1) {
          $pct = [int](($i + 1) / $count * 100)
          Write-Progress -Activity "Rendering $fmt" -Status "frame $($i+1) of $count" -PercentComplete $pct
        }
      }
      Write-Progress -Activity "Rendering $fmt" -Completed
      Write-Host ("  frames in {0:N1}s" -f $sw.Elapsed.TotalSeconds)
    } finally {
      try { $ws.Dispose() } catch { }
    }
  } finally {
    try { if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force } } catch { }
    Start-Sleep -Milliseconds 400
    try { Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  }

  # --- encode ----------------------------------------------------------------
  # H.264 High + yuv420p is what Meta wants. The spot is silent, but a silent
  # AAC track keeps every uploader happy, and faststart puts the index first
  # so it can start playing before it has finished downloading.
  $mp4 = Join-Path $Out "samhall-ad$tag-$fmt.mp4"
  Write-Host "  encoding..." -NoNewline
  & $ffmpeg -y -v error `
    -framerate $Fps -i (Join-Path $frames 'f%05d.png') `
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 `
    -map 0:v -map 1:a -shortest `
    -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p `
    -r $Fps -c:a aac -b:a 128k -movflags +faststart `
    $mp4
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on $fmt." }
  Write-Host " ok"

  if (-not $KeepFrames) { Remove-Item $frames -Recurse -Force }
  $made += $mp4
}

}   # cuts

Write-Host ""
Write-Host "Done." -ForegroundColor Green
foreach ($m in $made) {
  $mb = [Math]::Round((Get-Item $m).Length / 1MB, 2)
  "{0,-46} {1,6} MB" -f (Split-Path $m -Leaf), $mb
}
