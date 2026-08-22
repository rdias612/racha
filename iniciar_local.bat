@echo off
setlocal

echo.
echo ===================================================
echo    RACHA GRAGOATA CBO - FRONTEND LOCAL (5173)
echo ===================================================
echo.

rem 1. Verifica Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado no sistema.
    echo Instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

rem 2. Verifica se o .env existe
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Criando arquivo .env a partir de .env.example
        copy .env.example .env >nul
        echo [OK] Arquivo .env criado com sucesso.
    ) else (
        echo [ERRO] Arquivo .env.example nao encontrado.
        pause
        exit /b 1
    )
)

rem 3. Verifica node_modules
if not exist "node_modules" (
    echo [INFO] Instalando dependencias do projeto via npm install
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias via npm.
        pause
        exit /b 1
    )
)

echo [OK] Servidor Vite iniciando na porta 5173...
echo.
call npx vite --port 5173 --strictPort --open

endlocal
