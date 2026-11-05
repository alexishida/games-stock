@echo off
rem Atalho de desenvolvimento: configura o Qt, usa o perfil existente do usuario e abre o app.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-run.ps1" %*
if errorlevel 1 pause
