# Configuração de secrets — Action Clipes do Filma Eu

> Cadência manual (RNF02): nenhum segredo vive no repo, em migration ou em log.
> Este documento lista O QUE cada segredo contém, ONDE é criado e a regra de
> log. Consumo: `scripts/clipes/importar-clipes.mjs` + `.github/workflows/clipes-filmaeu.yml`.

## 1. Supabase Vault (SQL Editor, como postgres)

| Nome | Conteúdo | Criado com | Consumidor |
| --- | --- | --- | --- |
| `filmaeu_credenciais` | JSON `{"usuario":"<login do dono no filmaeu.com.br>","senha":"<senha>"}` (D7: conta única) | `SELECT vault.create_secret('<json>', 'filmaeu_credenciais');` | Action Fase 3 via RPC `obter_segredo_vault` (migration 111) |
| `github_pat_clipes` | Fine-grained PAT do GitHub: só este repo, permissão mínima `actions:write` | Mesmo `vault.create_secret` | RPC `disparar_importacao_clipes` da Fase 6 (registrar já; não é lida nesta fase) |

- Rotação: recriar/atualizar com `vault.update_secret` (ou novo `create_secret`
  com o mesmo name); nada muda no repo.
- A RPC de leitura é executável só pela `service_role` (migration 111).

## 2. GitHub Secrets (repo → Settings → Secrets and variables → Actions)

| Nome | Conteúdo |
| --- | --- |
| `SUPABASE_URL` | `https://jtavmrlllyctkuxefhpc.supabase.co` (Project URL, dashboard Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (dashboard Supabase → Settings → API). **Chave de admin total do banco** — nunca em código, `.env` commitado ou log |

## 3. Regra de log (RNF02 — crítica)

- Os dois secrets do GitHub são mascarados automaticamente nos logs das runs;
  isso NÃO dispensa a regra: **nunca** `echo`/`print`/interpolar segredo em
  `run:`, nunca logar o retorno de `obter_segredo_vault` — o script só testa
  existência (`if (!valor)`).
- No terminal local, os mesmos cuidados: sem colar a service key em arquivos,
  issues ou conversas.

## 4. Limite de retenção (RF09, P11) — opcional

- Default: **800 MB** (compilado no YAML; folga sob o free tier de 1 GB).
- **Var do repositório** (Settings → Secrets and variables → Actions → aba
  **Variables**, não Secrets): `LIMITE_STORAGE_MB` = número de MB (decimais
  aceitos; `<= 0` ou não numérico falha a run).
  Define o limite de TODAS as runs (cron e dispatch) enquanto existir.
- **Override pontual**: input `limite_storage_mb` no `workflow_dispatch`
  (ex.: 50 para o teste de retenção do esqueleto §5) — vale só para aquela run.
- Precedência: input > var > default. Valor inválido (<= 0 ou não numérico)
  faz a run falhar (config errada, não silêncio).
