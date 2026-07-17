param(
  [string]$Mode = "lab",
  [string]$Output = "web_demo/assets/images/screenshot-latest.png"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$htmlPath = Join-Path $repoRoot "web_demo\index.html"
$outputPath = Join-Path $repoRoot $Output
$outputDir = Split-Path -Parent $outputPath

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$edgePaths = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$browser = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browser) {
  throw "No Edge or Chrome executable was found. Install Microsoft Edge or Google Chrome, then rerun this script."
}

$fileUrl = "file:///" + ($htmlPath -replace "\\", "/")
$url = "$fileUrl`?mode=$Mode&speed=4"

& $browser `
  --headless=new `
  --disable-gpu `
  --allow-file-access-from-files `
  --window-size=1440,1000 `
  --virtual-time-budget=2500 `
  "--screenshot=$outputPath" `
  $url

Write-Host "Updated screenshot: $outputPath"
