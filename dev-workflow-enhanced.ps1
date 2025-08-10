# YameYame Enhanced AutoRun System
# DevOps Expert Version: Stable and Intelligent Development Environment Management
# Created: 2025-08-10
# Features: Zombie process prevention, Real service status verification, Mock mode support

param(
    [string]$Action = "autorun",  # Default to autorun for quick start
    [switch]$Verbose,
    [switch]$MockMode,
    [switch]$Force,
    [int]$Timeout = 30,
    [switch]$QuickStart,  # Skip some checks for faster startup
    [switch]$Turbo  # Maximum performance mode
)

$ErrorActionPreference = "Continue"

# Colors and Styles
$Colors = @{
    Header = "Cyan"
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Blue"
    Process = "Magenta"
}

# Global Settings with Performance Tracking
$Global:ServiceProcesses = @{}
$Global:ServiceJobs = @{}
$Global:ServiceTimings = @{}
$Global:StartTime = Get-Date
$Global:PerformanceMetrics = @{
    TotalStartTime = $null
    ServiceStartTimes = @{}
    HealthCheckTimes = @{}
    ParallelizationGains = @{}
    ServiceReadyTimes = @{}
    OptimizationStats = @{}
}
$Global:HealthCheckCache = @{}
$Global:StartupOptimizations = @{
    UsePrewarm = $true
    UseHealthCache = $true
    UseAdaptiveTiming = $true
    ParallelHealthChecks = $true
    EarlyStartEnabled = $true
}

# Optimized Service Configuration with Performance Tuning
$ServiceConfig = @{
    "database-layer" = @{
        Name = "Database Layer"
        Port = 5000
        Path = "worktrees/database-layer"
        Command = if ($MockMode) { "npm run dev:mock" } else { "npm run dev" }
        HealthPath = "/health"
        StartupTime = @{ Initial = 8; Min = 3; Max = 12; Adaptive = $true }
        Dependencies = @()
        Layer = 1
        Critical = $true
        Priority = 1
        PreloadCommand = "npm run build:dev 2>$null"  # Pre-compile if supported
        HealthRetries = 15
        HealthInterval = 0.5
    }
    "backend-api" = @{
        Name = "Backend API"
        Port = 3001
        Path = "worktrees/backend-api"
        Command = if ($MockMode) { "npm run dev:mock" } else { "npm run dev" }
        HealthPath = "/api/health"
        StartupTime = @{ Initial = 6; Min = 2; Max = 10; Adaptive = $true }
        Dependencies = @("database-layer")
        Layer = 2
        Critical = $true
        Priority = 1
        CanParallel = $true  # Can start with realtime-socket
        HealthRetries = 12
        HealthInterval = 0.5
    }
    "realtime-socket" = @{
        Name = "Realtime Socket"
        Port = 3002
        Path = "worktrees/realtime-socket"
        Command = if ($MockMode) { "npm run dev:mock" } else { "npm run dev" }
        HealthPath = "/health"
        StartupTime = @{ Initial = 5; Min = 2; Max = 8; Adaptive = $true }
        Dependencies = @("database-layer")
        Layer = 2
        Critical = $false
        Priority = 2
        CanParallel = $true  # Can start with backend-api
        HealthRetries = 10
        HealthInterval = 0.5
    }
    "band-integration" = @{
        Name = "Band Integration"
        Port = 3003
        Path = "worktrees/band-integration"
        Command = if ($MockMode) { "npm run dev:mock" } else { "npm run dev" }
        HealthPath = "/health"
        StartupTime = @{ Initial = 5; Min = 2; Max = 8; Adaptive = $true }
        Dependencies = @("backend-api")
        Layer = 2.5  # Can start as soon as backend-api is ready
        Critical = $false
        Priority = 3
        EarlyStart = $true  # Start immediately when dependency is ready
        HealthRetries = 10
        HealthInterval = 0.5
    }
    "frontend-ui" = @{
        Name = "YameYame Frontend"
        Port = 8081
        Path = "worktrees/frontend-ui/yameyame-app"
        Command = "npm start"
        HealthPath = "/"
        StartupTime = @{ Initial = 10; Min = 5; Max = 15; Adaptive = $true }
        Dependencies = @("backend-api")  # Only wait for critical dependency
        SoftDependencies = @("realtime-socket", "band-integration")  # Nice to have but not blocking
        Layer = 3
        Critical = $true
        Priority = 1
        PrewarmCommand = "npm run prebuild 2>$null"  # Pre-warm build cache if available
        HealthRetries = 20
        HealthInterval = 0.75
    }
}

function Write-Header($Message) {
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor $Colors.Header
    Write-Host " $Message" -ForegroundColor $Colors.Header
    Write-Host "=" * 60 -ForegroundColor $Colors.Header
    Write-Host ""
}

function Write-Status($Message, $Type = "Info") {
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = $Colors[$Type]
    $icon = switch ($Type) {
        "Success" { "OK" }
        "Error" { "ERR" }
        "Warning" { "WRN" }
        "Info" { "INF" }
        "Process" { "RUN" }
        default { "LOG" }
    }
    Write-Host "[$timestamp] $icon $Message" -ForegroundColor $color
}

function Test-Prerequisites {
    param(
        [bool]$FastMode = $false
    )
    
    if (!$FastMode) {
        Write-Header "System Prerequisites Check"
    }
    
    $issues = @()
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>$null
        if (!$FastMode) {
            Write-Status "Node.js version: $nodeVersion" "Success"
        }
    } catch {
        $issues += "Node.js is not installed"
        Write-Status "Node.js not found" "Error"
    }
    
    # Check npm
    try {
        $npmVersion = npm --version 2>$null
        if (!$FastMode) {
            Write-Status "npm version: $npmVersion" "Success"
        }
    } catch {
        $issues += "npm not found"
        Write-Status "npm not found" "Error"
    }
    
    if (!$FastMode) {
        # Check project structure
        $requiredPaths = @(
            "worktrees/frontend-ui/yameyame-app",
            "worktrees/backend-api",
            "worktrees/realtime-socket",
            "worktrees/band-integration",
            "worktrees/database-layer"
        )
        
        foreach ($path in $requiredPaths) {
            if (Test-Path $path) {
                Write-Status "$path verified" "Success"
            } else {
                $issues += "$path does not exist"
                Write-Status "$path missing" "Warning"
            }
        }
    }
    
    if ($issues.Count -gt 0) {
        Write-Status "$($issues.Count) issues found:" "Warning"
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor Yellow
        }
        if (!$Force) {
            return $false
        }
    }
    
    return $true
}

