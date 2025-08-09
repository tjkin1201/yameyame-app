# Simple GitHub Push Script
Write-Host "GitHub Push Starting..." -ForegroundColor Green

Set-Location "C:\Users\taejo\yameyame"

Write-Host "Current location: $PWD" -ForegroundColor Yellow

Write-Host "1. Git Status Check..." -ForegroundColor Yellow
git status

Write-Host "2. Remote Check..." -ForegroundColor Yellow
git remote -v

Write-Host "3. Branch Check..." -ForegroundColor Yellow
git branch

Write-Host "4. Push to GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: GitHub push completed!" -ForegroundColor Green
    Write-Host "Repository URL: https://github.com/tjkin1201/yameyame-app" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: GitHub push failed" -ForegroundColor Red
}