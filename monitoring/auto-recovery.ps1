# YAMEYAME 모니터링 자동 복구 스크립트
# 모니터링 서비스 상태를 확인하고 자동으로 복구합니다

param(
    [switch]$Force,
    [switch]$Verbose,
    [int]$Port = 9999,
    [int]$CheckInterval = 30
)

$ErrorActionPreference = "Stop"

# 설정
$MONITORING_DIR = "C:\Users\taejo\yameyame\monitoring"
$BACKEND_API_URL = "http://localhost:3000/api/health"
$MONITORING_URL = "http://localhost:$Port/health"
$LOG_FILE = Join-Path $MONITORING_DIR "auto-recovery.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    Write-Host $logEntry -ForegroundColor $(
        switch ($Level) {
            "ERROR" { "Red" }
            "WARN" { "Yellow" }
            "SUCCESS" { "Green" }
            default { "White" }
        }
    )
    
    Add-Content -Path $LOG_FILE -Value $logEntry
}

function Test-ServiceHealth {
    param([string]$Url, [string]$ServiceName)
    
    try {
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec 10 -ErrorAction Stop
        if ($response.status -eq "healthy" -or $response -match "healthy") {
            Write-Log "✅ $ServiceName 정상 작동" "SUCCESS"
            return $true
        }
        return $false
    }
    catch {
        Write-Log "❌ $ServiceName 응답 없음: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Test-PortOpen {
    param([int]$TestPort)
    
    try {
        $connection = Test-NetConnection -ComputerName "localhost" -Port $TestPort -InformationLevel Quiet -WarningAction SilentlyContinue
        return $connection
    }
    catch {
        return $false
    }
}

function Start-MonitoringService {
    Write-Log "🚀 모니터링 서비스 복구 시작" "INFO"
    
    Push-Location $MONITORING_DIR
    
    try {
        # 의존성 확인
        if (!(Test-Path "node_modules")) {
            Write-Log "📦 의존성 설치 중..." "INFO"
            npm install --silent
            if ($LASTEXITCODE -ne 0) {
                throw "의존성 설치 실패"
            }
        }
        
        # 필요한 디렉토리 생성
        @("logs", "metrics", "health-reports", "monitoring-queue") | ForEach-Object {
            if (!(Test-Path $_)) {
                New-Item -ItemType Directory -Path $_ -Force | Out-Null
                Write-Log "📁 디렉토리 생성: $_" "INFO"
            }
        }
        
        # 환경 변수 설정
        $env:PORT = $Port
        $env:NODE_ENV = "development"
        
        # 모니터링 서버 시작 (백그라운드)
        Write-Log "🚀 모니터링 서버 시작 중... (포트: $Port)" "INFO"
        
        $processStartInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processStartInfo.FileName = "node"
        $processStartInfo.Arguments = "monitoring-server.js"
        $processStartInfo.WorkingDirectory = $MONITORING_DIR
        $processStartInfo.UseShellExecute = $false
        $processStartInfo.RedirectStandardOutput = $true
        $processStartInfo.RedirectStandardError = $true
        $processStartInfo.CreateNoWindow = $true
        
        $process = [System.Diagnostics.Process]::Start($processStartInfo)
        
        # 잠시 대기 후 상태 확인
        Start-Sleep -Seconds 5
        
        if (Test-ServiceHealth -Url $MONITORING_URL -ServiceName "모니터링 서비스") {
            Write-Log "✅ 모니터링 서비스 복구 완료" "SUCCESS"
            Write-Log "📊 대시보드: http://localhost:$Port" "SUCCESS"
            Write-Log "⚡ API: http://localhost:$Port/api/status" "SUCCESS"
            return $true
        }
        else {
            throw "서비스 시작 후에도 헬스체크 실패"
        }
    }
    catch {
        Write-Log "❌ 모니터링 서비스 복구 실패: $($_.Exception.Message)" "ERROR"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Start-HealthMonitoring {
    Write-Log "🔍 헬스 모니터링 시작 (체크 간격: ${CheckInterval}초)" "INFO"
    
    while ($true) {
        $backendHealthy = Test-ServiceHealth -Url $BACKEND_API_URL -ServiceName "Backend API"
        $monitoringHealthy = Test-ServiceHealth -Url $MONITORING_URL -ServiceName "모니터링 서비스"
        
        # Backend API는 정상이지만 모니터링이 다운된 경우
        if ($backendHealthy -and !$monitoringHealthy) {
            Write-Log "⚠️  모니터링 서비스 다운 감지 - 복구 시도" "WARN"
            
            if (Start-MonitoringService) {
                Write-Log "✅ 모니터링 서비스 자동 복구 성공" "SUCCESS"
            }
            else {
                Write-Log "❌ 모니터링 서비스 자동 복구 실패" "ERROR"
            }
        }
        
        # Backend API가 다운된 경우 알림만
        if (!$backendHealthy) {
            Write-Log "⚠️  Backend API 서비스 다운 - 수동 확인 필요" "WARN"
        }
        
        # 모든 서비스가 정상인 경우
        if ($backendHealthy -and $monitoringHealthy) {
            if ($Verbose) {
                Write-Log "✅ 모든 서비스 정상 작동" "SUCCESS"
            }
        }
        
        Start-Sleep -Seconds $CheckInterval
    }
}

function Show-Status {
    Write-Log "📊 YAMEYAME 서비스 상태 점검" "INFO"
    Write-Log "================================" "INFO"
    
    $backendStatus = if (Test-ServiceHealth -Url $BACKEND_API_URL -ServiceName "Backend API") { "✅ 정상" } else { "❌ 다운" }
    $monitoringStatus = if (Test-ServiceHealth -Url $MONITORING_URL -ServiceName "모니터링") { "✅ 정상" } else { "❌ 다운" }
    
    Write-Log "Backend API (포트 3000): $backendStatus" "INFO"
    Write-Log "모니터링 서비스 (포트 $Port): $monitoringStatus" "INFO"
    
    Write-Log "================================" "INFO"
}

# 메인 실행
function Main {
    Write-Log "🚀 YAMEYAME 모니터링 자동 복구 시스템 시작" "INFO"
    
    # 초기 상태 점검
    Show-Status
    
    # 강제 복구 모드
    if ($Force) {
        Write-Log "🔧 강제 복구 모드 실행" "INFO"
        Start-MonitoringService
        return
    }
    
    # 모니터링 서비스가 다운되어 있으면 복구 시도
    if (!(Test-ServiceHealth -Url $MONITORING_URL -ServiceName "모니터링 서비스")) {
        Write-Log "⚠️  모니터링 서비스 다운 감지 - 즉시 복구 시도" "WARN"
        Start-MonitoringService
    }
    
    # 지속적 헬스 모니터링 시작
    Start-HealthMonitoring
}

# 스크립트 실행
try {
    Main
}
catch {
    Write-Log "❌ 치명적 오류 발생: $($_.Exception.Message)" "ERROR"
    exit 1
}