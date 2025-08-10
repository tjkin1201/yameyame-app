# YameYame Development Workflow Script
# Enhanced development workflow with health checks and monitoring

param(
    [string]$Action = "start",
    [switch]$Verbose,
    [switch]$NoLogs
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 YameYame Development Workflow" -ForegroundColor Cyan
Write-Host "Action: $Action" -ForegroundColor Yellow

function Test-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Blue
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ npm not found" -ForegroundColor Red
        exit 1
    }
    
    # Check if dependencies are installed
    if (!(Test-Path "worktrees/frontend-ui/yameyame-app/node_modules")) {
        Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
        cd worktrees/frontend-ui/yameyame-app
        npm install
        cd ../../..
    }
    
    Write-Host "✅ Prerequisites check complete" -ForegroundColor Green
}

function Start-Development {
    Write-Host "🏁 Starting development environment..." -ForegroundColor Blue
    
    Test-Prerequisites
    
    # Start backend
    Write-Host "🔧 Starting backend server..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-Command", "cd worktrees/backend-api; npm run dev" -WindowStyle Normal
    
    Start-Sleep -Seconds 3
    
    # Start frontend
    Write-Host "📱 Starting frontend app..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-Command", "cd worktrees/frontend-ui/yameyame-app; npm start" -WindowStyle Normal
    
    Write-Host "✅ Development environment started!" -ForegroundColor Green
    Write-Host "📍 Backend: http://localhost:3001" -ForegroundColor White
    Write-Host "📍 Frontend: http://localhost:8081" -ForegroundColor White
}

function Test-HealthChecks {
    Write-Host "🏥 Running health checks..." -ForegroundColor Blue
    
    # Test backend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Backend health check passed" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Backend health check failed" -ForegroundColor Red
    }
    
    # Test frontend Metro bundler
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8081/status" -TimeoutSec 5
        Write-Host "✅ Frontend bundler running" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Frontend bundler status unknown" -ForegroundColor Yellow
    }
}

function Stop-Development {
    Write-Host "🛑 Stopping development environment..." -ForegroundColor Red
    
    # Kill Node.js processes
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "expo" -ErrorAction SilentlyContinue | Stop-Process -Force
    
    Write-Host "✅ Development environment stopped" -ForegroundColor Green
}

function Show-Status {
    Write-Host "📊 Development Environment Status" -ForegroundColor Cyan
    
    # Check running processes
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "🟢 Node.js processes running: $($nodeProcesses.Count)" -ForegroundColor Green
        $nodeProcesses | ForEach-Object {
            Write-Host "   PID: $($_.Id) | CPU: $($_.CPU)" -ForegroundColor White
        }
    } else {
        Write-Host "🔴 No Node.js processes running" -ForegroundColor Red
    }
    
    Test-HealthChecks
}

function Invoke-QualityChecks {
    Write-Host "🔍 Running code quality checks..." -ForegroundColor Blue
    
    # ESLint
    Write-Host "📝 Running ESLint..." -ForegroundColor Yellow
    npm run lint
    
    # Prettier
    Write-Host "✨ Checking code formatting..." -ForegroundColor Yellow
    npm run format:check
    
    Write-Host "✅ Quality checks complete" -ForegroundColor Green
}

