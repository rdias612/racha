# FutAmigos

MVP do app de pelada "Racha Quintas": gestao de presenca (FIFO), caixa unificado, sorteio de times e notificacoes via Expo Push. Android-only (APK) no MVP.

## Stack (decidida)

- **Mobile**: Expo SDK 52+ / React Native 0.76+ / TypeScript strict / Expo Router v3 (file-based) / NativeWind v4 (Tailwind)
- **Estado**: Zustand
- **Backend**: Supabase (Postgres 15 + Auth + Realtime + pg_cron + pg_net + Vault)
- **Auth**: Google OAuth apenas (Apple Sign-In pos-MVP)
- **Push**: Expo Notifications
- **Build**: EAS Build (APK preview + AAB production)

## Quick start

```powershell
git clone <repo-url>
cd racha
npm install
```

### Variaveis de ambiente (DEV)

Copie os arquivos `.example` e preencha com valores do seu projeto Supabase + Google Cloud:

```powershell
Copy-Item .env.example         .env          # EXPO_PUBLIC_* (cliente/APK)
Copy-Item .env.server.example  .env.server   # SERVICE_ROLE + EXPO_ACCESS_TOKEN (server)
Copy-Item supabase/.env.example supabase/.env
```

Consulte [`docs/supabase-setup.md`](docs/supabase-setup.md) para instrucoes detalhadas (incluindo onde obter cada chave) e **por que `service_role` nunca entra no APK**.

### Supabase CLI - prerequisito

O backend usa migrations SQL versionados via Supabase CLI. Instale antes de rodar scripts `db:*`:

```powershell
# Opcao A (npm)
npm install -g supabase

# Opcao B (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Validar
supabase --version
```

Veja [`docs/supabase-setup.md`](docs/supabase-setup.md) para login, link e fluxo diario completo.

## Scripts npm (T1.2 - DB)

| Script                     | Descricao                                                     |
| -------------------------- | ------------------------------------------------------------- |
| `npm run db:push`          | Aplica migrations pendentes ao projeto remoto                 |
| `npm run db:reset`         | Recria DB local + aplica seed (dev, destrutivo)               |
| `npm run db:seed`          | Alias para `db reset` (o CLI aplica seed.sql automaticamente) |
| `npm run db:types`         | Gera `types/database.types.ts` a partir do schema remoto      |
| `npm run db:new-migration` | Cria nova migration timestamped                               |

## Scripts npm (T1.1 - App)

| Script            | Comando                | Descricao                                |
| ----------------- | ---------------------- | ---------------------------------------- |
| `npm start`       | `expo start`           | Inicia o bundler Expo Dev Server         |
| `npm run android` | `expo start --android` | Abre no emulador/dispositivo Android     |
| `npm run ios`     | `expo start --ios`     | Abre no simulador iOS (pos-MVP)          |
| `npm run lint`    | `eslint .`             | Linter (flat config + typescript-eslint) |
| `npm run tsc`     | `tsc --noEmit`         | Type-check TypeScript strict             |

## Estrutura

```
.
+-- docs/
|   +-- supabase-setup.md     # Guia PT-BR de DB / CLI
|   +-- plan/                 # Plano de execucao + context envelope
+-- supabase/
|   +-- config.toml            # Equivalente a `supabase init`
|   +-- migrations/            # SQL versionado (T1.3a+)
|   +-- .env.example           # PROJECT_REF / DB_URL (local)
+-- types/
|   +-- database.types.ts      # Tipagem do schema (placeholder ate' db:types)
+-- .env.example                # Cliente/APK (EXPO_PUBLIC_*)
+-- .env.server.example         # Server (SERVICE_ROLE + EXPO_ACCESS_TOKEN)
+-- .gitignore
+-- package.json                # Scripts db:* (scaffold Expo vem em T1.1)
+-- implementation_plan.md      # PRD
```

## Roadmap

Plano: [`docs/plan/20260724-futamigos-mvp/plan.yaml`](docs/plan/20260724-futamigos-mvp/plan.yaml).

Estado: Wave 1 (Setup Infra) em andamento.

## Seguranca

- **Nunca** commite valores reais de `.env` ou `.env.server`.
- `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS - so commitado em servidor/cron (Vault).
- `EXPO_ACCESS_TOKEN` (expo push) - server-side apenas.
- Apenas `EXPO_PUBLIC_*` entra no APK (`anon key` ja filtrada por RLS).

## Licenca

Privado.
