@echo off
title Songless - Spotify Edition
cd /d "%~dp0"
python launcher.py
if errorlevel 1 (
    echo.
    echo Press any key to exit...
    pause >nul
)
