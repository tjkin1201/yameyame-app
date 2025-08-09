# GitHub 푸시 스크립트
Write-Host "📤 GitHub 푸시 시작..." -ForegroundColor Green

# 프로젝트 루트로 이동
Set-Location "C:\Users\taejo\yameyame"

Write-Host "`n현재 위치: $PWD" -ForegroundColor Yellow

# Git 상태 확인
Write-Host "`n1. Git 상태 확인..." -ForegroundColor Yellow
git status

# 원격 저장소 확인
Write-Host "`n2. 원격 저장소 확인..." -ForegroundColor Yellow
$remoteExists = git remote get-url origin 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "원격 저장소 추가..." -ForegroundColor Yellow
    git remote add origin https://github.com/tjkin1201/yameyame-app.git
} else {
    Write-Host "원격 저장소: $remoteExists" -ForegroundColor Green
}

# 브랜치 이름 확인 및 설정
Write-Host "`n3. 브랜치 설정..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
Write-Host "현재 브랜치: $currentBranch" -ForegroundColor Yellow

if ($currentBranch -ne "main") {
    git branch -M main
    Write-Host "브랜치를 main으로 변경" -ForegroundColor Green
}

# GitHub에 푸시
Write-Host "`n4. GitHub에 푸시..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHub 푸시 성공!" -ForegroundColor Green
    Write-Host "`n🎉 GitHub 업로드 완료!" -ForegroundColor Green
    Write-Host "📍 저장소 주소: https://github.com/tjkin1201/yameyame-app" -ForegroundColor Cyan
} else {
    Write-Host "❌ GitHub 푸시 실패" -ForegroundColor Red
    Write-Host "`n원격 저장소 정보:" -ForegroundColor Yellow
    git remote -v
}

Write-Host "`n📋 다음 단계:" -ForegroundColor Yellow
Write-Host "1. 브랜치 보호 규칙 설정" -ForegroundColor White
Write-Host "2. Issue 템플릿 및 PR 템플릿 추가" -ForegroundColor White
Write-Host "3. GitHub Actions CI/CD 설정" -ForegroundColor White
Write-Host "4. Development ready to start!" -ForegroundColor White