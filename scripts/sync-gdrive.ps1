# Zinapse Google Drive Sync & Backup Script
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\sync-gdrive.ps1

$ErrorActionPreference = "Stop"

$FOLDER_ID = "1tTcAMhKrZr5ojX0pkzGTTZcYpX8Ykyan"
$FOLDER_URL = "https://drive.google.com/drive/folders/$FOLDER_ID"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Zinapse -> Google Drive Backup & AI Sync Utility" -ForegroundColor Cyan
Write-Host "   Folder ID: $FOLDER_ID" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Recreate clean source code archive
Write-Host "`n[1/4] Creating clean source code archive (zinapse-source.zip)..." -ForegroundColor Yellow
if (Test-Path "zinapse-source.zip") {
    Remove-Item "zinapse-source.zip" -Force
}
git archive -o zinapse-source.zip HEAD
if (Test-Path "PROJECT_CONTEXT_FOR_AI.md") {
    Compress-Archive -Path "PROJECT_CONTEXT_FOR_AI.md" -Update -DestinationPath "zinapse-source.zip"
}
if (Test-Path ".env.example") {
    Compress-Archive -Path ".env.example" -Update -DestinationPath "zinapse-source.zip"
}
Write-Host "✓ zinapse-source.zip created successfully." -ForegroundColor Green

# 2. Upload / Update Core Files
Write-Host "`n[2/4] Uploading core context and documentation..." -ForegroundColor Yellow
$coreFiles = @(
    "PROJECT_CONTEXT_FOR_AI.md",
    "README.md",
    "package.json",
    "capacitor.config.ts",
    "next.config.ts",
    "firestore.rules",
    ".env.example",
    "zinapse-source.zip"
)

foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        Write-Host "  -> Uploading $file..." -NoNewline
        & gdrive mutate upload $file --parent $FOLDER_ID | Out-Null
        Write-Host " Done." -ForegroundColor Green
    }
}

# 3. Upload Latest APK if exists
Write-Host "`n[3/4] Checking Android APK..." -ForegroundColor Yellow
if (Test-Path "zinapse-debug.apk") {
    Write-Host "  -> Uploading zinapse-debug.apk..." -NoNewline
    & gdrive mutate upload "zinapse-debug.apk" --parent $FOLDER_ID | Out-Null
    Write-Host " Done." -ForegroundColor Green
} else {
    Write-Host "  (zinapse-debug.apk not found in root, skipping)" -ForegroundColor Gray
}

# 4. Summary
Write-Host "`n[4/4] Sync completed successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Google Drive Backup Folder:" -ForegroundColor White
Write-Host "$FOLDER_URL" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
