# PowerShell script to run E2E tests locally
# 로컬 환경에서 E2E 테스트 실행을 위한 스크립트

param(
    [string]$TestSuite = "all",
    [switch]$Headed = $false,
    [switch]$Debug = $false,
    [string]$Browser = "chromium",
    [string]$Device = "mobile"
)

Write-Host "🎭 YameYame E2E Test Runner" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# 환경 변수 설정
$env:API_URL = "http://localhost:3000"
$env:BASE_URL = "http://localhost:8081"
$env:NODE_ENV = "test"

# 기존 프로세스 확인 및 정리
Write-Host "🧹 기존 프로세스 정리 중..." -ForegroundColor Yellow

# 포트 사용 중인 프로세스 확인
$backendProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$frontendProcess = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue

if ($backendProcess) {
    Write-Host "⚠️  포트 3000이 사용 중입니다. 기존 백엔드 서버를 종료해주세요." -ForegroundColor Red
}

if ($frontendProcess) {
    Write-Host "⚠️  포트 8081이 사용 중입니다. 기존 프론트엔드 서버를 종료해주세요." -ForegroundColor Red
}

# 백엔드 서버 시작
Write-Host "🚀 백엔드 서버 시작 중..." -ForegroundColor Green
Push-Location "../worktrees/backend-api"

$backendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run dev:mock
} -ArgumentList (Get-Location)

Pop-Location

# 백엔드 서버 준비 대기
Write-Host "⏳ 백엔드 서버 준비 대기 중..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0

do {
    Start-Sleep -Seconds 2
    $waited += 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ 백엔드 서버가 준비되었습니다!" -ForegroundColor Green
            break
        }
    }
    catch {
        if ($waited -ge $maxWait) {
            Write-Host "❌ 백엔드 서버 시작 실패 (${waited}초 대기)" -ForegroundColor Red
            Stop-Job $backendJob
            Remove-Job $backendJob
            exit 1
        }
        Write-Host "대기 중... (${waited}/${maxWait}초)" -ForegroundColor Yellow
    }
} while ($waited -lt $maxWait)

# 프론트엔드 서버 시작
Write-Host "📱 프론트엔드 서버 시작 중..." -ForegroundColor Green
Push-Location "../worktrees/frontend-ui/yameyame-app"

$frontendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npx expo start --web --non-interactive
} -ArgumentList (Get-Location)

Pop-Location

# 프론트엔드 서버 준비 대기
Write-Host "⏳ 프론트엔드 서버 준비 대기 중..." -ForegroundColor Yellow
$maxWait = 60
$waited = 0

do {
    Start-Sleep -Seconds 2
    $waited += 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8081" -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ 프론트엔드 서버가 준비되었습니다!" -ForegroundColor Green
            break
        }
    }
    catch {
        if ($waited -ge $maxWait) {
            Write-Host "❌ 프론트엔드 서버 시작 실패 (${waited}초 대기)" -ForegroundColor Red
            Stop-Job $backendJob, $frontendJob
            Remove-Job $backendJob, $frontendJob
            exit 1
        }
        Write-Host "대기 중... (${waited}/${maxWait}초)" -ForegroundColor Yellow
    }
} while ($waited -lt $maxWait)

# Playwright 브라우저 설치 확인
Write-Host "🌐 Playwright 브라우저 확인 중..." -ForegroundColor Green
if (-not (Test-Path "node_modules/@playwright")) {
    Write-Host "📦 Playwright 설치 중..." -ForegroundColor Yellow
    npm ci
}

npx playwright install $Browser --with-deps

# 테스트 실행
Write-Host "🎯 테스트 실행 중..." -ForegroundColor Green
Write-Host "테스트 스위트: $TestSuite" -ForegroundColor Cyan
Write-Host "브라우저: $Browser" -ForegroundColor Cyan
Write-Host "디바이스: $Device" -ForegroundColor Cyan

try {
    # 테스트 명령 구성
    $testCommand = "npx playwright test"
    
    if ($Headed) {
        $testCommand += " --headed"
    }
    
    if ($Debug) {
        $testCommand += " --debug"
    }
    
    # 테스트 스위트별 실행
    switch ($TestSuite) {
        "smoke" {
            $testCommand += " --grep smoke"
        }
        "auth" {
            $testCommand += " tests/auth/"
        }
        "navigation" {
            $testCommand += " tests/navigation/"
        }
        "features" {
            $testCommand += " tests/features/"
        }
        "api" {
            $testCommand += " tests/api/"
        }
        "performance" {
            $testCommand += " tests/performance/"
        }
        "cross-platform" {
            $testCommand += " tests/cross-platform/"
        }
        "mobile" {
            if ($Device -eq "tablet") {
                $testCommand += " --project=""Tablet - iPad"""
            } else {
                $testCommand += " --project=""Mobile Chrome - Portrait"""
            }
        }
        "all" {
            # 모든 테스트 실행 (기본값)
        }
        default {
            Write-Host "알 수 없는 테스트 스위트: $TestSuite" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "실행 명령: $testCommand" -ForegroundColor Gray
    Invoke-Expression $testCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 모든 테스트가 성공했습니다!" -ForegroundColor Green
    } else {
        Write-Host "❌ 일부 테스트가 실패했습니다." -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ 테스트 실행 중 오류 발생: $($_.Exception.Message)" -ForegroundColor Red
    $LASTEXITCODE = 1
}

# 정리 작업
Write-Host "🧹 정리 작업 중..." -ForegroundColor Yellow

try {
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "✅ 서버 프로세스 정리 완료" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  프로세스 정리 중 오류 발생: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 리포트 표시
if (Test-Path "playwright-report/index.html") {
    Write-Host "📊 테스트 리포트가 생성되었습니다!" -ForegroundColor Green
    Write-Host "리포트 보기: npx playwright show-report" -ForegroundColor Cyan
}

# 결과 폴더 정보
if (Test-Path "test-results") {
    $resultFiles = Get-ChildItem -Path "test-results" -Recurse
    Write-Host "📁 테스트 결과 파일: $($resultFiles.Count)개" -ForegroundColor Cyan
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "🎭 테스트 실행 완료" -ForegroundColor Cyan

exit $LASTEXITCODE