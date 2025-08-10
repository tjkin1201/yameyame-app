# YAMEYAME 모니터링 시스템 시작 스크립트

param(
    [switch]$Verbose,
    [switch]$NoLogs,
    [string]$Port = "9999"
)

$ErrorActionPreference = "Stop"

Write-Host "📊 YAMEYAME 모니터링 시스템 시작" -ForegroundColor Cyan
Write-Host "포트: $Port" -ForegroundColor Yellow

function Install-Dependencies {
    Write-Host "📦 모니터링 의존성 설치 중..." -ForegroundColor Blue
    
    if (!(Test-Path "node_modules")) {
        Write-Host "npm install 실행 중..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ 의존성 설치 실패" -ForegroundColor Red
            exit 1
        }
        Write-Host "✅ 의존성 설치 완료" -ForegroundColor Green
    }
}

function Start-MonitoringServer {
    Write-Host "🚀 모니터링 서버 시작 중..." -ForegroundColor Blue
    
    # 디렉토리 생성
    if (!(Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" -Force }
    if (!(Test-Path "metrics")) { New-Item -ItemType Directory -Path "metrics" -Force }
    if (!(Test-Path "health-reports")) { New-Item -ItemType Directory -Path "health-reports" -Force }
    if (!(Test-Path "monitoring-queue")) { New-Item -ItemType Directory -Path "monitoring-queue" -Force }
    
    # 환경 변수 설정
    $env:PORT = $Port
    $env:NODE_ENV = "development"
    
    Write-Host "📊 대시보드: http://localhost:$Port" -ForegroundColor Green
    Write-Host "🔌 WebSocket: ws://localhost:$Port" -ForegroundColor Green
    Write-Host "⚡ API: http://localhost:$Port/api/status" -ForegroundColor Green
    Write-Host "" -ForegroundColor White
    Write-Host "모니터링 시작 중... (Ctrl+C로 중지)" -ForegroundColor Yellow
    
    # 서버 시작
    node monitoring-server.js
}

function Test-Port {
    param([int]$TestPort)
    
    try {
        $connection = Test-NetConnection -ComputerName "localhost" -Port $TestPort -InformationLevel Quiet -WarningAction SilentlyContinue
        return $connection
    } catch {
        return $false
    }
}

# 메인 실행
Push-Location $PSScriptRoot

try {
    # 포트 충돌 검사
    if (Test-Port -TestPort $Port) {
        Write-Host "⚠️  포트 $Port가 이미 사용 중입니다." -ForegroundColor Yellow
        Write-Host "다른 포트를 사용하시겠습니까? [y/N]: " -NoNewline -ForegroundColor Yellow
        $response = Read-Host
        
        if ($response -eq 'y' -or $response -eq 'Y') {
            $Port = "9998"
            Write-Host "포트를 $Port로 변경합니다." -ForegroundColor Green
        } else {
            Write-Host "기존 프로세스를 종료한 후 다시 시도하세요." -ForegroundColor Red
            exit 1
        }
    }
    
    Install-Dependencies
    Start-MonitoringServer
    
} catch {
    Write-Host "❌ 오류 발생: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}