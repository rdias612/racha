# ==============================================================================
# Iniciar Frontend Local - Racha Gragoata CBO
# Executa o Vite na porta 5173 conectado ao Supabase Real
# ==============================================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "   RACHA GRAGOATA CBO - FRONTEND LOCAL (Porta 5173)" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Verifica se o Node.js esta instalado
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[ERRO] Node.js nao foi encontrado no sistema." -ForegroundColor Red
    Write-Host "Instale o Node.js em: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. Garante que o arquivo .env existe
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "[INFO] Arquivo .env nao encontrado. Criando a partir de .env.example..." -ForegroundColor Cyan
        Copy-Item ".env.example" ".env"
        Write-Host "[OK] Arquivo .env criado com credenciais pre-configuradas." -ForegroundColor Green
    } else {
        Write-Host "[ERRO] Arquivo .env.example nao encontrado." -ForegroundColor Red
        exit 1
    }
}

# 3. Verifica se as dependencias (node_modules) estao instaladas
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Instalando dependencias do projeto via npm install..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERRO] Falha ao instalar dependencias." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] Iniciando servidor Vite em http://localhost:5173..." -ForegroundColor Green
Write-Host ""

# 4. Inicia o servidor Vite fixando a porta 5173 e abrindo o navegador
npx vite --port 5173 --strictPort --open