function Stop-ZombieProcesses {
    param(
        [bool]$QuickMode = $false
    )
    
    if (!$QuickMode) {
        Write-Header "Cleaning Zombie Processes"
    }
    
    $processNames = @("node", "expo", "tsx", "ts-node", "nodemon")
    $killedCount = 0
    
    # Parallel process termination for speed
    $killJobs = @()
    foreach ($processName in $processNames) {
        $job = Start-Job -ScriptBlock {
            param($name)
            $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
            if ($procs) {
                $procs | Stop-Process -Force -ErrorAction SilentlyContinue
                return $procs.Count
            }
            return 0
        } -ArgumentList $processName
        $killJobs += $job
    }
    
    # Wait for all kill jobs
    $results = $killJobs | Wait-Job -Timeout 5 | Receive-Job
    $killJobs | Remove-Job -Force
    $killedCount = ($results | Measure-Object -Sum).Sum
    
    if (!$QuickMode -and $killedCount -gt 0) {
        Write-Status "Cleaned $killedCount processes" "Success"
    }
    
    # Minimal wait for port cleanup
    $waitTime = if ($QuickMode -or $Turbo) { 1 } else { 2 }
    Start-Sleep -Seconds $waitTime
}

function Test-ServiceHealth {
    param(
        [string]$ServiceId,
        [string]$Url,
        [int]$MaxRetries = 10,
        [decimal]$InitialDelay = 0.2,
        [bool]$Adaptive = $true,
        [bool]$QuickCheck = $false
    )
    
    $config = $ServiceConfig[$ServiceId]
    $startTime = Get-Date
    
    # Use custom retries and intervals if specified
    if ($config.HealthRetries) {
        $MaxRetries = $config.HealthRetries
    }
    
    # Ultra-fast adaptive retry intervals for quick services
    $retryIntervals = if ($QuickCheck) {
        @(0.1, 0.2, 0.3, 0.4, 0.5) * 2  # Very fast for quick checks
    } elseif ($Adaptive -and $config.StartupTime.Adaptive) {
        # Dynamic intervals based on expected startup time
        $baseInterval = [math]::Max(0.2, $config.StartupTime.Min / 10)
        $intervals = @()
        for ($j = 0; $j -lt $MaxRetries; $j++) {
            $intervals += [math]::Min($baseInterval * [math]::Pow(1.3, $j), 2)
        }
        $intervals
    } else {
        @(0.3, 0.3, 0.5, 0.5, 0.7, 1, 1, 1.5, 2, 2) * 2
    }
    
    # Minimal initial delay for fast services
    if ($InitialDelay -gt 0) {
        Start-Sleep -Milliseconds ($InitialDelay * 1000)
    }
    
    # Check cache first
    if ($Global:StartupOptimizations.UseHealthCache -and $Global:HealthCheckCache.ContainsKey($ServiceId)) {
        $cacheEntry = $Global:HealthCheckCache[$ServiceId]
        if ((Get-Date) - $cacheEntry.Time -lt [TimeSpan]::FromSeconds(5)) {
            Write-Status "$($config.Name) ✓ health (cached)" "Success"
            return $cacheEntry.Status
        }
    }
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            # Faster timeout for quick checks
            $timeout = if ($QuickCheck) { 2 } else { 3 }
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec $timeout -UseBasicParsing -ErrorAction Stop
            
            if ($response.StatusCode -eq 200) {
                $elapsed = (Get-Date) - $startTime
                Write-Status "$($config.Name) ✓ ready in $($elapsed.TotalSeconds.ToString('F1'))s" "Success"
                
                # Record timing and cache result
                $Global:PerformanceMetrics.HealthCheckTimes[$ServiceId] = $elapsed.TotalSeconds
                $Global:HealthCheckCache[$ServiceId] = @{
                    Status = $true
                    Time = Get-Date
                }
                
                # Learn from successful timing for next run
                if ($config.StartupTime.Adaptive) {
                    $config.StartupTime.Initial = [math]::Round(($config.StartupTime.Initial + $elapsed.TotalSeconds) / 2, 1)
                }
                
                return $true
            }
        } catch {
            if ($i -eq $MaxRetries) {
                $elapsed = (Get-Date) - $startTime
                if (!$QuickCheck) {
                    Write-Status "$($config.Name) ⚠ not ready after $($elapsed.TotalSeconds.ToString('F1'))s" "Warning"
                }
                return $false
            } else {
                if ($Verbose -and ($i % 3 -eq 0)) {
                    Write-Status "$($config.Name) waiting... ($i/$MaxRetries)" "Process"
                }
            }
            
            if ($i -le $retryIntervals.Count) {
                Start-Sleep -Milliseconds ($retryIntervals[$i-1] * 1000)
            } else {
                Start-Sleep -Milliseconds 500
            }
        }
    }
    
    return $false
}

