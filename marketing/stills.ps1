<#
  Renders still images from marketing/ad.html for static image ads.

  Same approach as render.ps1: headless Chrome over the DevTools Protocol,
  render(t) on the page, then canvas.toDataURL. One PNG per still per aspect,
  written to out/stills/samhall-still-<name>-<aspect>.png.

  The stills are listed in $Stills below as name / cut / time. Each time is
  picked so the frame stands on its own: nothing mid-animation, and no typing
  cursor showing.

  Usage:
    .\stills.ps1                        # every still, 4x5 + 1x1 + 9x16
    .\stills.ps1 -Formats 4x5
    .\stills.ps1 -Only offer,flash
#>
param(
  [ValidateSet('9x16', '4x5', '1x1', '16x9')]
  [string[]] $Formats = @('4x5', '1x1', '9x16'),
  [string[]] $Only    = @(),
  [string]   $Out     = (Join-Path $PSScriptRoot 'out\stills')
)

$ErrorActionPreference = 'Stop'

$Stills = @(
  @{ name = 'offer'; cut = 'full';       t = 13.3 }   # 1 FREE TRIAL / $40 / BOOK NOW / samhall.music
  @{ name = 'flash'; cut = 'offerfirst'; t = 1.2  }   # FREE TRIAL + MUSIC & MEDIA LESSONS / PORTLAND
  @{ name = 'title'; cut = 'full';       t = 2.2  }   # MUSIC & DIGITAL MEDIA LESSONS / PORTLAND / ALL AGES
  @{ name = 'sam';   cut = 'full';       t = 9.8  }   # HI, I'M SAM / 10+ years
)
if ($Only.Count) { $Stills = $Stills | Where-Object { $Only -contains $_.name } }

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { throw "Could not find Chrome or Edge." }

$page = Join-Path $PSScriptRoot 'ad.html'
$pageUrl = 'file:///' + (($page -replace '\\', '/') -replace ' ', '%20')
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# --- the same minimal DevTools client as render.ps1 --------------------------

function Connect-Cdp([string] $url) {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
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

# --- render: one browser per cut x aspect, every still for it from that ------

$made = @()
foreach ($cut in ($Stills | ForEach-Object { $_.cut } | Select-Object -Unique)) {
foreach ($fmt in $Formats) {
  $port    = Get-Random -Minimum 9500 -Maximum 9899
  $profileDir = Join-Path ([IO.Path]::GetTempPath()) ("adstill-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  $chromeArgs = @(
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
    "--remote-debugging-port=$port", "--user-data-dir=$profileDir",
    ($pageUrl + "?bare=1&cut=$cut&fmt=$fmt&t=0")
  )
  # PS 5.1's Start-Process joins arguments with spaces without quoting them, and
  # both the profile dir and the page live under "C:\Users\Sam Hall\".
  $chromeArgs = $chromeArgs | ForEach-Object { if ($_ -match ' ') { '"' + $_ + '"' } else { $_ } }
  $proc = Start-Process -FilePath $chrome -ArgumentList $chromeArgs -PassThru -WindowStyle Hidden
  try {
    $wsUrl = $null
    for ($i = 0; $i -lt 60 -and -not $wsUrl; $i++) {
      Start-Sleep -Milliseconds 400
      try {
        # assign first: PS 5.1 pipes a JSON array as one object, not its items
        $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list" -TimeoutSec 5
        $t = $targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'file:*' } | Select-Object -First 1
        if ($t) { $wsUrl = $t.webSocketDebuggerUrl }
      } catch { }
    }
    if (-not $wsUrl) { throw "Chrome never exposed a page to drive." }

    $ws = Connect-Cdp $wsUrl
    try {
      $ready = $false
      for ($i = 0; $i -lt 100 -and -not $ready; $i++) {
        Start-Sleep -Milliseconds 300
        $ready = [bool](Invoke-Js $ws "document.body && document.body.dataset.ready === '1'")
      }
      if (-not $ready) { throw "The page never finished loading its art and fonts." }

      foreach ($s in ($Stills | Where-Object { $_.cut -eq $cut })) {
        $b64 = Invoke-Js $ws "(function(){render($($s.t));return document.getElementById('stage').toDataURL('image/png').slice(22)})()"
        $file = Join-Path $Out "samhall-still-$($s.name)-$fmt.png"
        [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($b64))
        $made += $file
        Write-Host "  $(Split-Path $file -Leaf)"
      }
    } finally { try { $ws.Dispose() } catch { } }
  } finally {
    try { if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force } } catch { }
    Start-Sleep -Milliseconds 400
    try { Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  }
}
}

Write-Host ""
Write-Host "Done: $($made.Count) stills in $Out" -ForegroundColor Green


