# 36 · Passo 4 — Documentação consolidada do plano — Registro de Execução e Validação

> Registro da execução do passo 4 do plano 36 (repositório + exclusão manual de clipes em `/clipes/admin`) em 02/10/2026, na branch `main`. Passo **documental** — não há código novo nem mudança de comportamento; **sem validação por agente separada** (nota na seção 4).

## 1. Contexto

Fecho do plano 36: com os passos 1–3 executados e validados (edge function, lib, UI — cada um com seu registro), este passo **consolida o plano como executado** em `36-repositorio-exclusao-clipes.md` (formato do `TEMPLATE.md`, com status real e hashes por passo), **registra dois débitos** herdados da implementação em `34-debitos-registrados.md` e **marca o plano no índice** do `README.md`.

## 2. Implementação

Quatro arquivos, um único commit (o mesmo que grava este registro):

- **`docs/planos-implementacao/36-repositorio-exclusao-clipes.md`** (novo) — plano consolidado nos 7 blocos do template: objetivo; estado atual com evidências `caminho:linha` do pré-execução (painel sem listar clipes individuais, grants da 109/112, ordem de deleção de `retencao.mjs:89`, ausência de CORS nas funções irmãs, modelo 066); pré-condições (deploy `--no-verify-jwt`); os 4 passos com hashes; validação E2E do dono; fora de escopo; riscos e rollback.
- **`docs/planos-implementacao/34-debitos-registrados.md`** (editado) — dois débitos novos no formato dos existentes (Passos 6 e 7, precedentes do Passo 5 do plano 05): (a) extrair componente de abas genérico `<Abas abas={...} ariaLabel>` — gatilho de 3ª ocorrência já alcançado, execução só ao tocar os arquivos; (b) nomenclatura de edge functions — verbo-primeiro nas irmãs vs sujeito-primeiro `admin-excluir-clipes`, exceção consciente pelo prefixo `admin-`, a revisar se o grupo admin crescer.
- **`docs/planos-implementacao/README.md`** (editado) — linha do plano 36 na tabela de features novas, mesmo padrão da linha do plano 35.
- **`docs/planos-implementacao/registros/36-passo-4-documentacao.md`** (novo, este arquivo).
- Commit: `docs: plano 36 consolidado, registro do passo 4 e debitos (plano 36)`.

## 3. Débitos registrados (resumo)

1. **Abas genéricas**: o padrão de barra de abas `NavLink` já conta 3 ocorrências praticamente idênticas (`AbasNotificacoes`, `AbasEstatisticas`, `AbasClipesAdmin` — o `AbasEstatisticas` foi identificado nesta consolidação e incluído no débito, divergindo só em detalhes de classe). A extração fica armada como débito "ao tocar", sem trabalho dedicado.
2. **Nomenclatura de edge functions**: padrão verbo-primeiro (`notificar-clipes`, `send-*`) vs sujeito-primeiro `admin-excluir-clipes` — exceção consciente documentada; revisão disparada pela 2ª função do grupo admin.

## 4. Validação (passo documental)

**Não houve ciclo de três agentes nem validação de agente separada**: o passo não produz código nem altera comportamento — o artefato é o próprio conjunto de documentos, e a conferência é factual, feita pelo registrador: evidências do plano consolidado verificadas contra o código no momento da escrita (`supabase/migrations/109_clipes_tabelas.sql`, `112_grant_delete_clipes.sql`, `066_rpc_excluir_partida.sql`, `scripts/clipes/retencao.mjs`, `src/lib/clipes.ts`, `src/components/Abas*`, `supabase/functions/*`) e hashes conferidos no `git log`. Os passos 1–3 já foram auditados individualmente (veredito APROVADO COM RESSALVAS em cada registro, zero bloqueantes).

## 5. Pendente de validação humana (dono)

- [ ] **Deploy da edge function**: `npx supabase functions deploy admin-excluir-clipes --no-verify-jwt` (pré-requisito de qualquer E2E).
- [ ] **Validação E2E** (roteiro completo na seção 5 do plano consolidado): excluir 1 e vários clipes; conferir bucket `clipes` no painel do Supabase, entrada `limpeza`/`manual` no ledger e partida esvaziada saindo do seletor; aba Importação inalterada; não-admin redirecionado; payload inválido → 400.
- [ ] **Push dos 7 commits do plano**: `a155911` (passo 1 — edge function), `125bd8f` (ressalva de ledger + registro do passo 1), `7980edf` (passo 2 — lib), `ac4a016` (mensagem de rede + registro do passo 2), `7a9247c` (passo 3 — UI), `603e669` (correções do passo 3) e este (passo 4 — documentação).