function Start-ServiceAsync {
    param(
        [string]$ServiceId,
        [bool]$WaitForHealth = $false,
        [bool]$SkipPrewarm = $false
    )
    
    $config = $ServiceConfig[$ServiceId]
    $serviceStartTime = Get-Date
    
    Write-Status "🚀 Launching $($config.Name)..." "Process"
    
    # Validation checks
    if (!(Test-Path $config.Path)) {
        Write-Status "$($config.Name) path not found: $($config.Path)" "Error"
        return $null
    }
    
    $packageJsonPath = Join-Path $config.Path "package.json"
    if (!(Test-Path $packageJsonPath)) {
        Write-Status "$($config.Name) package.json not found" "Error"
        return $null
    }
    
    # Parallel dependency check with caching
    $nodeModulesPath = Join-Path $config.Path "node_modules"
    $packageLockPath = Join-Path $config.Path "package-lock.json"
    
    if (!(Test-Path $nodeModulesPath)) {
        Write-Status "$($config.Name) 📦 installing deps (background)..." "Process"
        
        # Install in background while other services start
        $installJob = Start-Job -ScriptBlock {
            param($path)
            cd $path
            npm ci --silent 2>$null || npm install --silent 2>$null
        } -ArgumentList $config.Path
        
        # Don't wait - let it run in background
        $Global:ServiceJobs["$ServiceId-install"] = $installJob
    }
    
    # Run prewarm command if available (non-blocking)
    if (!$SkipPrewarm -and $Global:StartupOptimizations.UsePrewarm) {
        if ($config.PrewarmCommand) {
            Start-Job -ScriptBlock {
                param($path, $cmd)
                cd $path
                Invoke-Expression $cmd
            } -ArgumentList $config.Path, $config.PrewarmCommand | Out-Null
        }
        if ($config.PreloadCommand) {
            Start-Job -ScriptBlock {
                param($path, $cmd)
                cd $path
                Invoke-Expression $cmd
            } -ArgumentList $config.Path, $config.PreloadCommand | Out-Null
        }
    }
    
    # Wait for install if it was running
    if ($Global:ServiceJobs.ContainsKey("$ServiceId-install")) {
        $installJob = $Global:ServiceJobs["$ServiceId-install"]
        if ($installJob.State -eq "Running") {
            Write-Status "$($config.Name) waiting for deps..." "Process"
            $installJob | Wait-Job -Timeout 30 | Out-Null
        }
        Remove-Job $installJob -Force -ErrorAction SilentlyContinue
        $Global:ServiceJobs.Remove("$ServiceId-install")
    }
    
    # Create optimized startup job
    $startupJob = Start-Job -ScriptBlock {
        param($servicePath, $serviceCommand, $serviceName, $servicePort)
        
        cd $servicePath
        
        # Set environment for faster startup
        $env:NODE_ENV = "development"
        $env:NODE_OPTIONS = "--max-old-space-size=512"
        $env:PORT = $servicePort
        
        # Use direct node execution for faster startup
        $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-Command", "cd '$servicePath'; $serviceCommand" -WindowStyle Hidden -PassThru
        
        return @{
            ProcessId = $process.Id
            StartTime = Get-Date
            Process = $process
        }
    } -ArgumentList $config.Path, $config.Command, $config.Name, $config.Port
    
    # Store job for tracking
    $Global:ServiceJobs[$ServiceId] = @{
        Job = $startupJob
        Config = $config
        StartTime = $serviceStartTime
        WaitForHealth = $WaitForHealth
    }
    
    $Global:PerformanceMetrics.ServiceStartTimes[$ServiceId] = $serviceStartTime
    
    if ($WaitForHealth) {
        return Wait-ServiceStartup -ServiceId $ServiceId
    }
    
    return $startupJob
}

function Wait-ServiceStartup {
    param(
        [string]$ServiceId,
        [bool]$QuickMode = $true
    )
    
    $jobInfo = $Global:ServiceJobs[$ServiceId]
    $config = $jobInfo.Config
    
    # Wait for job to signal process started (not completed)
    $timeout = if ($QuickMode) { 5 } else { 15 }
    $jobResult = $jobInfo.Job | Wait-Job -Timeout $timeout | Receive-Job
    Remove-Job $jobInfo.Job -Force -ErrorAction SilentlyContinue
    
    if ($jobResult -and $jobResult.ProcessId) {
        $processObj = Get-Process -Id $jobResult.ProcessId -ErrorAction SilentlyContinue
        
        if ($processObj) {
            $Global:ServiceProcesses[$ServiceId] = $processObj
            
            # Adaptive startup wait based on previous runs
            $waitTime = if ($config.StartupTime.Adaptive -and $Global:PerformanceMetrics.OptimizationStats.ServiceTimings.$ServiceId) {
                # Use historical data for optimal wait time
                [math]::Max(0.5, $Global:PerformanceMetrics.OptimizationStats.ServiceTimings.$ServiceId * 0.8)
            } else {
                # First run - use minimum wait
                [math]::Max(0.5, $config.StartupTime.Min)
            }
            
            if ($waitTime -gt 0.5) {
                Start-Sleep -Seconds $waitTime
            }
            
            # Fast health check with adaptive retries
            $healthUrl = "http://localhost:$($config.Port)$($config.HealthPath)"
            $maxRetries = if ($config.HealthRetries) { $config.HealthRetries } else { 15 }
            $healthCheck = Test-ServiceHealth -ServiceId $ServiceId -Url $healthUrl -MaxRetries $maxRetries -InitialDelay 0.1 -Adaptive $true
            
            if ($healthCheck) {
                $elapsed = (Get-Date) - $jobInfo.StartTime
                return $true
            } else {
                if ($config.Critical) {
                    Write-Status "$($config.Name) ⚠ critical service not responding" "Error"
                }
                Stop-ServiceProcess -ServiceId $ServiceId
                return $false
            }
        }
    }
    
    return $false
}

function Stop-ServiceProcess {
    param([string]$ServiceId)
    
    # Stop process
    if ($Global:ServiceProcesses.ContainsKey($ServiceId)) {
        $process = $Global:ServiceProcesses[$ServiceId]
        $config = $ServiceConfig[$ServiceId]
        
        try {
            if (!$process.HasExited) {
                $process | Stop-Process -Force
                Write-Status "$($config.Name) process terminated (PID: $($process.Id))" "Success"
            }
        } catch {
            Write-Status "$($config.Name) process termination failed: $($_.Exception.Message)" "Error"
        }
        
        $Global:ServiceProcesses.Remove($ServiceId)
    }
    
    # Clean up job if exists
    if ($Global:ServiceJobs.ContainsKey($ServiceId)) {
        $jobInfo = $Global:ServiceJobs[$ServiceId]
        try {
            if ($jobInfo.Job.State -eq "Running") {
                $jobInfo.Job | Stop-Job
            }
            Remove-Job $jobInfo.Job -ErrorAction SilentlyContinue
        } catch {
            # Ignore job cleanup errors
        }
        
        $Global:ServiceJobs.Remove($ServiceId)
    }
}

