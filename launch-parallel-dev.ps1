# YameYame Parallel Development Launcher
# Launches Claude Squad with multiple development tasks

param(
    [string]$Phase = "1"  # Development phase (1-4)
)

Write-Host "`n🚀 YameYame Parallel Development Launcher" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Cyan

# Phase 1: Foundation Tasks
$phase1Tasks = @(
    @{
        Name = "Frontend Setup"
        Branch = "frontend-ui"
        Prompt = "Setup React Native Expo project with React Native Paper UI library. Create basic navigation structure with 4 main screens: Home, Board, Gallery, and Chat. Use React Navigation 6 with bottom tab navigation. Initialize Context API for auth, socket, and game state management."
    },
    @{
        Name = "Backend API"
        Branch = "backend-api"
        Prompt = "Initialize Express.js server with MongoDB connection using Mongoose. Setup JWT authentication middleware with refresh tokens. Create basic API structure with routes for /api/auth, /api/members, /api/posts, /api/games, /api/chat. Implement error handling middleware and request validation with Joi."
    },
    @{
        Name = "Band OAuth"
        Branch = "band-integration"
        Prompt = "Implement Naver Band OAuth 2.0 authentication flow. Create Band API integration service for group 61541241. Setup JWT token generation and validation. Implement member synchronization with Band API including profile data and membership status."
    },
    @{
        Name = "Database Schema"
        Branch = "database-layer"
        Prompt = "Design and implement MongoDB schemas for: Club (club info), Member (user profiles with Band integration), Post (board posts with comments), Game (game sessions), ChatRoom, Message, and BandSync collections. Include proper indexes and relationships."
    }
)

# Phase 2: Core Features
$phase2Tasks = @(
    @{
        Name = "Home Screen"
        Branch = "frontend-ui"
        Prompt = "Build Home screen with: 1) Club logo and introduction card, 2) Latest announcements section (top 3), 3) Live game status indicator, 4) Complete member list supporting up to 200 members with search and filter. Use React Native Paper components with Material Design."
    },
    @{
        Name = "Board System"
        Branch = "frontend-ui"
        Prompt = "Implement board system with: 1) Post creation with rich text editor, 2) Post list with pinned announcements, 3) Comment threading system, 4) Edit/delete functionality with permissions. Include offline support with SQLite."
    },
    @{
        Name = "Chat System"
        Branch = "realtime-socket"
        Prompt = "Build real-time chat system using Socket.io: 1) Global chat room for all members, 2) Private 1:1 messaging, 3) Whisper functionality, 4) Message history with pagination, 5) Online status indicators. Implement Redis for message caching."
    },
    @{
        Name = "Game Board"
        Branch = "frontend-ui"
        Prompt = "Develop game board with: 1) Live game tracking with real-time scores, 2) Game scheduling calendar, 3) Participant management (join/leave), 4) ELO-based team balancing, 5) Game results recording. Create gym-optimized UI with large touch targets."
    }
)

# Phase 3: Advanced Features
$phase3Tasks = @(
    @{
        Name = "Photo Gallery"
        Branch = "frontend-ui"
        Prompt = "Create photo gallery with Band photo synchronization. Implement lazy loading, image caching, and pinch-to-zoom. Support bulk upload and album organization. Include offline viewing capability."
    },
    @{
        Name = "Socket.io Server"
        Branch = "realtime-socket"
        Prompt = "Setup Socket.io server with: 1) Room management for chat and games, 2) Redis adapter for scaling, 3) Connection recovery, 4) Event logging, 5) Rate limiting. Implement heartbeat and reconnection logic."
    },
    @{
        Name = "Offline Sync"
        Branch = "database-layer"
        Prompt = "Implement offline synchronization: 1) SQLite for local storage, 2) Sync queue for pending operations, 3) Conflict resolution strategy, 4) Background sync with Expo BackgroundFetch, 5) Data compression for efficiency."
    },
    @{
        Name = "Testing Suite"
        Branch = "testing-suite"
        Prompt = "Write comprehensive tests: 1) Jest unit tests for components and utilities (90% coverage), 2) React Native Testing Library for component testing, 3) Supertest for API endpoints, 4) Detox E2E tests for critical user flows."
    }
)

