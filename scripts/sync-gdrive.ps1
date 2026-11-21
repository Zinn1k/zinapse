# Zinapse Google Drive Sync & Backup Script
# Usage: npm run backup:gdrive OR powershell -ExecutionPolicy Bypass -File .\scripts\sync-gdrive.ps1

$ErrorActionPreference = "Stop"

$FOLDER_ID = "1tTcAMhKrZr5ojX0pkzGTTZcYpX8Ykyan"
$FOLDER_URL = "https://drive.google.com/drive/folders/$FOLDER_ID"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Zinapse -> Google Drive Backup & AI Sync Utility" -ForegroundColor Cyan
Write-Host "   Folder ID: $FOLDER_ID" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Recreate clean source code archive
Write-Host "`n[1/5] Creating clean source code archive (zinapse-source.zip)..." -ForegroundColor Yellow
if (Test-Path "zinapse-source.zip") {
    Remove-Item "zinapse-source.zip" -Force
}
git archive -o zinapse-source.zip HEAD
if (Test-Path "PROJECT_CONTEXT_FOR_AI.md") {
    Compress-Archive -Path "PROJECT_CONTEXT_FOR_AI.md" -Update -DestinationPath "zinapse-source.zip"
}
if (Test-Path "DEEPSEEK_HARNESS_SUMMARY.md") {
    Compress-Archive -Path "DEEPSEEK_HARNESS_SUMMARY.md" -Update -DestinationPath "zinapse-source.zip"
}
if (Test-Path ".env.example") {
    Compress-Archive -Path ".env.example" -Update -DestinationPath "zinapse-source.zip"
}
$zipSize = (Get-Item "zinapse-source.zip").Length / 1KB
Write-Host "✓ zinapse-source.zip created ($([math]::Round($zipSize, 1)) KB)." -ForegroundColor Green

