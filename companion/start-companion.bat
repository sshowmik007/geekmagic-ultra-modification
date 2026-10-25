@echo off
title SmallTV-Ultra Companion Sync
echo Starting SmallTV-Ultra AI Companion (Dynamic Telemetry)...
py -3 -u "%~dp0companion.py"
if %errorlevel% neq 0 (
    python -u "%~dp0companion.py"
)
pause