# Phase 4: Production
$phase4Tasks = @(
    @{
        Name = "Performance"
        Branch = "frontend-ui"
        Prompt = "Optimize app performance: 1) Reduce launch time to <3 seconds, 2) Implement code splitting and lazy loading, 3) Optimize images and assets, 4) Memory usage <150MB, 5) Battery optimization with background task management."
    },
    @{
        Name = "Security"
        Branch = "infrastructure"
        Prompt = "Implement security hardening: 1) OWASP compliance checks, 2) API rate limiting with Redis, 3) Data encryption (AES-256), 4) Secure token storage with Expo SecureStore, 5) Input validation and sanitization."
    },
    @{
        Name = "AWS Deploy"
        Branch = "infrastructure"
        Prompt = "Setup AWS deployment: 1) ECS Fargate with auto-scaling, 2) Application Load Balancer, 3) CloudFront CDN for static assets, 4) RDS for MongoDB Atlas, 5) CloudWatch monitoring with alarms."
    },
    @{
        Name = "App Store"
        Branch = "frontend-ui"
        Prompt = "Prepare for app store: 1) EAS Build configuration, 2) App store metadata and descriptions, 3) Screenshots and preview videos, 4) Privacy policy and terms, 5) Beta testing with TestFlight/Play Console."
    }
)

# Select tasks based on phase
$tasks = switch ($Phase) {
    "1" { $phase1Tasks }
    "2" { $phase2Tasks }
    "3" { $phase3Tasks }
    "4" { $phase4Tasks }
    default { $phase1Tasks }
}

Write-Host "`n📋 Phase $Phase Tasks:" -ForegroundColor Yellow
foreach ($task in $tasks) {
    Write-Host "  - $($task.Name) [$($task.Branch)]" -ForegroundColor White
}

# Create task files for each worktree
Write-Host "`n📝 Creating task files..." -ForegroundColor Cyan

foreach ($task in $tasks) {
    $taskFile = "C:\Users\taejo\YameYame\worktrees\$($task.Branch)\TASK.md"
    $content = @"
# Task: $($task.Name)

## Branch: $($task.Branch)

## Objective:
$($task.Prompt)

## Acceptance Criteria:
- Code follows React Native / Node.js best practices
- Includes proper error handling
- Has unit tests with >80% coverage
- Documentation is complete
- Performance targets are met
- Security considerations addressed

## Technical Stack:
- Frontend: React Native + Expo
- UI: React Native Paper
- Backend: Node.js + Express
- Database: MongoDB + Redis
- Real-time: Socket.io
- Auth: JWT + Naver Band OAuth

## Notes:
- Follow the existing project structure
- Use TypeScript where applicable
- Implement offline-first approach
- Ensure gym-optimized UX (large buttons, high contrast)
"@
    
    # Create directory if it doesn't exist
    $dir = Split-Path $taskFile -Parent
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    Set-Content -Path $taskFile -Value $content -Encoding UTF8
    Write-Host "  ✓ Created: $taskFile" -ForegroundColor Green
}

# Create Claude Squad batch launcher
$launcherScript = @"
@echo off
echo.
echo =====================================
echo  YameYame Claude Squad Launcher
echo  Phase $Phase Development Tasks
echo =====================================
echo.
echo Starting Claude Squad...
echo.
echo Instructions:
echo 1. Press 'n' to create a new session
echo 2. Copy and paste each task prompt
echo 3. Use tab to switch between sessions
echo 4. Press 's' to commit and push changes
echo.
echo Task Prompts are saved in each worktree's TASK.md file
echo.
pause
wsl -d Ubuntu -e bash -l -c "cs"
"@

$launcherPath = "C:\Users\taejo\YameYame\run-claude-squad-phase$Phase.bat"
Set-Content -Path $launcherPath -Value $launcherScript -Encoding ASCII

Write-Host "`n✅ Setup Complete!" -ForegroundColor Green
Write-Host "`n📌 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run: $launcherPath" -ForegroundColor White
Write-Host "  2. Create $($tasks.Count) new sessions in Claude Squad (press 'n')" -ForegroundColor White
Write-Host "  3. For each session, paste the task from worktrees/[branch]/TASK.md" -ForegroundColor White
Write-Host "  4. Monitor progress with tab key to switch between sessions" -ForegroundColor White
Write-Host "  5. Commit completed work with 's' key" -ForegroundColor White

Write-Host "`n🎯 Development Targets:" -ForegroundColor Cyan
Write-Host "  - Launch Time: <3 seconds" -ForegroundColor White
Write-Host "  - Memory Usage: <150MB" -ForegroundColor White
Write-Host "  - API Response: <500ms" -ForegroundColor White
Write-Host "  - Real-time Latency: <100ms" -ForegroundColor White
Write-Host "  - Code Coverage: >90%" -ForegroundColor White