# 2. Known Google Drive File ID Mapping for fast in-place update (preserves URLs and history)
$knownFileIds = @{
    # Root Files
    "PROJECT_CONTEXT_FOR_AI.md"       = "1Lkq_Vsep_kMCnm0wF0fQ2M8thju6ouTJ"
    "DEEPSEEK_HARNESS_SUMMARY.md"      = "1P6g4vaMv4SpKuy0C9TV9fkXXns13hQ82"
    "README.md"                        = "1L3iejeuUzB-_6YZiKM6l7sOqMURgnfV0"
    "package.json"                     = "1nFuRBK2u6YlFs3BoVp1-OqUFpjM8_5LR"
    "capacitor.config.ts"              = "1YJc7If9oIT5lRDiSSx1lD2KteBSFN6Pq"
    "next.config.ts"                   = "1RfEcTeZ3aaEVJ1Jfd1VhbsDRS4uEbx6K"
    "firestore.rules"                  = "16KQyzfzFPx5nXrQd54I72Tq6N7k-D2Jw"
    ".env.example"                     = "1jewabghu9Tfik1-Um3PBIuGQiWu4KfSn"
    "zinapse-source.zip"               = "1LNKoMoVhI_FzCun_ijKE4DuBdKcqdajA"
    "zinapse-debug.apk"                = "1kWJIQT1px7e1UDNDycqYu7FM-PxzOrMv"

    # Study Components (src/components/study/)
    "src/components/study/FlashcardsMode.tsx" = "1T0TmAk710p9ZGK9c6fOeTQMhhpd7KARr"
    "src/components/study/LearnMode.tsx"      = "15XjXLKyN3ly19S7doWJsE-mlZ0pwGEOp"
    "src/components/study/MatchMode.tsx"      = "1yGwI-XOkjwtZJYBMkrW1oHpCe5UnuSPv"
    "src/components/study/TestMode.tsx"       = "17jh_844DsklE2ON_R0zHMHXNaIA5K98l"

    # Key Components (src/components/)
    "src/components/AIGenerateModal.tsx"      = "1AgH4KzdnK67HZ9xcxaRUzXPRor9bDOWK"
    "src/components/SettingsModal.tsx"        = "1ROht4AA8YyM-h708yHn2qv0hCaYVjr8l"
    "src/components/AppHeader.tsx"            = "1UbQA1DZcXUGMIPYlGQioXXy7cUNksArS"
    "src/components/AppUpdateNotification.tsx"= "1SHwHoIuUUpcKaJhYB9rcUbk1nneIRPC4"
    "src/components/AuthModal.tsx"            = "1VLLhJRWqU4JEFo22kvSez2CtLglC8GAy"
    "src/components/CardEditorModal.tsx"      = "1gsWkr-BkzhDECQKoJiXs4Qf-3QBAYv7x"
    "src/components/CreateEditDeckModal.tsx"  = "1xh608tZoO1PIiAhGJWgm1Stno_1v4_dl"
    "src/components/DeckCard.tsx"             = "10HytH3pQmE3RD9cBNUE72SJQNaG-2rCX"
    "src/components/DeckDetailView.tsx"       = "154jfmwpbex-6Ieyv53iTcj7Ykq9mI3vY"
    "src/components/FSRSAnalyticsModal.tsx"   = "1XWMujsZE-GTUbHE0lJ6HNuaDCzghjcI_"
    "src/components/MarkdownMath.tsx"         = "1Gzydjy9it1jxshHEiyCOBfxd4N_7QUuv"
    "src/components/ServiceWorkerRegister.tsx"= "1HbwgIm_oJLQD4ejCcAv4Jwv0ZxdMC1Ei"
    "src/components/ZinapseLogo.tsx"          = "117wcF9pKg5hS2H58JnrGCHjiU-BaY6Uc"

    # Lib modules (src/lib/)
    "src/lib/ai.ts"                           = "1tnck-L7yuPT32MD6WzURDs-gvWrsi50k"
    "src/lib/db.ts"                           = "1iBqBHqE7E1Nxpda_lo1aSETadJ6U4AWY"
    "src/lib/fsrs.ts"                         = "1o8KMyok-JfCVZirQvWfq36I553O71qCZ"
    "src/lib/analytics.ts"                    = "1ZU4fHJK8wCh6kUsTlGw3PMkUzgFdL9pi"
    "src/lib/cloze.ts"                        = "1koCCGyWQiAu_pJG17s26lKi55QpJKTcN"
    "src/lib/firebase.ts"                     = "17HEA9l38wDui6nHTPMsx56kxnJis8-nN"
    "src/lib/image-compression.ts"            = "1LJndAVW8gthN9fo8UCQveilgjzRhtJSP"
    "src/lib/importer.ts"                     = "1BzaCI9B2TY3hT05jfK3OTSl8aFdNGuwM"
    "src/lib/levenshtein.ts"                  = "16N_8TOoxNiIMvUoCrN62_-3poCmYiKK9"
    "src/lib/sound.ts"                        = "1WQRX7C62XSJYrkp-j7VHlSV4HL009dni"
    "src/lib/speech.ts"                       = "1yaJI4-Mou8oYqJTZMehIqrE1vEWSxoP2"
    "src/lib/sync.ts"                         = "1gnsaNcIG0hyEkJmmAN3vM9kU10SL0HPx"
    "src/lib/updater.ts"                      = "1jOkYYLilHxIINA89ab9llD3eD_mmSGyD"
    "src/lib/utils.ts"                        = "1zE3iZu1vojd3CQQr_q1EOPHXipwgfi3C"

    # App root pages (src/app/)
    "src/app/page.tsx"                        = "1qWFwOhs64MBlXAnFmUMwrUeR0BiGM5MZ"
    "src/app/layout.tsx"                      = "1nSd1nE_OhVobOCnpeI64byk50cH7FZ8b"
    "src/app/manifest.ts"                     = "1DPYEH-NBFLmcYVQhazhMAmD3aZSMLdI8"
    "src/app/globals.css"                     = "1lxT2f-TtgJFlw-LWiz0tPx-MmBPRQXxi"
}

# 3. Synchronize All Mapped Files In-Place
Write-Host "`n[2/5] Updating mapped files in-place on Google Drive..." -ForegroundColor Yellow
$updatedCount = 0
foreach ($path in $knownFileIds.Keys) {
    if (Test-Path $path) {
        $fileId = $knownFileIds[$path]
        $display = Split-Path $path -Leaf
        Write-Host "  -> Updating $display..." -NoNewline
        try {
            & gdrive mutate update $fileId $path | Out-Null
            Write-Host " Done." -ForegroundColor Green
            $updatedCount++
        } catch {
            Write-Host " Failed: $_" -ForegroundColor Red
        }
    }
}
Write-Host "✓ In-place updated $updatedCount files." -ForegroundColor Green

# 4. Check if zinapse-debug.apk exists and update
Write-Host "`n[3/5] Checking Android APK..." -ForegroundColor Yellow
if (Test-Path "zinapse-debug.apk") {
    $apkId = $knownFileIds["zinapse-debug.apk"]
    Write-Host "  -> Updating zinapse-debug.apk in-place..." -NoNewline
    & gdrive mutate update $apkId "zinapse-debug.apk" | Out-Null
    Write-Host " Done." -ForegroundColor Green
} else {
    Write-Host "  (zinapse-debug.apk not found in workspace root, skipping)" -ForegroundColor Gray
}

