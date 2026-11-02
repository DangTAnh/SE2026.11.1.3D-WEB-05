param([string]$Name,[string]$Command)
$base=Split-Path $PSScriptRoot -Parent
$env:TEMP=Join-Path $base 'tmp';$env:TMP=$env:TEMP
New-Item -ItemType Directory -Force $env:TEMP | Out-Null
$env:VT121_TEST_OUTPUT=Join-Path $base "tmp/artifacts-$Name"
$env:PLAYWRIGHT_HTML_OUTPUT_DIR=Join-Path $base "tmp/report-$Name"
$log=Join-Path $PSScriptRoot "$Name.log"
"UTC: $([DateTime]::UtcNow.ToString('o'))`nPWD: $PWD`nOS: $([Environment]::OSVersion.VersionString)`nNode: $(node --version)`nCommand: $Command" | Set-Content $log
"VT121_TEST_OUTPUT: $env:VT121_TEST_OUTPUT`nVT121_SOURCE_BASELINE: $env:VT121_SOURCE_BASELINE`nVT121_VITE_TRANSPORT: $env:VT121_VITE_TRANSPORT`nPLAYWRIGHT_BROWSERS_PATH: $env:PLAYWRIGHT_BROWSERS_PATH" | Add-Content $log
if ($env:GIT_DIR) { git rev-parse HEAD | Add-Content $log }
& pwsh -NoProfile -Command $Command 2>&1 | Tee-Object -FilePath $log -Append
$code=$LASTEXITCODE;"EXIT: $code" | Tee-Object -FilePath $log -Append
exit $code
