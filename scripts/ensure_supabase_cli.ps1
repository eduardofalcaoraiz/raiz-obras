$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'

$version = if ($env:SUPABASE_CLI_VERSION) { $env:SUPABASE_CLI_VERSION.TrimStart('v') } else { '2.109.1' }
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$toolsDir = Join-Path $root 'tools\supabase'
$exePath = Join-Path $toolsDir 'supabase.exe'

if (Test-Path -LiteralPath $exePath) {
  $installedVersion = ((& $exePath --version) | Select-Object -Last 1).Trim().TrimStart('v')
  if ($installedVersion -eq $version) {
    Write-Output $exePath
    exit 0
  }
}

$tmpDir = Join-Path $root 'tmp\supabase-cli-download'
$extractDir = Join-Path $tmpDir 'extract'
$zipPath = Join-Path $tmpDir "supabase_$version`_windows_amd64.zip"
$url = "https://github.com/supabase/cli/releases/download/v$version/supabase_$version`_windows_amd64.zip"

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

Invoke-WebRequest -Uri $url -OutFile $zipPath -Headers @{ 'User-Agent' = 'RaizObraViva-Codex' } -TimeoutSec 180
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

$downloadedExe = Get-ChildItem -Path $extractDir -Recurse -Filter 'supabase.exe' | Select-Object -First 1
if (-not $downloadedExe) {
  throw "supabase.exe nao encontrado no pacote $url"
}

Copy-Item -LiteralPath $downloadedExe.FullName -Destination $exePath -Force
Write-Output $exePath
