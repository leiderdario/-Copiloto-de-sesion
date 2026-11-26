@echo off
rem ============================================================
rem  Copiloto de sesion - lanzador desde el codigo fuente
rem  Doble clic: comprueba Node.js, instala dependencias si faltan
rem  y abre la app.
rem ============================================================
chcp 65001 >nul
title Copiloto de sesion
cd /d "%~dp0"

echo.
echo   Copiloto de sesion
echo   ------------------
echo.

rem --- 1. Node.js ---------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo   [!] No se encontro Node.js. Hace falta la version LTS ^(20 o superior^).
    echo.
    where winget >nul 2>nul
    if errorlevel 1 (
        echo   Descargalo de https://nodejs.org ^(boton LTS^), instalalo y vuelve a abrir este archivo.
        start "" https://nodejs.org
        pause
        exit /b 1
    )
    choice /c SN /m "  Instalar Node.js LTS ahora con winget"
    if errorlevel 2 (
        echo   Instala Node.js desde https://nodejs.org y vuelve a abrir este archivo.
        pause
        exit /b 1
    )
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    echo.
    echo   Node.js instalado. Cierra esta ventana y vuelve a abrir "Iniciar Copiloto.bat".
    pause
    exit /b 0
)
for /f "delims=" %%v in ('node -v') do echo   Node.js %%v encontrado.

rem --- 2. Dependencias (solo la primera vez) -------------------
if not exist "node_modules\electron" (
    echo.
    echo   Instalando dependencias ^(solo la primera vez, 1-3 minutos^)...
    call npm install
    if errorlevel 1 (
        echo.
        echo   [!] Fallo npm install. Revisa la conexion a internet y vuelve a intentarlo.
        pause
        exit /b 1
    )
)

rem --- 3. Clave de Groq ----------------------------------------
if "%GROQ_API_KEY%"=="" (
    echo.
    echo   [i] No hay variable GROQ_API_KEY. Puedes pegar la clave en la app:
    echo       Inicio ^> AI responses ^> GROQ API KEY. Ver README, seccion "Clave de Groq".
)

rem --- 4. Abrir ------------------------------------------------
echo.
echo   Abriendo el copiloto... ^(esta ventana puede quedarse minimizada^)
call npm start
