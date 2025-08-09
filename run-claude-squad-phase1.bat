@echo off
echo.
echo =====================================
echo  YameYame Claude Squad Launcher
echo  Phase 1 Development Tasks
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
