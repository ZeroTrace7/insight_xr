<#
 PowerShell script to build and run the leaderboard microservice automatically
 - Ensures all required jars are in java-leaderboard\libs\ (use Maven + pom.xml to populate)
 - Auto-sets GOOGLE_APPLICATION_CREDENTIALS if serviceAccount.json exists in this folder
#>

$ErrorActionPreference = 'Stop'

# Ensure we run from the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$src = "src"
$build = "bin"
$mainClass = "com.insightxr.App"
$libs = "libs"

# Auto-pick service account if present
$saPath = Join-Path $scriptDir 'serviceAccount.json'
if (-not $env:GOOGLE_APPLICATION_CREDENTIALS -and (Test-Path $saPath)) {
	$env:GOOGLE_APPLICATION_CREDENTIALS = $saPath
	Write-Host "Using service account: $saPath"
}
if (-not $env:GOOGLE_APPLICATION_CREDENTIALS) {
	Write-Warning "No GOOGLE_APPLICATION_CREDENTIALS set and no serviceAccount.json found. Place your Firebase service account JSON as 'serviceAccount.json' here, or set the env var before running."
}

# Build classpath string
$jarFiles = Get-ChildItem -Path $libs -Filter *.jar | ForEach-Object { $_.FullName }
if (-not $jarFiles -or $jarFiles.Count -eq 0) {
	Write-Host "No jars found in '$libs'. Fetching dependencies with Maven..."
	mvn dependency:copy-dependencies -DoutputDirectory=$libs -DincludeScope=runtime | Out-Null
	$jarFiles = Get-ChildItem -Path $libs -Filter *.jar | ForEach-Object { $_.FullName }
}

# Prepare build directory
if (Test-Path $build) { Remove-Item -Recurse -Force $build }
New-Item -ItemType Directory -Force -Path $build | Out-Null

$classpath = "$build;" + ($jarFiles -join ";")

# Compile all Java files
Write-Host "Compiling Java source files to '$build'..."
javac -cp ($jarFiles -join ";") -d $build (Get-ChildItem -Path $src -Recurse -Filter *.java | ForEach-Object { $_.FullName })

# Run the main class
Write-Host "Starting leaderboard microservice..."
java -cp $classpath $mainClass
