# 🗄️ Guia de Migrações Automáticas do Supabase para LLMs e Agentes

> **Propósito deste documento**:  
> Este guia instrui Modelos de Linguagem (LLMs), agentes autônomos e desenvolvedores sobre como gerenciar, criar e aplicar migrações no banco de dados PostgreSQL do **Supabase** de forma automatizada e segura no projeto **Racha Gragoatá CBO**.

---

## 📌 1. Informações do Projeto Supabase

- **Project Reference (ID do Projeto)**: `jtavmrlllyctkuxefhpc`
- **Project URL**: `https://jtavmrlllyctkuxefhpc.supabase.co`
- **Diretório de Migrações**: `supabase/migrations/`
- **Script Mestre Consolidado**: `supabase/aplicar_tudo.sql`

---

## 🚀 2. Passo a Passo para Executar Migrações (Fluxo Rápido)

Comandos essenciais baseados no `MIGRATE.md`:

```bash
# 1. Autenticar no Supabase CLI (caso ainda não esteja logado)
npx supabase login

# 2. Vincular o repositório local ao projeto Supabase remoto
npx supabase link --project-ref jtavmrlllyctkuxefhpc

# 3. Aplicar todas as migrações pendentes no banco remoto
npx supabase db push
```

---

## 🤖 3. Execução Automatizada / Headless para LLMs e Agentes

Ao executar comandos em pipelines de CI/CD, terminais não interativos ou através de ferramentas de execução de agentes de IA:

### 3.1 Autenticação com Token de Acesso

Se o comando interativo `npx supabase login` abrir uma janela do navegador que o agente não pode interagir, utilize a variável de ambiente `SUPABASE_ACCESS_TOKEN`:

```bash
# Windows PowerShell
$env:SUPABASE_ACCESS_TOKEN="seu_token_aqui"
npx supabase link --project-ref jtavmrlllyctkuxefhpc --password "sua_db_password"
npx supabase db push

# Linux / macOS / Bash
export SUPABASE_ACCESS_TOKEN="seu_token_aqui"
npx supabase link --project-ref jtavmrlllyctkuxefhpc --password "sua_db_password"
npx supabase db push
```

> [!TIP]
> O `SUPABASE_ACCESS_TOKEN` pode ser gerado no painel do Supabase em: **Account Settings > Access Tokens > Generate new token**.

---

## 📐 4. Como Criar uma Nova Migration

Toda nova funcionalidade que exija alteração no banco de dados deve seguir este fluxo:

### Passo 1: Descobrir o próximo número sequencial de 3 dígitos

Verifique o último arquivo em `supabase/migrations/`. Se o último for `070_rpc_medias_notas_jogadores.sql`, a próxima migration **DEVE** ser `071_nome_descritivo.sql`.

### Passo 2: Criar o arquivo SQL em `supabase/migrations/`

Exemplo: `supabase/migrations/071_adicionar_tabela_exemplo.sql`.

### Passo 3: Escrever o SQL seguindo as Diretrizes Canônicas

Todo script SQL gerado deve respeitar as seguintes regras inegociáveis:

1. **Regra Zero UUID**:
   - Chaves primárias: `id bigserial PRIMARY KEY`
   - Chaves estrangeiras: `bigint REFERENCES tabela(id)`
   - 🚫 **Nunca use** `UUID`, `gen_random_uuid()` ou `uuid_generate_v4()`.

2. **Padrão Obrigatório para RPCs (Funções PostgreSQL)**:

   ```sql
   CREATE OR REPLACE FUNCTION nome_da_funcao_em_portugues(
     p_parametro_um bigint,
     p_parametro_dois jsonb
   )
   RETURNS boolean
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   BEGIN
     -- Lógica transacional
     RETURN true;
   END;
   $$;

   -- Concessão explícita de execução para roles do Supabase
   GRANT EXECUTE ON FUNCTION nome_da_funcao_em_portugues(bigint, jsonb) TO anon, authenticated;
   ```

3. **Cuidado com Views e Erro PostgreSQL 42P16**:
   - Ao alterar views existentes com `CREATE OR REPLACE VIEW`, **novas colunas devem ser adicionadas sempre ao final da lista de seleção**, nunca no início ou no meio.

4. **Proteção de Dados Sensíveis**:
   - A coluna `senha_hash` da tabela `jogadores` é protegida. Nunca faça `GRANT SELECT (senha_hash)` para `anon` ou `authenticated`.

5. **Fusos Horários e pg_cron**:
   - O `pg_cron` avalia em **UTC** (fuso de Brasília é **UTC-3**).
   - `10:00 BRT` = `13:00 UTC` (`0 13 * * 1` para segundas-feiras).
   - Em queries, use sempre: `now() AT TIME ZONE 'America/Sao_Paulo'`.

### Passo 4: Aplicar a Migration no Banco

```bash
npx supabase db push
```

---

## 🔍 5. Comandos de Diagnóstico e Verificação

```bash
# Listar status de todas as migrações (locais vs remotas)
npx supabase migration list

# Comparar o schema local com o remoto (diff)
npx supabase db diff

# Verificar conexões ou rodar query ad-hoc
npx supabase db execute --project-ref jtavmrlllyctkuxefhpc --query "SELECT count(*) FROM jogadores;"
```

---

## ⚠️ 6. Resolução de Problemas Comuns (Troubleshooting)

| Erro / Problema                                     | Causa Provável                                                          | Solução Recomendada                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Project not linked`                                | O repositório não foi associado ao projeto remoto.                      | Execute `npx supabase link --project-ref jtavmrlllyctkuxefhpc`.                                                 |
| `Cannot change name or type of view column (42P16)` | Uma view teve a ordem das colunas alterada em `CREATE OR REPLACE VIEW`. | Adicione colunas extras apenas no final da lista do `SELECT`.                                                   |
| `Permission denied for table ...`                   | A função não roda com privilégios adequados ou faltou grant.            | Adicione `SECURITY DEFINER SET search_path = public` e `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;`. |
| `Migration ... has already been applied`            | Tentativa de alterar uma migration passada já executada.                | Nunca edite migrations antigas. Crie uma nova migration com o próximo número sequencial (ex: `071_...sql`).     |
| `Senha_hash exposta no client`                      | Falta de restrição de colunas.                                          | Garanta que apenas colunas públicas estão no `GRANT SELECT` da tabela `jogadores`.                              |
