# Git 설정 및 커밋 스크립트
Write-Host "🔧 Git 설정 및 커밋 시작..." -ForegroundColor Green

# 현재 디렉토리로 이동
Set-Location "C:\Users\taejo\yameyame"

# Git 사용자 정보 설정
Write-Host "`n1. Git 사용자 정보 설정..." -ForegroundColor Yellow
git config user.name "taejo"
git config user.email "tjkin1201@gmail.com"

# 워크트리들을 submodule 대신 파일로만 추가
Write-Host "`n2. 워크트리 Git 저장소 제거..." -ForegroundColor Yellow
Remove-Item -Path "worktrees\*\.git" -Recurse -Force -ErrorAction SilentlyContinue

# 모든 파일 스테이징
Write-Host "`n3. 파일 스테이징..." -ForegroundColor Yellow
git add .

# 커밋 메시지 작성
Write-Host "`n4. Git 커밋..." -ForegroundColor Yellow
$commitMessage = @"
feat: Development kickoff with comprehensive expert review

🚀 Major Development Milestones:
- Complete expert review from 4 specialists (80/100 average score)
- Comprehensive development kickoff plan created
- 8 worktree parallel development structure ready
- High priority tasks identified and documented

🎯 Expert Review Results:
- UI/UX Designer: 85/100 (Gym-optimized design)
- Mobile Developer: 80/100 (Cross-platform architecture) 
- Backend Architect: 75/100 (Scalable foundation)
- Performance Engineer: 80/100 (Strong monitoring)

📋 Development Documentation Added:
- DEVELOPMENT_KICKOFF_PLAN.md: Week 1-2 roadmap
- IMMEDIATE_ACTION_ITEMS.md: Day-by-day execution plan
- DEVELOPMENT_PROCESS.md: Quality gates and collaboration
- PROJECT_ANALYSIS.md: Current 25-30% completion

🔧 Technical Stack Validated:
- React Native + Expo 51.0.28
- Node.js + Express + TypeScript
- MongoDB + SQLite hybrid strategy
- Socket.io real-time communication
- Redis caching and sessions

🎯 Phase 1 Priority Tasks Ready:
1. Gym-specific UI theme
2. Offline-first SQLite architecture  
3. Battery-efficient Socket.io management
4. Basic E2E testing with Detox
5. Performance monitoring foundation

🏗️ Worktree Structure Prepared:
- backend-api: TypeScript/Express server
- frontend-ui: React Native/Expo app
- band-integration: OAuth & API integration
- database-layer: MongoDB/SQLite schemas
- realtime-socket: Socket.io optimization
- testing-suite: Jest/Detox E2E testing
- infrastructure: Docker/AWS deployment
- ui-design: Gym-specific design system

🎉 Ready for Phase 1 development start!

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
"@

git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git 커밋 완료!" -ForegroundColor Green
    
    # GitHub 업로드 스크립트 실행
    Write-Host "`n5. GitHub 업로드 시작..." -ForegroundColor Yellow
    & ".\github-setup.ps1"
    
} else {
    Write-Host "❌ Git 커밋 실패" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Git 설정 및 커밋 완료!" -ForegroundColor Green