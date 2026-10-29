<#
  flyer.html -> out/ : the PNG, the guides proof, the print PDF (with bleed)
  and its CMYK copy.

  The Windows counterpart of render.sh, for machines without firefox or
  python: headless Chrome/Edge over the DevTools Protocol takes the
  screenshots, and the PDF is written the same way png2pdf.py does it (one
  300 dpi RGB image, TrimBox inset by the bleed). The CMYK copy needs
  Ghostscript for Windows (gswin64c, from ghostscript.com); without it that
  step is skipped with a warning.

  Usage:
    .\render.ps1
#>
param(
  [string] $Out   = (Join-Path $PSScriptRoot 'out'),
  [double] $Bleed = 0.125
)

$ErrorActionPreference = 'Stop'

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { throw "Could not find Chrome or Edge." }

# the installer doesn't put Ghostscript on PATH, so also look where it lands
$gs = Get-Command gswin64c -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
if (-not $gs) {
  $gs = Get-ChildItem "$env:ProgramFiles\gs\*\bin\gswin64c.exe" -ErrorAction SilentlyContinue |
        Sort-Object { [version]($_.Directory.Parent.Name -replace '^gs', '') } -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

$page = Join-Path $PSScriptRoot 'flyer.html'
$pageUrl = 'file:///' + (($page -replace '\\', '/') -replace ' ', '%20')
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# --- the same minimal DevTools client as ../render.ps1 -----------------------

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

# Sends any DevTools command and returns its result. Events arrive on the same
# socket, so keep reading until the reply carrying our id shows up.
$script:cdpId = 0
function Invoke-Cdp($ws, [string] $method, $params = @{}) {
  $script:cdpId++
  $mine = $script:cdpId
  Send-Cdp $ws (@{ id = $mine; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress)
  while ($true) {
    $reply = ConvertFrom-Json (Receive-Cdp $ws)
    if ($reply.id -eq $mine) {
      if ($reply.error) { throw "DevTools error: $($reply.error.message)" }
      return $reply.result
    }
  }
}

function Invoke-Js($ws, [string] $expression) {
  $r = Invoke-Cdp $ws 'Runtime.evaluate' @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
  if ($r.exceptionDetails) { throw "Page error: $($r.exceptionDetails.exception.description)" }
  return $r.result.value
}

# --- PNG -> PDF, as png2pdf.py ---------------------------------------------

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Globalization;
using System.Text;

public static class FlyerPdf {
  const double DPI = 300;

  // zlib = 2-byte header + raw deflate + big-endian adler32, which is what
  // a PDF FlateDecode stream wants
  static byte[] Zlib(byte[] data) {
    var ms = new MemoryStream();
    ms.WriteByte(0x78); ms.WriteByte(0xDA);
    using (var d = new DeflateStream(ms, CompressionLevel.Optimal, true)) d.Write(data, 0, data.Length);
    uint a = 1, b = 0;
    foreach (byte x in data) { a = (a + x) % 65521; b = (b + a) % 65521; }
    uint adler = (b << 16) | a;
    ms.WriteByte((byte)(adler >> 24)); ms.WriteByte((byte)(adler >> 16));
    ms.WriteByte((byte)(adler >> 8));  ms.WriteByte((byte)adler);
    return ms.ToArray();
  }

  public static string Write(string png, string pdfPath, double bleedIn) {
    int w, h; byte[] rgb;
    using (var bmp = new Bitmap(png)) {
      w = bmp.Width; h = bmp.Height;
      var bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
      var row = new byte[bd.Stride];
      rgb = new byte[w * h * 3];
      for (int y = 0; y < h; y++) {
        System.Runtime.InteropServices.Marshal.Copy(bd.Scan0 + y * bd.Stride, row, 0, bd.Stride);
        for (int x = 0; x < w; x++) {  // GDI+ rows are BGR
          int o = (y * w + x) * 3;
          rgb[o] = row[x * 3 + 2]; rgb[o + 1] = row[x * 3 + 1]; rgb[o + 2] = row[x * 3];
        }
      }
      bmp.UnlockBits(bd);
    }

    var ci = CultureInfo.InvariantCulture;
    double pw = w * 72 / DPI, ph = h * 72 / DPI, bl = bleedIn * 72;
    byte[] img = Zlib(rgb);
    string content = string.Format(ci, "q {0:0.000} 0 0 {1:0.000} 0 0 cm /Im0 Do Q", pw, ph);
    var objs = new byte[][] {
      Encoding.ASCII.GetBytes("<< /Type /Catalog /Pages 2 0 R >>"),
      Encoding.ASCII.GetBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
      Encoding.ASCII.GetBytes(string.Format(ci,
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {0:0.000} {1:0.000}] " +
        "/BleedBox [0 0 {0:0.000} {1:0.000}] " +
        "/TrimBox [{2:0.000} {2:0.000} {3:0.000} {4:0.000}] " +
        "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>", pw, ph, bl, pw - bl, ph - bl)),
      Concat(Encoding.ASCII.GetBytes(string.Format(
        "<< /Type /XObject /Subtype /Image /Width {0} /Height {1} /ColorSpace /DeviceRGB " +
        "/BitsPerComponent 8 /Filter /FlateDecode /Length {2} >>\nstream\n", w, h, img.Length)),
        img, Encoding.ASCII.GetBytes("\nendstream")),
      Encoding.ASCII.GetBytes("<< /Length " + content.Length + " >>\nstream\n" + content + "\nendstream"),
    };

    var pdf = new MemoryStream();
    Put(pdf, new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A });  // %PDF-1.4 + binary marker
    var offsets = new long[objs.Length];
    for (int i = 0; i < objs.Length; i++) {
      offsets[i] = pdf.Length;
      Put(pdf, Encoding.ASCII.GetBytes((i + 1) + " 0 obj\n")); Put(pdf, objs[i]); Put(pdf, Encoding.ASCII.GetBytes("\nendobj\n"));
    }
    long xref = pdf.Length;
    var sb = new StringBuilder("xref\n0 " + (objs.Length + 1) + "\n0000000000 65535 f \n");
    foreach (long o in offsets) sb.Append(o.ToString("D10") + " 00000 n \n");
    sb.Append("trailer\n<< /Size " + (objs.Length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    Put(pdf, Encoding.ASCII.GetBytes(sb.ToString()));
    File.WriteAllBytes(pdfPath, pdf.ToArray());
    return string.Format(ci, "{0}: {1}x{2}px, {3}x{4}in, bleed {5}in", Path.GetFileName(pdfPath), w, h, w / DPI, h / DPI, bleedIn);
  }

  static byte[] Concat(params byte[][] parts) {
    var ms = new MemoryStream();
    foreach (var p in parts) ms.Write(p, 0, p.Length);
    return ms.ToArray();
  }
  static void Put(MemoryStream s, byte[] b) { s.Write(b, 0, b.Length); }
}
'@

# --- render ------------------------------------------------------------------

$port       = Get-Random -Minimum 9500 -Maximum 9899
$profileDir = Join-Path ([IO.Path]::GetTempPath()) ("flyer-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$chromeArgs = @(
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
  "--remote-debugging-port=$port", "--user-data-dir=$profileDir", 'about:blank'
)
# PS 5.1's Start-Process joins arguments with spaces without quoting them
$chromeArgs = $chromeArgs | ForEach-Object { if ($_ -match ' ') { '"' + $_ + '"' } else { $_ } }
$proc = Start-Process -FilePath $chrome -ArgumentList $chromeArgs -PassThru -WindowStyle Hidden

$shots = @(
  @{ query = '';          file = 'samhall-flyer-5x7.png' }
  @{ query = '?guides=1'; file = 'samhall-flyer-5x7-proof-guides.png' }
)
try {
  $wsUrl = $null
  for ($i = 0; $i -lt 60 -and -not $wsUrl; $i++) {
    Start-Sleep -Milliseconds 400
    try {
      # assign first: PS 5.1 pipes a JSON array as one object, not its items
      $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list" -TimeoutSec 5
      $t = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
      if ($t) { $wsUrl = $t.webSocketDebuggerUrl }
    } catch { }
  }
  if (-not $wsUrl) { throw "Chrome never exposed a page to drive." }

  $ws = Connect-Cdp $wsUrl
  try {
    # the canvas is 5.25 x 7.25 in at 300 dpi
    Invoke-Cdp $ws 'Emulation.setDeviceMetricsOverride' @{ width = 1575; height = 2175; deviceScaleFactor = 1; mobile = $false } | Out-Null
    foreach ($s in $shots) {
      Invoke-Cdp $ws 'Page.navigate' @{ url = $pageUrl + $s.query } | Out-Null
      $ready = $false
      for ($i = 0; $i -lt 100 -and -not $ready; $i++) {
        Start-Sleep -Milliseconds 300
        $ready = [bool](Invoke-Js $ws @"
document.readyState === 'complete' && location.search === '$($s.query)' &&
document.querySelector('#qr path') !== null &&
[].every.call(document.images, function (i) { return i.complete && i.naturalWidth > 0; }) &&
document.fonts.check('24px "Press Start 2P"') && document.fonts.check('24px DotGothic16')
"@)
      }
      if (-not $ready) { throw "The flyer never finished loading its art and fonts." }
      Invoke-Js $ws 'document.fonts.ready.then(function () { return 1; })' | Out-Null

      $shot = Invoke-Cdp $ws 'Page.captureScreenshot' @{ format = 'png'; clip = @{ x = 0; y = 0; width = 1575; height = 2175; scale = 1 } }
      $file = Join-Path $Out $s.file
      [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($shot.data))
      Write-Host "  $($s.file)"
    }
  } finally { try { $ws.Dispose() } catch { } }
} finally {
  try { if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force } } catch { }
  Start-Sleep -Milliseconds 400
  try { Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue } catch { }
}

$pdf = Join-Path $Out 'samhall-flyer-5x7.pdf'
Write-Host "  $([FlyerPdf]::Write((Join-Path $Out 'samhall-flyer-5x7.png'), $pdf, $Bleed))"

# CMYK copy, for printers that want CMYK files (colors shift slightly);
# same settings as render.sh
if ($gs) {
  $cmyk = Join-Path $Out 'samhall-flyer-5x7-cmyk.pdf'
  & $gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -sColorConversionStrategy=CMYK `
     -dProcessColorModel=/DeviceCMYK -dAutoFilterColorImages=false -dColorImageFilter=/FlateEncode `
     -dDownsampleColorImages=false -dUseTrimBox=false `
     "-sOutputFile=$cmyk" $pdf
  if ($LASTEXITCODE -ne 0) { throw "Ghostscript failed making the CMYK PDF." }
  Write-Host "  $(Split-Path $cmyk -Leaf)"
  Write-Host ""
  Write-Host "Done." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Warning "Ghostscript (gswin64c) not found, so the CMYK PDF was not remade. Install it from ghostscript.com and run this again."
}
