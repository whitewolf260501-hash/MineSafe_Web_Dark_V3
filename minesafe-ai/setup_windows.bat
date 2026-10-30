@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   Configuracion inicial de MineSafe IA
echo ============================================
where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERROR: No se encontro Python. Instala Python 3.11 o superior y vuelve a intentar.
    pause
    exit /b 1
  )
  set "PYTHON_CMD=python"
) else (
  set "PYTHON_CMD=py"
)
if not exist ".venv\Scripts\python.exe" (
  echo Creando entorno virtual...
  %PYTHON_CMD% -m venv .venv
  if errorlevel 1 goto :error
)
echo Instalando dependencias...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :error
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :error
".venv\Scripts\python.exe" scripts\create_env.py
if errorlevel 1 goto :error
echo.
echo Configuracion lista. Ahora puedes ejecutar INICIAR_MineSafe_IA.bat
echo.
pause
exit /b 0
:error
echo.
echo Hubo un error durante la instalacion. Copia el mensaje de esta ventana para revisarlo.
pause
exit /b 1
