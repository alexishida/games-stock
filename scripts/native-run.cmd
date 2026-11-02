@echo off
rem Atalho de desenvolvimento: configura o Qt, usa perfil sintético isolado e abre o app.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-run.ps1" %*
if errorlevel 1 pause