# 5. Check and sync AI routes to Drive (create-ai and api/generate-deck)
Write-Host "`n[4/5] Checking subroutes (create-ai, api/generate-deck)..." -ForegroundColor Yellow
$appFolderId = "1xPjHb-RBvaNYYI_jRs5M49Fjr7YOlYoO"

# List files in src/app
$appItems = & gdrive readonly ls $appFolderId --json | ConvertFrom-Json
$appMap = @{}
foreach ($item in $appItems) { $appMap[$item.name] = $item.id }

# Ensure create-ai folder
$createAiFolderId = $appMap["create-ai"]
if (-not $createAiFolderId) {
    Write-Host "  -> Creating create-ai folder on Drive..." -NoNewline
    $mkdirOut = & gdrive mutate mkdir "create-ai" --parent $appFolderId
    if ($mkdirOut -match "ID:\s*([a-zA-Z0-9_-]+)") {
        $createAiFolderId = $matches[1]
    } else {
        # lookup newly created folder
        $refreshed = & gdrive readonly ls $appFolderId --json | ConvertFrom-Json
        $createAiFolderId = ($refreshed | Where-Object { $_.name -eq "create-ai" }).id
    }
    Write-Host " Done." -ForegroundColor Green
}

if ($createAiFolderId -and (Test-Path "src/app/create-ai/page.tsx")) {
    $cItems = & gdrive readonly ls $createAiFolderId --json | ConvertFrom-Json
    $cFile = $cItems | Where-Object { $_.name -eq "page.tsx" }
    if ($cFile) {
        Write-Host "  -> Updating src/app/create-ai/page.tsx..." -NoNewline
        & gdrive mutate update $cFile.id "src/app/create-ai/page.tsx" | Out-Null
        Write-Host " Done." -ForegroundColor Green
    } else {
        Write-Host "  -> Uploading src/app/create-ai/page.tsx..." -NoNewline
        & gdrive mutate upload "src/app/create-ai/page.tsx" --parent $createAiFolderId | Out-Null
        Write-Host " Done." -ForegroundColor Green
    }
}

# Ensure api/generate-deck folder
$apiFolderId = $appMap["api"]
if (-not $apiFolderId) {
    Write-Host "  -> Creating api folder on Drive..." -NoNewline
    & gdrive mutate mkdir "api" --parent $appFolderId | Out-Null
    $refreshed = & gdrive readonly ls $appFolderId --json | ConvertFrom-Json
    $apiFolderId = ($refreshed | Where-Object { $_.name -eq "api" }).id
    Write-Host " Done." -ForegroundColor Green
}

if ($apiFolderId) {
    $apiItems = & gdrive readonly ls $apiFolderId --json | ConvertFrom-Json
    $deckFolder = $apiItems | Where-Object { $_.name -eq "generate-deck" }
    $deckFolderId = $deckFolder.id
    if (-not $deckFolderId) {
        Write-Host "  -> Creating generate-deck folder on Drive..." -NoNewline
        & gdrive mutate mkdir "generate-deck" --parent $apiFolderId | Out-Null
        $refreshed = & gdrive readonly ls $apiFolderId --json | ConvertFrom-Json
        $deckFolderId = ($refreshed | Where-Object { $_.name -eq "generate-deck" }).id
        Write-Host " Done." -ForegroundColor Green
    }

    if ($deckFolderId -and (Test-Path "src/app/api/generate-deck/route.ts")) {
        $dItems = & gdrive readonly ls $deckFolderId --json | ConvertFrom-Json
        $dFile = $dItems | Where-Object { $_.name -eq "route.ts" }
        if ($dFile) {
            Write-Host "  -> Updating src/app/api/generate-deck/route.ts..." -NoNewline
            & gdrive mutate update $dFile.id "src/app/api/generate-deck/route.ts" | Out-Null
            Write-Host " Done." -ForegroundColor Green
        } else {
            Write-Host "  -> Uploading src/app/api/generate-deck/route.ts..." -NoNewline
            & gdrive mutate upload "src/app/api/generate-deck/route.ts" --parent $deckFolderId | Out-Null
            Write-Host " Done." -ForegroundColor Green
        }
    }
}

# 6. Summary
Write-Host "`n[5/5] Backup & Sync completed successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "All files on Google Drive are synchronized to latest build!" -ForegroundColor Green
Write-Host "Google Drive Backup Folder URL:" -ForegroundColor White
Write-Host "$FOLDER_URL" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
