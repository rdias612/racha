# ⚡ Guia Rápido: Subir o Frontend Localmente (1-Clique)

Este guia foi otimizado para que qualquer desenvolvedor ou agente possa subir o frontend localmente em **menos de 30 segundos**, já conectado diretamente ao banco de dados Supabase real do **Racha Gragoatá CBO**.

---

## 🚀 1. Início Imediato no Windows (1-Clique)

Você pode subir o projeto de **3 formas fáceis**:

### Opção A: Executável Direto Windows (Duplo Clique ou Terminal)

Basta dar duplo clique no arquivo **[`iniciar_local.bat`](file:///c:/Users/PC/Documents/GitHub/racha/iniciar_local.bat)** ou rodar no terminal:

```cmd
.\iniciar_local.bat
```

### Opção B: Script PowerShell

```powershell
.\iniciar_local.ps1
```

### Opção C: Comando npm

```bash
npm run dev
```

> [!NOTE]
> Os scripts `iniciar_local.bat` e `iniciar_local.ps1` já realizam tudo automaticamente para você:
>
> 1. Verificam se o `.env` existe (e copiam do `.env.example` se faltar).
> 2. Verificam se as dependências do `node_modules` estão instaladas.
> 3. Iniciam o servidor fixando a porta **5173** e abrem o navegador automaticamente!

---

## 🌐 2. Acesso à Aplicação

Assim que o comando iniciar, acesse no navegador:

👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🔑 3. Configuração do `.env` (Já Engatilhada)

O repositório já conta com o arquivo [`.env`](file:///c:/Users/PC/Documents/GitHub/racha/.env) configurado na raiz com a chave pública do projeto Supabase oficial (`jtavmrlllyctkuxefhpc`).

Caso precise recriá-lo do zero no futuro, copie o [`.env.example`](file:///c:/Users/PC/Documents/GitHub/racha/.env.example):

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux / macOS / Git Bash
cp .env.example .env
```

### Conteúdo Pré-Configurado do `.env`:

```env
VITE_SUPABASE_URL=https://jtavmrlllyctkuxefhpc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0YXZtcmxsbHljdGt1eGVmaHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzA5MDMsImV4cCI6MjEwMTEwNjkwM30.zrn4FoaobmmLKqWbdgV5gbFdXdeS_bWRHI5oNKwwiak
```

---

## ⚽ 4. Como Navegar e Testar os Perfis

### 4.1 Login de Superadministrador (Acesso Total)

Para testar telas administrativas, financeiro, edição de súmula e novas partidas, utilize um dos usernames de superadmin no formulário de login (`/login`):

- **Usernames Superadmin**:
  - `dico`
  - `tadeu`
  - `natal`
- **Telas Exclusivas de Admin Habilitadas**:
  - 💰 **`/administrador`**: Gestão financeira de débitos, mensalidades (R$ 90) e avulsos (R$ 20).
  - 👥 **`/gestao-jogadores`**: Cadastro, ativação e controle de mensalistas (teto de 14).
  - ⚽ **`/partida/nova`**: Criação manual e agendamento de novas partidas.
  - 📝 **`/partida/:id/editar`**: Edição atômica de súmula oficial.

### 4.2 Login de Jogador / Atleta Comum

- Qualquer username da lista ativa (ex: `rod`, `pedro`, etc.) para testar a visão de jogador, confirmação de presença, votação secreta pós-jogo e estatísticas individuais em `/perfil`.

---

## 🧪 5. Scripts Úteis do Dia a Dia

| Ação Desejada                              | Comando no Terminal          |
| ------------------------------------------ | ---------------------------- |
| **Iniciar servidor de desenvolvimento**    | `npm run dev`                |
| **Checagem de erros de código e tipos**    | `npm run lint`               |
| **Formatar código automaticamente**        | `npm run format`             |
| **Validar build de produção**              | `npm run build`              |
| **Trocar porta se a 5173 estiver ocupada** | `npm run dev -- --port 3000` |

---

## 🛠️ 6. Resolução Rápida de Problemas

1. **A tela não atualizou após mudanças no `.env`**:
   - Pressione `Ctrl + C` no terminal e rode `npm run dev` novamente (o Vite precisa reiniciar para carregar novas variáveis de ambiente).
2. **PWA mostrando versão antiga em cache**:
   - Pressione `Ctrl + Shift + R` no navegador ou abra uma aba anônima.
3. **Sem conexão / Offline**:
   - Confirme se você está conectado à internet para se comunicar com o banco Supabase na nuvem.