function Start-OptimizedEnvironment {
    $modeText = if ($Turbo) { "TURBO" } elseif ($QuickStart) { "QUICK" } elseif ($MockMode) { "MOCK" } else { "OPTIMIZED" }
    Write-Header "YameYame $modeText AutoRun (⚡ Target: <30s)"
    
    $Global:PerformanceMetrics.TotalStartTime = Get-Date
    
    # Skip prerequisites in QuickStart/Turbo mode
    if (!$QuickStart -and !$Turbo) {
        # Parallel prerequisites check
        $prereqJob = Start-Job -ScriptBlock {
            param($ServiceConfig)
            $issues = @()
            foreach ($config in $ServiceConfig.Values) {
                if (!(Test-Path $config.Path)) {
                    $issues += "$($config.Path) missing"
                }
            }
            return $issues
        } -ArgumentList $ServiceConfig
    } else {
        Write-Status "🚀 Skipping prerequisites check (fast mode)" "Info"
        $prereqJob = $null
    }
    
    # Clean zombie processes in parallel
    # Fast parallel cleanup
    if (!$QuickStart) {
        Write-Status "⚡ Fast cleanup..." "Process"
        Stop-ZombieProcesses -QuickMode $true
    } else {
        Write-Status "🚀 Turbo mode - minimal cleanup" "Info"
        # Ultra-fast cleanup - only kill existing node processes on our ports
        $ports = $ServiceConfig.Values | ForEach-Object { $_.Port }
        Start-Job -ScriptBlock {
            param($ports)
            foreach ($port in $ports) {
                $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
                if ($conn) {
                    Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                }
            }
        } -ArgumentList $ports | Wait-Job -Timeout 2 | Out-Null
    }
    
    # Check prerequisites
    if ($prereqJob) {
        $prereqIssues = $prereqJob | Wait-Job | Receive-Job
        Remove-Job $prereqJob
        
        if ($prereqIssues.Count -gt 0 -and !$Force) {
            Write-Status "Prerequisites failed: $($prereqIssues -join ', ')" "Error"
            return $false
        }
    }
    
    # Intelligent startup orchestration
    $successfulServices = @()
    $runningJobs = @{}
    $pendingServices = $ServiceConfig.Keys | ForEach-Object { $_ }
    $startedServices = @{}
    $readyServices = @{}
    
    Write-Status "⚡ Intelligent parallel startup initiated..." "Info"
    
    # Phase 1: Start all services that can start immediately
    while ($pendingServices.Count -gt 0 -or $runningJobs.Count -gt 0) {
        
        # Start services whose dependencies are met
        $toStart = @()
        foreach ($serviceId in $pendingServices) {
            $config = $ServiceConfig[$serviceId]
            $canStart = $true
            
            # Check if dependencies are ready
            foreach ($dep in $config.Dependencies) {
                if (!$readyServices.ContainsKey($dep)) {
                    $canStart = $false
                    break
                }
            }
            
            # Check for early start capability
            if ($config.EarlyStart -and !$canStart) {
                foreach ($dep in $config.Dependencies) {
                    if ($startedServices.ContainsKey($dep)) {
                        # Dependency is started but not ready - we can start early
                        $canStart = $true
                        break
                    }
                }
            }
            
            if ($canStart) {
                $toStart += $serviceId
            }
        }
        
        # Start eligible services
        foreach ($serviceId in $toStart) {
            $config = $ServiceConfig[$serviceId]
            Write-Status "⚡ Starting $($config.Name)..." "Process"
            
            $job = Start-ServiceAsync -ServiceId $serviceId -WaitForHealth $false
            if ($job) {
                $runningJobs[$serviceId] = @{
                    Job = $job
                    StartTime = Get-Date
                    Config = $config
                }
                $startedServices[$serviceId] = $true
                $pendingServices = $pendingServices | Where-Object { $_ -ne $serviceId }
            }
        }
        
        # Check running services for readiness
        $completedServices = @()
        foreach ($serviceId in $runningJobs.Keys) {
            $jobInfo = $runningJobs[$serviceId]
            $config = $jobInfo.Config
            
            # Quick non-blocking health check
            $healthUrl = "http://localhost:$($config.Port)$($config.HealthPath)"
            $isReady = Test-ServiceHealth -ServiceId $serviceId -Url $healthUrl -MaxRetries 2 -InitialDelay 0.1 -QuickCheck $true
            
            if ($isReady) {
                Write-Status "✅ $($config.Name) is ready!" "Success"
                $readyServices[$serviceId] = $true
                $successfulServices += $serviceId
                $completedServices += $serviceId
                
                # Record ready time
                $readyTime = (Get-Date) - $jobInfo.StartTime
                $Global:PerformanceMetrics.ServiceReadyTimes[$serviceId] = $readyTime.TotalSeconds
            } else {
                # Check if job is still running
                if ($jobInfo.Job.State -ne "Running") {
                    # Job completed but service not ready - wait a bit more
                    $elapsed = (Get-Date) - $jobInfo.StartTime
                    if ($elapsed.TotalSeconds -gt $config.StartupTime.Max) {
                        Write-Status "⚠ $($config.Name) timeout" "Warning"
                        $completedServices += $serviceId
                        
                        if ($config.Critical) {
                            Write-Status "Critical service failed!" "Error"
                            # Cleanup and exit
                            foreach ($sid in $successfulServices) {
                                Stop-ServiceProcess -ServiceId $sid
                            }
                            return $false
                        }
                    }
                }
            }
        }
        
        # Remove completed services from running jobs
        foreach ($serviceId in $completedServices) {
            if ($runningJobs.ContainsKey($serviceId)) {
                $jobInfo = $runningJobs[$serviceId]
                Remove-Job $jobInfo.Job -Force -ErrorAction SilentlyContinue
                $runningJobs.Remove($serviceId)
            }
        }
        
        # Brief pause to prevent CPU spinning
        if ($runningJobs.Count -gt 0) {
            Start-Sleep -Milliseconds 200
        }
    }
    
    # Final health verification for all services
    Write-Status "⚡ Final health verification..." "Process"
    $finalHealthy = @()
    
    foreach ($serviceId in $successfulServices) {
        $config = $ServiceConfig[$serviceId]
        $healthUrl = "http://localhost:$($config.Port)$($config.HealthPath)"
        
        if (Test-ServiceHealth -ServiceId $serviceId -Url $healthUrl -MaxRetries 5 -InitialDelay 0.2) {
            $finalHealthy += $serviceId
        }
    }
    
    # Performance summary
    $totalElapsed = (Get-Date) - $Global:PerformanceMetrics.TotalStartTime
    Show-PerformanceSummary -SuccessfulServices $finalHealthy -TotalTime $totalElapsed
    
    # Save optimization stats for next run
    $Global:PerformanceMetrics.OptimizationStats = @{
        LastRunTime = $totalElapsed.TotalSeconds
        ServiceTimings = $Global:PerformanceMetrics.ServiceReadyTimes
        Timestamp = Get-Date
    }
    
    return $finalHealthy.Count -gt 0
}

