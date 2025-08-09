# 토큰 효율성 기반 자동 백업 시스템
# Token-Efficient Auto Backup System

param(
    [string]$Phase = "development",
    [string]$TokenThreshold = "75", # 75% 사용 시 자동 백업
    [switch]$ForceBackup,
    [switch]$QuickMode
)

Write-Host "🤖 토큰 효율성 기반 자동 백업 시스템 시작..." -ForegroundColor Green

Set-Location "C:\Users\taejo\yameyame"

# 토큰 사용량 추정 함수
function Estimate-TokenUsage {
    $fileCount = (Get-ChildItem -Recurse -File | Where-Object {
        $_.Extension -match '\.(md|js|ts|tsx|json|py|txt)$' -and 
        $_.Name -notmatch '^(\.git|node_modules|\.expo)' 
    }).Count
    
    $recentChanges = (git diff --name-only HEAD~1 2>$null | Measure-Object).Count
    $estimatedTokens = ($fileCount * 50) + ($recentChanges * 200) + 1000
    
    return $estimatedTokens
}

# 현재 토큰 사용량 추정
$currentTokens = Estimate-TokenUsage
$tokenPercentage = [math]::Min(100, ($currentTokens / 8000) * 100)

Write-Host "📊 현재 예상 토큰 사용량: $currentTokens tokens ($([math]::Round($tokenPercentage, 1))%)" -ForegroundColor Yellow

# 토큰 임계값 확인
if ($tokenPercentage -ge $TokenThreshold -or $ForceBackup) {
    Write-Host "⚠️  토큰 임계값 도달! 자동 백업 시작..." -ForegroundColor Red
    
    # 1. 현재 작업 상태 스냅샷
    Write-Host "📸 작업 상태 스냅샷 생성..." -ForegroundColor Yellow
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
    
    # 간단한 진행 상황 문서 생성
    $progressReport = @"
# 🚀 개발 진행 상황 스냅샷 - $timestamp

## ⚡ 자동 백업 사유
- 토큰 사용량: $tokenPercentage% (임계값: $TokenThreshold%)
- 예상 토큰: $currentTokens tokens
- 백업 시각: $(Get-Date)

## 📋 현재 작업 상태
- Git 브랜치: $(git branch --show-current)
- 마지막 커밋: $(git log -1 --oneline)
- 변경된 파일: $(git diff --name-only | Out-String)

## 🎯 다음 세션 계속 작업
이 백업 지점에서 개발을 계속 진행하세요.

자동 생성됨 - Token-Efficient Auto Backup System
"@

    $progressReport | Out-File -FilePath "PROGRESS_SNAPSHOT_$timestamp.md" -Encoding UTF8
    
    # 2. Git 추가 및 커밋 (간단한 메시지)
    Write-Host "💾 Git 커밋 진행..." -ForegroundColor Yellow
    git add .
    
    $commitMsg = if ($QuickMode) {
        "save: Auto backup at $tokenPercentage% token usage"
    } else {
        @"
save: Auto backup checkpoint - $timestamp

Token Usage: $tokenPercentage% (threshold: $TokenThreshold%)
Auto-generated backup to prevent token exhaustion

Ready to continue development in next session
Generated with Claude Code Auto-Backup System
"@
    }
    
    git commit -m $commitMsg
    
    # 3. GitHub 푸시
    Write-Host "📤 GitHub 업로드 중..." -ForegroundColor Yellow
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 자동 백업 완료!" -ForegroundColor Green
        Write-Host "📍 GitHub: https://github.com/tjkin1201/yameyame-app" -ForegroundColor Cyan
        Write-Host "🔄 토큰 리셋 후 작업을 계속하세요." -ForegroundColor Green
    } else {
        Write-Host "❌ GitHub 업로드 실패" -ForegroundColor Red
    }
    
} else {
    Write-Host "✅ 토큰 사용량 양호 ($([math]::Round($tokenPercentage, 1))%). 계속 작업 가능합니다." -ForegroundColor Green
}

Write-Host "`n📋 토큰 효율성 팁:" -ForegroundColor Yellow
Write-Host "- 현재 사용량: $([math]::Round($tokenPercentage, 1))%" -ForegroundColor White
Write-Host "- 권장 백업 시점: 75%" -ForegroundColor White  
Write-Host "- 강제 백업: -ForceBackup 플래그 사용" -ForegroundColor White
Write-Host "- 빠른 모드: -QuickMode 플래그 사용" -ForegroundColor White