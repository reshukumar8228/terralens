@echo off
setlocal

cd /d "%~dp0.."

if not exist ".venv\Scripts\python.exe" (
    echo Run scripts\setup.bat first. >&2
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    call npm --prefix frontend run build
    if errorlevel 1 (
        echo Frontend build failed. >&2
        exit /b 1
    )
)

if defined PYTHONPATH (
    set "PYTHONPATH=%CD%\backend;%PYTHONPATH%"
) else (
    set "PYTHONPATH=%CD%\backend"
)

set "OMP_NUM_THREADS=2"
set "OPENBLAS_NUM_THREADS=2"
set "MKL_NUM_THREADS=2"

if not defined PORT (
    set "PORT=8000"
)

".venv\Scripts\python.exe" -m uvicorn terralens.app:app --host 127.0.0.1 --port %PORT% %*