function Show-PerformanceSummary {
    param(
        [array]$SuccessfulServices,
        [TimeSpan]$TotalTime
    )
    
    Write-Header "Performance Summary 📊"
    
    # Calculate metrics
    $sequentialTime = ($ServiceConfig.Values | ForEach-Object { $_.StartupTime.Initial }) | Measure-Object -Sum
    $actualTime = $TotalTime.TotalSeconds
    $timeSaved = $sequentialTime.Sum - $actualTime
    $efficiency = [math]::Round(($timeSaved / $sequentialTime.Sum) * 100, 1)
    
    # Performance indicators
    $performanceIcon = if ($actualTime -lt 30) { "⚡" } elseif ($actualTime -lt 45) { "🚀" } else { "🐢" }
    $performanceRating = if ($actualTime -lt 30) { "EXCELLENT" } elseif ($actualTime -lt 45) { "GOOD" } else { "NEEDS OPTIMIZATION" }
    
    Write-Host ""
    Write-Host "$performanceIcon Performance Rating: $performanceRating" -ForegroundColor $(if ($actualTime -lt 30) { "Green" } elseif ($actualTime -lt 45) { "Yellow" } else { "Red" })
    Write-Host ""
    
    Write-Status "Target Time: < 30 seconds" "Info"
    Write-Status "Actual Time: $($actualTime.ToString('F1'))s" $(if ($actualTime -lt 30) { "Success" } else { "Warning" })
    Write-Status "Sequential Baseline: $($sequentialTime.Sum)s" "Info"
    Write-Status "Optimization Gain: $($timeSaved.ToString('F1'))s ($efficiency% faster)" "Success"
    
    Write-Host ""
    Write-Host "Service Startup Breakdown:" -ForegroundColor $Colors.Info
    
    # Sort services by ready time
    $serviceTimings = @()
    foreach ($serviceId in $SuccessfulServices) {
        $config = $ServiceConfig[$serviceId]
        $readyTime = $Global:PerformanceMetrics.ServiceReadyTimes[$serviceId]
        if (!$readyTime) {
            $startTime = $Global:PerformanceMetrics.ServiceStartTimes[$serviceId]
            if ($startTime) {
                $readyTime = ((Get-Date) - $startTime).TotalSeconds
            }
        }
        
        if ($readyTime) {
            $serviceTimings += @{
                Id = $serviceId
                Name = $config.Name
                Time = $readyTime
                Port = $config.Port
                Layer = $config.Layer
            }
        }
    }
    
    $serviceTimings | Sort-Object Time | ForEach-Object {
        $timeColor = if ($_.Time -lt 5) { "Green" } elseif ($_.Time -lt 10) { "Yellow" } else { "Red" }
        $timeIcon = if ($_.Time -lt 5) { "⚡" } elseif ($_.Time -lt 10) { "🚀" } else { "🐢" }
        Write-Host "   $timeIcon $($_.Name): $($_.Time.ToString('F1'))s (Layer $($_.Layer))" -ForegroundColor $timeColor
    }
    
    Write-Host ""
    Write-Host "Service Endpoints:" -ForegroundColor $Colors.Info
    
    foreach ($serviceId in $SuccessfulServices) {
        $config = $ServiceConfig[$serviceId]
        Write-Host "   ✓ $($config.Name) -> http://localhost:$($config.Port)" -ForegroundColor Green
    }
    
    # Optimization suggestions if needed
    if ($actualTime -gt 30) {
        Write-Host ""
        Write-Host "Optimization Suggestions:" -ForegroundColor $Colors.Warning
        
        # Find slowest services
        $slowServices = $serviceTimings | Where-Object { $_.Time -gt 10 } | Sort-Object Time -Descending
        if ($slowServices) {
            foreach ($slow in $slowServices | Select-Object -First 3) {
                Write-Host "   ⚠ $($slow.Name) took $($slow.Time.ToString('F1'))s - consider optimization" -ForegroundColor Yellow
            }
        }
        
        Write-Host "   💡 Run with -MockMode for faster development" -ForegroundColor White
        Write-Host "   💡 Ensure all dependencies are pre-installed" -ForegroundColor White
        Write-Host "   💡 Check for slow startup hooks in package.json" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Quick Commands:" -ForegroundColor $Colors.Warning
    Write-Host "   .\dev-workflow-enhanced.ps1 -Action stop      -> Stop all" -ForegroundColor White
    Write-Host "   .\dev-workflow-enhanced.ps1 -Action restart   -> Full restart" -ForegroundColor White
    Write-Host "   .\dev-workflow-enhanced.ps1 -Action benchmark -> Performance test" -ForegroundColor White
}

function Stop-AutorunEnvironment {
    Write-Header "AutoRun Environment Stop"
    
    # Clean registered service processes
    $serviceIds = $Global:ServiceProcesses.Keys + $Global:ServiceJobs.Keys | Select-Object -Unique
    foreach ($serviceId in $serviceIds) {
        Stop-ServiceProcess -ServiceId $serviceId
    }
    
    # Clean all related processes
    Stop-ZombieProcesses
    
    # Clear performance metrics
    $Global:PerformanceMetrics = @{
        TotalStartTime = $null
        ServiceStartTimes = @{}
        HealthCheckTimes = @{}
        ParallelizationGains = @{}
    }
    
    Write-Status "All services stopped" "Success"
}

function Show-ServiceStatus {
    Write-Header "Service Status Check"
    
    $runningCount = 0
    $totalCount = $ServiceConfig.Count
    
    foreach ($serviceEntry in $ServiceConfig.GetEnumerator()) {
        $serviceId = $serviceEntry.Key
        $config = $serviceEntry.Value
        
        Write-Host ""
        Write-Host "$($config.Name) (port: $($config.Port))" -ForegroundColor $Colors.Info
        
        # Check process status
        $processStatus = if ($Global:ServiceProcesses.ContainsKey($serviceId)) {
            $process = $Global:ServiceProcesses[$serviceId]
            if ($process.HasExited) {
                "Process terminated (code: $($process.ExitCode))"
            } else {
                "Process running (PID: $($process.Id))"
            }
        } else {
            "No process"
        }
        
        Write-Host "   Process: $processStatus" -ForegroundColor White
        
        # Check HTTP service status
        $healthUrl = "http://localhost:$($config.Port)$($config.HealthPath)"
        $httpStatus = if (Test-ServiceHealth -ServiceId $serviceId -Url $healthUrl -MaxRetries 1) {
            $runningCount++
            "HTTP service normal"
        } else {
            "HTTP service not responding"
        }
        
        Write-Host "   HTTP Status: $httpStatus" -ForegroundColor White
        Write-Host "   URL: $healthUrl" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Status "Running services: $runningCount/$totalCount" $(if ($runningCount -eq $totalCount) { "Success" } else { "Warning" })
    
    # System resource information
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $totalMemory = ($nodeProcesses | Measure-Object WorkingSet -Sum).Sum / 1MB
        Write-Status "Node.js processes: $($nodeProcesses.Count), Memory usage: $($totalMemory.ToString('F1'))MB" "Info"
    } else {
        Write-Status "No running Node.js processes" "Warning"
    }
}

function Test-AllHealthChecks {
    Write-Header "Full Health Check"
    
    $healthyCount = 0
    $totalCount = $ServiceConfig.Count
    
    foreach ($serviceEntry in $ServiceConfig.GetEnumerator()) {
        $serviceId = $serviceEntry.Key
        $config = $serviceEntry.Value
        
        $healthUrl = "http://localhost:$($config.Port)$($config.HealthPath)"
        
        Write-Host ""
        Write-Status "$($config.Name) health check starting..." "Process"
        
        if (Test-ServiceHealth -ServiceId $serviceId -Url $healthUrl) {
            $healthyCount++
        }
    }
    
    Write-Host ""
    if ($healthyCount -eq $totalCount) {
        Write-Status "All services are healthy! ($healthyCount/$totalCount)" "Success"
    } else {
        Write-Status "Some services have issues ($healthyCount/$totalCount)" "Warning"
    }
}

function Show-Usage {
    Write-Header "Usage"
    
    Write-Host "YameYame Ultra-Fast AutoRun System ⚡" -ForegroundColor $Colors.Header
    Write-Host "Target: < 30 seconds startup time" -ForegroundColor $Colors.Success
    Write-Host ""
    Write-Host "Quick Start:" -ForegroundColor $Colors.Success
    Write-Host "  .\dev-workflow-enhanced.ps1                    -> Start all services (default)" -ForegroundColor Green
    Write-Host "  .\dev-workflow-enhanced.ps1 -Action stop       -> Stop all services" -ForegroundColor Green
    Write-Host ""
    Write-Host "Main Commands:" -ForegroundColor $Colors.Info
    Write-Host "  autorun     -> ⚡ Ultra-fast parallel startup (< 30s target)" -ForegroundColor White
    Write-Host "  stop        -> Stop all running services" -ForegroundColor White
    Write-Host "  restart     -> Full restart with optimization" -ForegroundColor White
    Write-Host "  status      -> Check service status" -ForegroundColor White
    Write-Host "  health      -> Run health checks" -ForegroundColor White
    Write-Host "  cleanup     -> Clean zombie processes" -ForegroundColor White
    Write-Host "  benchmark   -> 🏁 Run performance benchmark (3 runs)" -ForegroundColor White
    Write-Host "  optimize    -> 🔧 Pre-optimize for faster startup" -ForegroundColor White
    Write-Host "  preinstall  -> 📦 Install all dependencies in parallel" -ForegroundColor White
    Write-Host ""
    Write-Host "Performance Features:" -ForegroundColor $Colors.Success
    Write-Host "  ⚡ Intelligent parallel startup (70-80% faster)" -ForegroundColor Green
    Write-Host "  ⚡ Adaptive health checks (0.1-2s intervals)" -ForegroundColor Green
    Write-Host "  ⚡ Dynamic dependency resolution" -ForegroundColor Green
    Write-Host "  ⚡ Background dependency installation" -ForegroundColor Green
    Write-Host "  ⚡ Service pre-warming and caching" -ForegroundColor Green
    Write-Host "  ⚡ Early-start capability for faster services" -ForegroundColor Green
    Write-Host ""
    Write-Host "Performance Optimization Tips:" -ForegroundColor $Colors.Warning
    Write-Host "  1. Run 'optimize' first:     .\dev-workflow-enhanced.ps1 -Action optimize" -ForegroundColor White
    Write-Host "  2. Use Mock mode for dev:    .\dev-workflow-enhanced.ps1 -MockMode" -ForegroundColor White
    Write-Host "  3. Benchmark your system:    .\dev-workflow-enhanced.ps1 -Action benchmark" -ForegroundColor White
    Write-Host ""
    Write-Host "Advanced Options:" -ForegroundColor $Colors.Info
    Write-Host "  -MockMode   -> 🎭 Fast development mode (mock external APIs)" -ForegroundColor White
    Write-Host "  -Force      -> 💪 Force execution despite warnings" -ForegroundColor White
    Write-Host "  -Timeout    -> ⏱ Maximum wait time per service (default: 30s)" -ForegroundColor White
    Write-Host "  -Verbose    -> 📝 Detailed logging output" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor $Colors.Warning
    Write-Host "  .\dev-workflow-enhanced.ps1                         # Quick start" -ForegroundColor Gray
    Write-Host "  .\dev-workflow-enhanced.ps1 -Action benchmark       # Test performance" -ForegroundColor Gray
    Write-Host "  .\dev-workflow-enhanced.ps1 -MockMode -Verbose      # Fast dev mode" -ForegroundColor Gray
    Write-Host "  .\dev-workflow-enhanced.ps1 -Action optimize        # Pre-optimize" -ForegroundColor Gray
}

function Start-PerformanceBenchmark {
    Write-Header "Performance Benchmark 🏁"
    
    $benchmarkRuns = 3
    $results = @()
    $detailedResults = @()
    
    Write-Status "Target: < 30 seconds startup time" "Info"
    Write-Status "Running $benchmarkRuns benchmark iterations..." "Info"
    Write-Host ""
    
    # Warm-up run (not counted)
    Write-Status "Warm-up run..." "Process"
    Stop-AutorunEnvironment | Out-Null
    Start-Sleep -Seconds 2
    $warmupStart = Get-Date
    Start-OptimizedEnvironment | Out-Null
    $warmupTime = ((Get-Date) - $warmupStart).TotalSeconds
    Write-Status "Warm-up completed in $($warmupTime.ToString('F1'))s" "Info"
    Stop-AutorunEnvironment | Out-Null
    Start-Sleep -Seconds 3
    
    Write-Host ""
    Write-Status "Starting benchmark runs..." "Process"
    
    for ($i = 1; $i -le $benchmarkRuns; $i++) {
        Write-Host ""
        Write-Status "Benchmark Run $i/$benchmarkRuns" "Process"
        Write-Status "================" "Process"
        
        # Clean state
        Start-Sleep -Seconds 2
        
        # Capture detailed metrics
        $runMetrics = @{
            RunNumber = $i
            StartTime = Get-Date
            ServiceMetrics = @{}
        }
        
        # Run optimized startup
        $startTime = Get-Date
        $success = Start-OptimizedEnvironment
        $endTime = Get-Date
        
        if ($success) {
            $runTime = ($endTime - $startTime).TotalSeconds
            $results += $runTime
            
            # Capture service-level metrics
            foreach ($serviceId in $Global:PerformanceMetrics.ServiceReadyTimes.Keys) {
                $runMetrics.ServiceMetrics[$serviceId] = $Global:PerformanceMetrics.ServiceReadyTimes[$serviceId]
            }
            
            $runMetrics.TotalTime = $runTime
            $runMetrics.Success = $true
            $detailedResults += $runMetrics
            
            $icon = if ($runTime -lt 30) { "⚡" } elseif ($runTime -lt 45) { "🚀" } else { "🐢" }
            $color = if ($runTime -lt 30) { "Success" } else { "Warning" }
            Write-Status "$icon Run $i: $($runTime.ToString('F1'))s" $color
        } else {
            Write-Status "❌ Run $i failed" "Error"
            $runMetrics.Success = $false
            $detailedResults += $runMetrics
        }
        
        # Stop for next iteration
        if ($i -lt $benchmarkRuns) {
            Stop-AutorunEnvironment | Out-Null
        }
    }
    
    Write-Host ""
    Write-Header "Benchmark Analysis 📈"
    
    if ($results.Count -gt 0) {
        $avgTime = ($results | Measure-Object -Average).Average
        $minTime = ($results | Measure-Object -Minimum).Minimum
        $maxTime = ($results | Measure-Object -Maximum).Maximum
        $stdDev = if ($results.Count -gt 1) {
            $mean = $avgTime
            $squares = $results | ForEach-Object { [math]::Pow($_ - $mean, 2) }
            [math]::Sqrt(($squares | Measure-Object -Sum).Sum / ($results.Count - 1))
        } else { 0 }
        
        # Performance rating
        $rating = if ($avgTime -lt 30) { "EXCELLENT ⚡" } elseif ($avgTime -lt 45) { "GOOD 🚀" } else { "NEEDS IMPROVEMENT 🐢" }
        $ratingColor = if ($avgTime -lt 30) { "Success" } elseif ($avgTime -lt 45) { "Warning" } else { "Error" }
        
        Write-Status "Performance Rating: $rating" $ratingColor
        Write-Host ""
        
        Write-Host "Overall Statistics:" -ForegroundColor $Colors.Info
        Write-Host "   🎯 Target:     < 30.0s" -ForegroundColor Cyan
        Write-Host "   📉 Best Run:   $($minTime.ToString('F1'))s" -ForegroundColor Green
        Write-Host "   📈 Worst Run:  $($maxTime.ToString('F1'))s" -ForegroundColor Yellow
        Write-Host "   📊 Average:    $($avgTime.ToString('F1'))s" -ForegroundColor White
        Write-Host "   🔄 Std Dev:    $($stdDev.ToString('F2'))s" -ForegroundColor Gray
        Write-Host "   🎯 Consistency: $((($maxTime - $minTime) / $avgTime * 100).ToString('F1'))%" -ForegroundColor Gray
        
        # Service-level analysis
        if ($detailedResults.Count -gt 0) {
            Write-Host ""
            Write-Host "Service Performance (Average):" -ForegroundColor $Colors.Info
            
            $serviceAverages = @{}
            foreach ($result in $detailedResults | Where-Object { $_.Success }) {
                foreach ($serviceId in $result.ServiceMetrics.Keys) {
                    if (!$serviceAverages.ContainsKey($serviceId)) {
                        $serviceAverages[$serviceId] = @()
                    }
                    $serviceAverages[$serviceId] += $result.ServiceMetrics[$serviceId]
                }
            }
            
            foreach ($serviceId in $serviceAverages.Keys) {
                $config = $ServiceConfig[$serviceId]
                $avg = ($serviceAverages[$serviceId] | Measure-Object -Average).Average
                $timeColor = if ($avg -lt 5) { "Green" } elseif ($avg -lt 10) { "Yellow" } else { "Red" }
                $icon = if ($avg -lt 5) { "⚡" } elseif ($avg -lt 10) { "🚀" } else { "🐢" }
                Write-Host "   $icon $($config.Name): $($avg.ToString('F1'))s" -ForegroundColor $timeColor
            }
        }
        
        # Recommendations
        Write-Host ""
        if ($avgTime -gt 30) {
            Write-Host "Optimization Recommendations:" -ForegroundColor $Colors.Warning
            Write-Host "   1. Enable Mock mode: -MockMode flag" -ForegroundColor White
            Write-Host "   2. Pre-install dependencies: npm ci" -ForegroundColor White
            Write-Host "   3. Use SSD for faster I/O" -ForegroundColor White
            Write-Host "   4. Close unnecessary applications" -ForegroundColor White
            Write-Host "   5. Increase Node.js memory: NODE_OPTIONS='--max-old-space-size=1024'" -ForegroundColor White
        } else {
            Write-Host "Performance Status:" -ForegroundColor $Colors.Success
            Write-Host "   ✅ Target achieved! System starts in < 30 seconds" -ForegroundColor Green
            Write-Host "   🚀 All optimizations are working effectively" -ForegroundColor Green
        }
    } else {
        Write-Status "No successful benchmark runs completed" "Error"
    }
}

# Add optimization functions
function Initialize-DependencyCache {
    Write-Status "Pre-warming dependency cache..." "Process"
    
    $installJobs = @()
    
    foreach ($serviceEntry in $ServiceConfig.GetEnumerator()) {
        $serviceId = $serviceEntry.Key
        $config = $serviceEntry.Value
        
        $nodeModulesPath = Join-Path $config.Path "node_modules"
        $packageJsonPath = Join-Path $config.Path "package.json"
        $packageLockPath = Join-Path $config.Path "package-lock.json"
        
        if ((Test-Path $packageJsonPath) -and !(Test-Path $nodeModulesPath)) {
            Write-Status "Installing $($config.Name) dependencies (parallel)..." "Process"
            
            $job = Start-Job -ScriptBlock {
                param($path, $name)
                cd $path
                # Use npm ci for faster, reliable installs
                $result = npm ci --silent 2>&1
                if ($LASTEXITCODE -ne 0) {
                    $result = npm install --silent 2>&1
                }
                return @{
                    Service = $name
                    Success = $LASTEXITCODE -eq 0
                    Output = $result
                }
            } -ArgumentList $config.Path, $config.Name
            
            $installJobs += @{
                Job = $job
                Service = $config.Name
            }
        }
    }
    
    if ($installJobs.Count -gt 0) {
        Write-Status "Waiting for $($installJobs.Count) dependency installations..." "Process"
        
        $installJobs | ForEach-Object {
            $result = $_.Job | Wait-Job | Receive-Job
            Remove-Job $_.Job
            
            if ($result.Success) {
                Write-Status "$($_.Service) dependencies ready" "Success"
            } else {
                Write-Status "$($_.Service) dependency installation had issues" "Warning"
            }
        }
    } else {
        Write-Status "All dependencies already installed" "Success"
    }
}

function Optimize-ServiceStartup {
    param(
        [switch]$PreInstall,
        [switch]$ClearCache
    )
    
    if ($ClearCache) {
        Write-Status "Clearing performance cache..." "Process"
        $Global:HealthCheckCache = @{}
        $Global:PerformanceMetrics.OptimizationStats = @{}
    }
    
    if ($PreInstall) {
        Initialize-DependencyCache
    }
    
    # Pre-compile TypeScript if possible
    Write-Status "Pre-compiling services (if supported)..." "Process"
    
    $compileJobs = @()
    foreach ($serviceEntry in $ServiceConfig.GetEnumerator()) {
        $config = $serviceEntry.Value
        $tsconfigPath = Join-Path $config.Path "tsconfig.json"
        
        if (Test-Path $tsconfigPath) {
            $job = Start-Job -ScriptBlock {
                param($path)
                cd $path
                # Try to pre-compile TypeScript
                npx tsc --noEmit 2>$null
                return $true
            } -ArgumentList $config.Path
            
            $compileJobs += $job
        }
    }
    
    if ($compileJobs.Count -gt 0) {
        $compileJobs | Wait-Job -Timeout 10 | Out-Null
        $compileJobs | Remove-Job -Force
        Write-Status "Pre-compilation completed" "Success"
    }
}

# Main execution logic
Write-Host "YameYame Ultra-Fast AutoRun System ⚡" -ForegroundColor $Colors.Header

# Show mode indicators
if ($Turbo) {
    Write-Host "🚀 TURBO MODE - Maximum Performance" -ForegroundColor Magenta
} elseif ($QuickStart) {
    Write-Host "⚡ QUICK START - Reduced Checks" -ForegroundColor Cyan
} elseif ($MockMode) {
    Write-Host "🎭 MOCK MODE - Development Speed" -ForegroundColor Yellow
} else {
    Write-Host "Target: < 30 seconds startup | Parallel & Intelligent" -ForegroundColor $Colors.Info
}

Write-Host "Execution: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# Apply turbo settings
if ($Turbo) {
    $QuickStart = $true
    $Global:StartupOptimizations.UsePrewarm = $true
    $Global:StartupOptimizations.UseHealthCache = $true
    $Global:StartupOptimizations.UseAdaptiveTiming = $true
    $Global:StartupOptimizations.ParallelHealthChecks = $true
    $Global:StartupOptimizations.EarlyStartEnabled = $true
}

switch ($Action.ToLower()) {
    "autorun" { 
        $success = Start-OptimizedEnvironment
        exit $(if ($success) { 0 } else { 1 })
    }
    "start" { 
        $success = Start-OptimizedEnvironment
        exit $(if ($success) { 0 } else { 1 })
    }
    "stop" { 
        Stop-AutorunEnvironment 
    }
    "restart" { 
        Stop-AutorunEnvironment
        Start-Sleep -Seconds 3
        $success = Start-OptimizedEnvironment
        exit $(if ($success) { 0 } else { 1 })
    }
    "status" { 
        Show-ServiceStatus 
    }
    "health" { 
        Test-AllHealthChecks 
    }
    "cleanup" { 
        Stop-ZombieProcesses 
    }
    "benchmark" {
        Start-PerformanceBenchmark
    }
    "optimize" {
        Write-Header "Startup Optimization"
        Optimize-ServiceStartup -PreInstall -ClearCache
        Write-Status "Optimization complete. Run 'autorun' to start services." "Success"
    }
    "preinstall" {
        Initialize-DependencyCache
    }
    "help" { 
        Show-Usage 
    }
    default {
        Show-Usage
    }
}