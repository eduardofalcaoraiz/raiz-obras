$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$ensureOutput = @(& (Join-Path $PSScriptRoot 'ensure_supabase_cli.ps1'))
$exePath = [string]$ensureOutput[-1]

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  $tokenCandidates = @(
    (Join-Path $root '.supabase_token'),
    (Join-Path $root '..\.supabase_token'),
    (Join-Path $root '..\..\.supabase_token'),
    'C:\Users\eduardo.falcao\claude\raiz_obras\.supabase_token'
  )
  foreach ($tokenPath in $tokenCandidates) {
    if (Test-Path -LiteralPath $tokenPath) {
      $env:SUPABASE_ACCESS_TOKEN = (Get-Content -Raw -LiteralPath $tokenPath).Trim()
      break
    }
  }
}

& $exePath @args
exit $LASTEXITCODE
