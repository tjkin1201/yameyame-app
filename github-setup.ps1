# YameYame GitHub 저장소 설정 스크립트
# Usage: .\github-setup.ps1

Write-Host "🚀 YameYame GitHub 저장소 설정 시작..." -ForegroundColor Green

# GitHub CLI 인증 확인
Write-Host "`n1. GitHub CLI 인증 확인..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ GitHub CLI 인증이 필요합니다." -ForegroundColor Red
    Write-Host "다음 명령어로 인증하세요: gh auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ GitHub CLI 인증 완료" -ForegroundColor Green

# 저장소 생성
Write-Host "`n2. GitHub 저장소 생성..." -ForegroundColor Yellow
$repoExists = gh repo view yameyame-app 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  저장소가 이미 존재합니다." -ForegroundColor Yellow
} else {
    gh repo create yameyame-app --public --description "Badminton Club Management System - React Native + Node.js" --clone=false
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GitHub 저장소 생성 완료" -ForegroundColor Green
    } else {
        Write-Host "❌ 저장소 생성 실패" -ForegroundColor Red
        exit 1
    }
}

# 원격 저장소 추가
Write-Host "`n3. 원격 저장소 설정..." -ForegroundColor Yellow
$remoteExists = git remote get-url origin 2>&1
if ($LASTEXITCODE -ne 0) {
    git remote add origin https://github.com/tjkin1201/yameyame-app.git
    Write-Host "✅ 원격 저장소 추가 완료" -ForegroundColor Green
} else {
    Write-Host "⚠️  원격 저장소가 이미 설정되어 있습니다: $remoteExists" -ForegroundColor Yellow
}

# 브랜치 설정
Write-Host "`n4. 브랜치 설정..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    git branch -M main
}
Write-Host "✅ 메인 브랜치 설정 완료" -ForegroundColor Green

# 첫 푸시
Write-Host "`n5. GitHub에 업로드..." -ForegroundColor Yellow
git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHub 업로드 완료!" -ForegroundColor Green
} else {
    Write-Host "❌ GitHub 업로드 실패" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 GitHub 설정 완료!" -ForegroundColor Green
Write-Host "📍 저장소 주소: https://github.com/tjkin1201/yameyame-app" -ForegroundColor Cyan
Write-Host "`n다음 단계:" -ForegroundColor Yellow
Write-Host "1. 브랜치 보호 규칙 설정" -ForegroundColor White
Write-Host "2. 이슈 템플릿 및 PR 템플릿 추가" -ForegroundColor White
Write-Host "3. GitHub Actions CI/CD 설정" -ForegroundColor White
Write-Host "4. 팀원 초대 (필요시)" -ForegroundColor White