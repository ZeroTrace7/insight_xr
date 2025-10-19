# InsightXR Health Check Script
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  InsightXR - System Health Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$allGood = $true

# 1. Check Java
Write-Host "Checking Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    if ($javaVersion -match '"(\d+)') {
        $version = $matches[1]
        if ([int]$version -ge 21) {
            Write-Host "  Java $version installed" -ForegroundColor Green
        } else {
            Write-Host "  Java $version found (Java 21+ recommended)" -ForegroundColor Yellow
            $allGood = $false
        }
    }
} catch {
    Write-Host "  Java not found!" -ForegroundColor Red
    $allGood = $false
}

# 2. Check Maven
Write-Host "`nChecking Maven..." -ForegroundColor Yellow
try {
    $mavenVersion = mvn -version 2>&1 | Select-Object -First 1
    if ($mavenVersion -match "Apache Maven") {
        Write-Host "  Maven installed" -ForegroundColor Green
    }
} catch {
    Write-Host "  Maven not found!" -ForegroundColor Red
    $allGood = $false
}

# 3. Check Node.js
Write-Host "`nChecking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Node.js not found!" -ForegroundColor Red
    $allGood = $false
}

# 4. Check npm
Write-Host "`nChecking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "  npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  npm not found!" -ForegroundColor Red
    $allGood = $false
}

# 5. Check project files
Write-Host "`nChecking Project Files..." -ForegroundColor Yellow
$files = @(
    "package.json",
    "index.html",
    "index.tsx",
    "vite.config.ts",
    "java-leaderboard\pom.xml",
    "java-leaderboard\src\com\insightxr\App.java"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  $file" -ForegroundColor Green
    } else {
        Write-Host "  $file (missing!)" -ForegroundColor Red
        $allGood = $false
    }
}

# 6. Check node_modules
Write-Host "`nChecking Dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  node_modules installed" -ForegroundColor Green
} else {
    Write-Host "  node_modules missing - run: npm install" -ForegroundColor Yellow
    $allGood = $false
}

# 7. Check Java build
Write-Host "`nChecking Java Build..." -ForegroundColor Yellow
if (Test-Path "java-leaderboard\target\java-leaderboard-1.0-SNAPSHOT.jar") {
    $jarSize = (Get-Item "java-leaderboard\target\java-leaderboard-1.0-SNAPSHOT.jar").Length
    Write-Host "  JAR built ($([int]($jarSize/1KB)) KB)" -ForegroundColor Green
} else {
    Write-Host "  JAR not built - run: npm run build:java" -ForegroundColor Yellow
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "  System Ready! Run: npm run dev" -ForegroundColor Green
} else {
    Write-Host "  Some issues found - check above" -ForegroundColor Yellow
}
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Quick Commands:" -ForegroundColor Cyan
Write-Host "  npm run dev          - Start both servers" -ForegroundColor White
Write-Host "  npm run build        - Build frontend" -ForegroundColor White
Write-Host "  npm run build:java   - Build Java backend" -ForegroundColor White
Write-Host "  npm run leaderboard  - Start only leaderboard" -ForegroundColor White
Write-Host ""
