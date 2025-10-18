# Simple test script to manually run the server in foreground
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Compiling..."
if (Test-Path bin) { Remove-Item -Recurse -Force bin }
New-Item -ItemType Directory -Force -Path bin | Out-Null
$files = Get-ChildItem -Path src -Recurse -Filter *.java | ForEach-Object { $_.FullName }
javac -cp "libs/*" -d bin $files

if ($LASTEXITCODE -ne 0) {
    Write-Host "Compilation failed"
    exit 1
}

Write-Host "Starting server (press Ctrl+C to stop)..."
java -cp "bin;libs/*" com.insightxr.App

# If we get here, server exited
Write-Host "Server stopped"
