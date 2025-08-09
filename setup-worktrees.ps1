# YameYame Worktree Setup Script
# Creates multiple worktrees for parallel development

$baseDir = "C:\Users\taejo\YameYame"
$worktreeDir = "$baseDir\worktrees"

# Create worktrees directory
if (!(Test-Path $worktreeDir)) {
    New-Item -ItemType Directory -Path $worktreeDir
}

# Define worktree branches
$branches = @(
    "frontend-ui",
    "backend-api", 
    "band-integration",
    "realtime-socket",
    "database-layer",
    "infrastructure",
    "testing-suite",
    "ui-design"
)

# Create each worktree
foreach ($branch in $branches) {
    Write-Host "Creating worktree for $branch..." -ForegroundColor Cyan
    
    # Create branch and worktree
    git -C $baseDir branch $branch 2>$null
    git -C $baseDir worktree add "worktrees/$branch" $branch
    
    Write-Host "✓ Worktree created: worktrees/$branch" -ForegroundColor Green
}

Write-Host "`n✅ All worktrees created successfully!" -ForegroundColor Green
Write-Host "`nWorktree structure:" -ForegroundColor Yellow
git -C $baseDir worktree list