# AutoRun: Advanced development environment launcher
function Start-AutoRun {
    Write-Host "`n🎯 Starting YameYame AutoRun Environment" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    
    Test-Prerequisites
    
    # Service configuration
    $services = @(
        @{ Name = "database-layer"; Port = 5000; Path = "worktrees/database-layer"; Command = "npm run dev"; WaitTime = 5 },
        @{ Name = "backend-api"; Port = 3001; Path = "worktrees/backend-api"; Command = "npm run dev"; WaitTime = 3 },
        @{ Name = "realtime-socket"; Port = 3002; Path = "worktrees/realtime-socket"; Command = "npm run dev"; WaitTime = 3 },
        @{ Name = "band-integration"; Port = 3003; Path = "worktrees/band-integration"; Command = "npm run dev"; WaitTime = 3 },
        @{ Name = "frontend-ui"; Port = 8081; Path = "worktrees/frontend-ui/yameyame-app"; Command = "npm start"; WaitTime = 5 }
    )
    
    $startedServices = @()
    
    for ($i = 0; $i -lt $services.Count; $i++) {
        $service = $services[$i]
        $phase = $i + 1
        
        Write-Host "`n📍 Phase $phase/$($services.Count): $($service.Name)" -ForegroundColor Yellow
        
        # Check if service directory exists
        if (!(Test-Path $service.Path)) {
            Write-Host "❌ Service path not found: $($service.Path)" -ForegroundColor Red
            continue
        }
        
        # Check if package.json exists
        if (!(Test-Path "$($service.Path)/package.json")) {
            Write-Host "⚠️ No package.json found, skipping: $($service.Name)" -ForegroundColor Yellow
            continue
        }
        
        Write-Host "🚀 Starting $($service.Name)..." -ForegroundColor Blue
        
        try {
            # Start service
            Start-Process powershell -ArgumentList "-Command", "cd $($service.Path); $($service.Command)" -WindowStyle Normal
            
            # Wait for service to start
            Start-Sleep -Seconds $service.WaitTime
            
            # Health check (optional for services that don't have health endpoints)
            $healthPassed = $true
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/health" -TimeoutSec 5 -ErrorAction Stop
                if ($response.StatusCode -eq 200) {
                    Write-Host "✅ $($service.Name) health check passed" -ForegroundColor Green
                }
            } catch {
                # For services without health endpoints, just check if process is running
                Write-Host "⚠️ $($service.Name) - no health endpoint, assuming healthy" -ForegroundColor Yellow
            }
            
            Write-Host "✅ $($service.Name) started successfully on port $($service.Port)" -ForegroundColor Green
            $startedServices += $service
            
        } catch {
            Write-Host "❌ Failed to start $($service.Name): $($_.Exception.Message)" -ForegroundColor Red
            
            # Rollback: Stop already started services
            Write-Host "🔄 Rolling back started services..." -ForegroundColor Red
            Stop-Development
            return
        }
    }
    
    # Success summary
    Write-Host "`n🎉 AutoRun Environment Started Successfully!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "📍 Services Running:" -ForegroundColor White
    
    foreach ($service in $startedServices) {
        Write-Host "   • $($service.Name) → http://localhost:$($service.Port)" -ForegroundColor White
    }
    
    Write-Host "`n🔧 Management Commands:" -ForegroundColor Cyan
    Write-Host "   npm run dev:status    → Check service status" -ForegroundColor White
    Write-Host "   npm run dev:health    → Health check all services" -ForegroundColor White
    Write-Host "   npm run autorun:stop  → Stop all services" -ForegroundColor White
}

# Advanced service management functions
$ServiceConfig = @{
    "database-layer" = @{
        Port = 5000
        HealthUrl = "http://localhost:5000/health"
        StartupTime = 8
        Command = "cd worktrees/database-layer; npm run dev"
        Dependencies = @()
    }
    "backend-api" = @{
        Port = 3001
        HealthUrl = "http://localhost:3001/api/health"
        StartupTime = 8
        Command = "cd worktrees/backend-api; npm run dev"
        Dependencies = @("database-layer")
    }
    "realtime-socket" = @{
        Port = 3002
        HealthUrl = "http://localhost:3002/health"
        StartupTime = 6
        Command = "cd worktrees/realtime-socket; npm run dev"
        Dependencies = @("database-layer")
    }
    "band-integration" = @{
        Port = 3003
        HealthUrl = "http://localhost:3003/health"
        StartupTime = 5
        Command = "cd worktrees/band-integration; npm run dev"
        Dependencies = @("backend-api")
    }
    "frontend-ui" = @{
        Port = 8081
        HealthUrl = "http://localhost:8081/status"
        StartupTime = 12
        Command = "cd worktrees/frontend-ui/yameyame-app; npm start"
        Dependencies = @("backend-api", "realtime-socket")
    }
}

function Test-ServiceHealth($ServiceName, $HealthUrl, $MaxRetries = 10) {
    Write-Host "🏥 Checking $ServiceName health..." -ForegroundColor Blue
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 3 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $ServiceName health check passed" -ForegroundColor Green
                return $true
            }
        } catch {
            Write-Host "⏳ $ServiceName health check attempt $i/$MaxRetries..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    
    Write-Host "❌ $ServiceName health check failed after $MaxRetries attempts" -ForegroundColor Red
    return $false
}

