# 📚 Manuais e Guias de Desenvolvimento — Racha Gragoatá CBO

Bem-vindo ao diretório de guias práticos do projeto **Racha Gragoatá CBO**. Aqui você encontrará instruções passo a passo para configuração de ambiente, execução local e governança de banco de dados.

---

## 🗂️ Guias Disponíveis

### 1. 🗄️ [Guia de Migrações Automáticas do Supabase](./MIGRACOES_AUTOMATICAS.md)

Instruções para Modelos de Linguagem (LLMs), agentes e desenvolvedores sobre como:

- Executar `npx supabase login`, `npx supabase link` e `npx supabase db push`.
- Autenticar em modo headless via `SUPABASE_ACCESS_TOKEN`.
- Criar novas migrations sequenciais de 3 dígitos (`071_...sql`).
- Respeitar a **Regra Zero UUID**, RPCs transacionais com `SECURITY DEFINER` e permissões de segurança.

👉 **Acessar:** [`GUIA/MIGRACOES_AUTOMATICAS.md`](./MIGRACOES_AUTOMATICAS.md)

---

### 2. 💻 [Guia de Setup e Execução do Frontend Local](./SETUP_FRONTEND_LOCAL.md)

Passo a passo detalhado para rodar o app localmente com Vite + React 19:

- Instalação de dependências (`npm install`).
- Configuração de credenciais no arquivo `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Onde obter as chaves públicas no painel do Supabase.
- Inicialização do servidor com `npm run dev`.
- Perfis de login e superadministradores (`dico`, `tadeu`, `natal`).
- Resolução de problemas comuns (Troubleshooting).

👉 **Acessar:** [`GUIA/SETUP_FRONTEND_LOCAL.md`](./SETUP_FRONTEND_LOCAL.md)

---

### 3. ⚽ [Diretrizes Canônicas para LLMs e Agentes](../AGENTS.md)

Para entender toda a arquitetura, regras de negócio do futebol, design system "Súmula de Quinta" e padrões de código rigorosos:

👉 **Acessar:** [`AGENTS.md`](../AGENTS.md)
