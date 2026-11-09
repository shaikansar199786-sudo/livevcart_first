@echo off
REM pdf-generator/start-service.bat
REM Starts the Puppeteer PDF service using PM2 (auto-restart on crash, auto-start on reboot)
REM
REM FIRST TIME SETUP (run once):
REM   npm install -g pm2
REM   npm install -g pm2-windows-startup
REM   pm2-windows-startup install
REM
REM Then run this script.

echo Starting Livincart PDF Generator Service...

REM Stop any existing instance to avoid duplicates
pm2 stop pdf-service 2>NUL
pm2 delete pdf-service 2>NUL

REM Start the service under PM2
pm2 start generate-pdf.js --name pdf-service --restart-delay 3000

REM Save PM2 process list so it survives reboots
pm2 save

echo.
echo PDF service started. Status:
pm2 status pdf-service

echo.
echo To check logs: pm2 logs pdf-service
echo To stop:       pm2 stop pdf-service
echo To monitor:    pm2 monit
