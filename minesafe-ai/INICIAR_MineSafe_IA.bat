@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Primero ejecuta setup_windows.bat
  pause
  exit /b 1
)
if not exist ".env" (
  echo No existe .env. Ejecuta primero setup_windows.bat
  pause
  exit /b 1
)
echo MineSafe IA iniciando...
echo Documentacion: http://127.0.0.1:8000/docs
echo Estado:        http://127.0.0.1:8000/health
echo Para detener el servidor, pulsa Ctrl+C.
echo.
".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
