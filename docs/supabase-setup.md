# Setup Supabase CLI - FutAmigos MVP

Guia PT-BR para configurar o backend Supabase localmente e aplicacoes remotas.

## 1. Prerequisitos

- Node.js 20+ (`node --version`).
- Supabase project ja criado no [dashboard Supabase](https://supabase.com/dashboard).
- Client ID / Secret do Google OAuth ja obtidos (Google Cloud Console).
- (Wave 5) Supabase Vault habilitado no projeto (`T5.0`).

## 2. Instalar Supabase CLI (Windows / PowerShell)

Escolha UMA das opcoes:

### Opcao A - npm (recomendado se ja tem Node)

```powershell
npm install -g supabase
supabase --version
```

### Opcao B - Scoop

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

### Opcao C - Binario direto

Baixe o `.zip` mais recente em <https://github.com/supabase/cli/releases> e extraia em um diretorio no `PATH`.

## 3. Login e link do projeto (interativo)

Estes comandos sao interativos e devem ser executados uma unica vez por maquina de desenvolvimento. **Nao automatize em scripts de CI sem access token.**

```powershell
# Autentica no Supabase (abre browser). Gera access token em ~/.supabase.
supabase login

# Vincula o projeto remoto. Obtenha <ref> no Dashboard > Project Settings > General > Reference ID.
supabase link --project-ref <ref>
```

apos o `link`, o `supabase/` local fica vinculado ao projeto remoto. O project_ref **nao** fica no `config.toml` (que e' generico); o vinculo e' guardado em `supabase/.temp/` (JA NO .gitignore).

## 4. Variaveis de ambiente

Copie os arquivos `.example` e preencha:

```powershell
Copy-Item .env.example         .env          # EXPO_PUBLIC_* (cliente/APK)
Copy-Item .env.server.example  .env.server   # SERVICE_ROLE + EXPO_ACCESS_TOKEN (server)
Copy-Item supabase/.env.example supabase/.env
```

### Onde obter valores

| Variavel | Origem |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL`        | Dashboard > Project Settings > API > Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Dashboard > Project Settings > API > Project API keys > `anon` `public` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`| Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID |
| `SUPABASE_SERVICE_ROLE_KEY`       | Dashboard > Project Settings > API > Project API keys > `service_role` |
| `EXPO_ACCESS_TOKEN`               | expo.dev > Account Settings > Access Tokens |
| `SUPABASE_PROJECT_REF`            | Dashboard > Project Settings > General > Reference ID |
| `SUPABASE_DB_URL`                 | Dashboard > Project Settings > Database > Connection string (modo `transaction`/`session`) |

### Por que `service_role` **nunca** entra no APK

- `service_role` bypassa RLS (Row Level Security) com previlegios administrativos.
- APKs Android sao facilmente disassemblados (`apktool`, `jadx`). Qualquer chave embarcada e' publicamente recuperavel.
- Se comprometida, qualquer pessoa podera ler/escrever/modificar TODOS os dados de TODOS os groups.
- Por isso a divisao:
  - **Cliente/APK**: soh `EXPO_PUBLIC_*` (anon key, que ja e' filtrada por RLS).
  - **Server / cron / migrations**: `SUPABASE_SERVICE_ROLE_KEY` e `EXPO_ACCESS_TOKEN`, via Vault (T5.0) ou injecao de env no executor.

## 5. Migrations - fluxo diario

### Aplicar migrations locais ao DB local (Docker)

```powershell
supabase start            # sobe stack local (Postgres, Studio, Auth, Realtime...)
supabase db reset         # recria DB local + aplica TODAS migrations + supabase/seed.sql
```

`db reset` e' **destrutivo** para o DB local (usado em dev, nao em prod).

### Aplicar migrations ao projeto remoto (apos `supabase link`)

```powershell
npm run db:push           # = supabase db push (aplica pendentes ao remoto)
```

### Criar nova migration

```powershell
npm run db:new-migration nome_da_migration
# cria supabase/migrations/<timestamp>_nome_da_migration.sql
```

### Gerar tipos TypeScript apos mudanca de schema

```powershell
npm run db:types          # = supabase gen types typescript --linked > types/database.types.ts
```

### Importar schema de projeto existente (usar com cautela - sobrescreve ordem local)

```powershell
supabase db pull          # gera migration a partir do estado remoto
```

> **Atencao**: `db pull` so' depois de coordenar com a equipe; conflita com seu fluxo migration-first.

## 6. Seed

`supabase/seed.sql` e' aplicado **automaticamente** todo `supabase db reset`. No MVP, sera populado em `T1.3b` (GROUPS fixo + 2 goleiros + 1 admin fake). Nao existe script `db:seed` separado - reza-se o contrato do CLI.

## 7. Problemas comuns

| Sintoma | Solucao |
| --- | --- |
| `supabase: command not found` | Reinstalar (Secao 2); checar `PATH`; reiniciar terminal. |
| `link` falha apos `login` | Verificar `~/.supabase/access-token`; re-rodar `supabase login`. |
| `db reset` DB local travado | `supabase stop` + `supabase start`; Docker Desktop aberto. |
| `gen types` sem `--linked` | Ir para raiz do repo apos `supabase link` concluido. |
| RLS bloqueia consulta legitima | Nao usar `service_role` para contornar. Revisar policies (T1.7/T5.3). |

## 8. Referencia rapida - scripts npm

| Script | Comando equivalente | Quando usar |
| --- | --- | --- |
| `npm run db:push`          | `supabase db push`                          | Aplicar migrations ao remoto |
| `npm run db:reset`         | `supabase db reset`                         | Recriar DB local + seed (dev) |
| `npm run db:seed`          | `supabase db reset`                         | Idiomatico - alias para reset com seed |
| `npm run db:types`         | `supabase gen types typescript --linked`    | Regenerar `types/database.types.ts` |
| `npm run db:new-migration` | `supabase migration new`                    | Criar nova migration timestamped |

## 9. Estado atual desta task (T1.2)

- [x] `supabase/config.toml` criado equivalente a `supabase init`.
- [x] `supabase/migrations/` pronto para `T1.3a`.
- [x] Env split cliente/server pronto (`.env.example`, `.env.server.example`, `supabase/.env.example`).
- [x] `.gitignore` cobre secrets reais.
- [x] Scripts `db:*` em `package.json`.
- [ ] **Acao manual do dev**: executar `supabase login` + `supabase link --project-ref <ref>` (passo 3).
- [ ] **Acao manual do dev**: rodar `npm run db:types` depois do primeiro `link`.
