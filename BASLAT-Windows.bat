@echo off
chcp 65001 >nul
title Instaclone
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js bulunamadi.
  echo   https://nodejs.org adresinden LTS surumu kurup bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b 1
)

echo.
echo   Instaclone baslatiliyor...
echo   Tarayici birazdan acilacak. Bu pencereyi KAPATMA.
echo.

start "Instaclone Server" /min cmd /c "node server.js"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

echo   Uygulama: http://localhost:3000
echo   Kapatmak icin gorev cubugundaki "Instaclone Server" penceresini kapatin.
echo.
pause
