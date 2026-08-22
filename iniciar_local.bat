@echo off
setlocal

echo.
echo ===================================================
echo    RACHA GRAGOATA CBO - FRONTEND LOCAL (5173)
echo ===================================================
echo.

rem Modos de uso:
rem   iniciar_local.bat        -> build de producao + preview (comportamento padrao)
rem   iniciar_local.bat dev    -> servidor de desenvolvimento do Vite (com HMR)
set MODO=%~1

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

if /i "%MODO%"=="dev" goto dev

rem 4. Build de producao (checagem de tipos + vite build)
echo [INFO] Gerando build de producao (npm run build)...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo [ERRO] Falha no build de producao. Corrija os erros acima antes de iniciar.
    pause
    exit /b 1
)

echo.
echo [OK] Build concluido. Iniciando preview em http://localhost:5173 ...
echo.
call npx vite preview --port 5173 --strictPort --open
goto fim

:dev
echo [OK] Modo desenvolvimento. Servidor Vite iniciando na porta 5173...
echo.
call npx vite --port 5173 --strictPort --open

:fim
endlocal
