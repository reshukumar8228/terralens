@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

where.exe uv >nul 2>&1
if %ERRORLEVEL% equ 0 (
    if not exist ".venv\Scripts\python.exe" (
        uv venv --python 3.12 .venv
        if !ERRORLEVEL! neq 0 (
            echo Failed to create virtual environment with uv. >&2
            exit /b !ERRORLEVEL!
        )
    )
    uv pip install --python .venv\Scripts\python.exe -r requirements-dev.lock.txt
    if !ERRORLEVEL! neq 0 (
        echo Failed to install dependencies with uv. >&2
        exit /b !ERRORLEVEL!
    )
) else (
    if not exist ".venv\Scripts\python.exe" (
        set "PY_CMD="
        where.exe py >nul 2>&1
        if !ERRORLEVEL! equ 0 (
            py -3.12 -V >nul 2>&1
            if !ERRORLEVEL! equ 0 (
                set "PY_CMD=py -3.12"
            ) else (
                py -3 -V >nul 2>&1
                if !ERRORLEVEL! equ 0 (
                    set "PY_CMD=py -3"
                )
            )
        )
        if not defined PY_CMD (
            where.exe python >nul 2>&1
            if !ERRORLEVEL! equ 0 (
                set "PY_CMD=python"
            )
        )
        if not defined PY_CMD (
            echo Neither uv nor python was found in PATH. Please install uv or Python 3.12. >&2
            exit /b 1
        )
        !PY_CMD! -m venv .venv
        if !ERRORLEVEL! neq 0 (
            echo Failed to create virtual environment. >&2
            exit /b !ERRORLEVEL!
        )
    )
    ".venv\Scripts\python.exe" -m pip install -r requirements-dev.lock.txt
    if !ERRORLEVEL! neq 0 (
        echo Failed to install dependencies with pip. >&2
        exit /b !ERRORLEVEL!
    )
)

call npm --prefix frontend ci
if %ERRORLEVEL% neq 0 (
    echo npm ci failed. >&2
    exit /b %ERRORLEVEL%
)

call npm --prefix frontend run build
if %ERRORLEVEL% neq 0 (
    echo Frontend build failed. >&2
    exit /b %ERRORLEVEL%
)

echo.
echo TerraLens is installed. Start it with scripts\start.bat

