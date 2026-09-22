<#
  Concatenates src/ into ad.html.

  ad.html is one self-contained file on purpose — it has to run from file://
  with no server and no network beyond Google Fonts — but a 74KB single file
  is miserable to edit. So the real source lives in src/ and this glues it
  back together. Edit src/, run this, then render.ps1.

  Order matters: part0 opens the page and the <script>, art.js defines the
  base64 sprites, the engines run top to bottom, part6 closes it.
#>
param(
  [string] $Out = (Join-Path $PSScriptRoot 'ad.html')
)

$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'src'

$parts = @(
  'part0.html',   # <head>, the previewer UI, opening <script>
  'art.js',       # ART: every sprite as a base64 data URI
  'engine1.js',   # palette, FORMATS, isWide, text fitting helpers
  'engine2.js',   # the console shell + drawFrame
  'engine3.js',   # sprite scaling, squeeze, scenes 1-2 (hook, pick)
  'engine4.js',   # scenes 3-5 (learn, sam, offer) + SCENE_FN
  'engine5.js',   # loading, playback, scrubbing, WebM/MP4 export, wiring
  'part6.html'    # </script></body></html>
)

$missing = $parts | Where-Object { -not (Test-Path (Join-Path $src $_)) }
if ($missing) { throw "Missing from src/: $($missing -join ', ')" }

$sb = New-Object Text.StringBuilder
foreach ($p in $parts) {
  [void]$sb.Append([IO.File]::ReadAllText((Join-Path $src $p)))
}
[IO.File]::WriteAllText($Out, $sb.ToString(), (New-Object Text.UTF8Encoding $false))

"Built {0} ({1:N0} bytes) from {2} parts." -f (Split-Path $Out -Leaf), (Get-Item $Out).Length, $parts.Count
