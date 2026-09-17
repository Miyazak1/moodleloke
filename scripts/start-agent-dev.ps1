$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
& npm.cmd run local:start
exit $LASTEXITCODE