function Start-ServiceWithDependencies($ServiceName) {
    $config = $ServiceConfig[$ServiceName]
    
    # Check dependencies first
    foreach ($dependency in $config.Dependencies) {
        if (!(Test-ServiceHealth $dependency $ServiceConfig[$dependency].HealthUrl 3)) {
            Write-Host "❌ Dependency $dependency not ready for $ServiceName" -ForegroundColor Red
            return $false
        }
    }
    
    Write-Host "🚀 Starting $ServiceName..." -ForegroundColor Cyan
    $process = Start-Process powershell -ArgumentList "-Command", $config.Command -WindowStyle Normal -PassThru
    
    # Wait for startup time
    Start-Sleep -Seconds $config.StartupTime
    
    # Verify service is running
    $healthCheck = Test-ServiceHealth $ServiceName $config.HealthUrl
    
    if ($healthCheck) {
        Write-Host "✅ $ServiceName started successfully on port $($config.Port)" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $ServiceName failed to start properly" -ForegroundColor Red
        return $false
    }
}

function Start-AutorunEnvironment {
    Write-Host "🎯 Starting YameYame AutoRun Environment" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    
    Test-Prerequisites
    
    $serviceOrder = @("database-layer", "backend-api", "realtime-socket", "band-integration", "frontend-ui")
    $successfulServices = @()
    
    foreach ($serviceName in $serviceOrder) {
        Write-Host ""
        Write-Host "📍 Phase $($serviceOrder.IndexOf($serviceName) + 1)/$($serviceOrder.Count): $serviceName" -ForegroundColor Yellow
        
        if (Start-ServiceWithDependencies $serviceName) {
            $successfulServices += $serviceName
        } else {
            Write-Host "💥 AutoRun failed at $serviceName. Rolling back..." -ForegroundColor Red
            Stop-AutorunEnvironment
            return $false
        }
    }
    
    Write-Host ""
    Write-Host "🎉 AutoRun Environment Started Successfully!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "📍 Services Running:" -ForegroundColor White
    foreach ($service in $successfulServices) {
        $port = $ServiceConfig[$service].Port
        Write-Host "   • $service → http://localhost:$port" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "🔧 Management Commands:" -ForegroundColor Yellow
    Write-Host "   npm run dev:status    → Check service status" -ForegroundColor White
    Write-Host "   npm run dev:health    → Health check all services" -ForegroundColor White
    Write-Host "   npm run autorun:stop  → Stop all services" -ForegroundColor White
    
    return $true
}

function Stop-AutorunEnvironment {
    Write-Host "🛑 Stopping AutoRun Environment..." -ForegroundColor Red
    Write-Host "=====================================:" -ForegroundColor Red
    
    # Kill all related processes
    $processNames = @("node", "expo", "tsx", "ts-node")
    
    foreach ($processName in $processNames) {
        $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($processes) {
            Write-Host "🔄 Stopping $($processes.Count) $processName process(es)..." -ForegroundColor Yellow
            $processes | Stop-Process -Force
        }
    }
    
    Write-Host "✅ AutoRun Environment stopped" -ForegroundColor Green
}

function Show-AutorunStatus {
    Write-Host "📊 AutoRun Environment Status" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    foreach ($serviceName in $ServiceConfig.Keys) {
        $config = $ServiceConfig[$serviceName]
        Write-Host ""
        Write-Host "🔍 $serviceName (Port $($config.Port)):" -ForegroundColor Yellow
        
        $healthCheck = Test-ServiceHealth $serviceName $config.HealthUrl 1
        if ($healthCheck) {
            Write-Host "   Status: 🟢 RUNNING" -ForegroundColor Green
        } else {
            Write-Host "   Status: 🔴 STOPPED" -ForegroundColor Red
        }
        
        # Check process count
        $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*$serviceName*" }
        Write-Host "   Processes: $($processes.Count)" -ForegroundColor White
    }
    
    Write-Host ""
    Test-HealthChecks
}

# Main script logic
switch ($Action.ToLower()) {
    "autorun" { Start-AutoRun }
    "start" { Start-Development }
    "stop" { Stop-Development }
    "restart" { Stop-Development; Start-Sleep -Seconds 2; Start-Development }
    "status" { Show-Status }
    "health" { Test-HealthChecks }
    "lint" { Invoke-QualityChecks }
    "clean" { 
        Stop-Development
        Write-Host "🧹 Cleaning node_modules and caches..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force -Path "worktrees/*/node_modules" -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force -Path "node_modules" -ErrorAction SilentlyContinue
        Write-Host "✅ Clean complete" -ForegroundColor Green
    }
    default {
        Write-Host "Usage: .\dev-workflow.ps1 -Action [autorun|start|stop|restart|status|health|lint|clean]" -ForegroundColor White
    }
}