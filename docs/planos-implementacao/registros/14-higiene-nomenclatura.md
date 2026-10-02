# 14 · Higiene de nomenclatura (`A4`) — Registro de Execução e Validação

> Registro da execução do plano [14-higiene-nomenclatura.md](../14-higiene-nomenclatura.md) em 2026-10-02, na branch `main`, por dois agentes independentes: **implementador** (4 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção.

## 1. Execução

- **4 commits** (`65931d8` → `cb06abe`), 1 passo = 1 commit, `npm run build` e `npm run lint` verdes em todos os que tocam código. Diff total: 7 arquivos (+18 / −19).
- **Passo 1** (`65931d8`, `remove aliases bilíngues mortos das props de CampoBusca (A4)`):
  - Arquivo único `src/components/CampoBusca.tsx` (+2/−13); nenhum chamador tocado.
  - Remoção das props `value`/`onChange`/`disabled` (com seus JSDoc de alias) da interface e da destruturação.
  - Fallbacks simplificados: `textoAtual = valor ?? ''` e `isDisabled = desabilitado ?? false`.
  - **Invocação dupla eliminada**: `handleChange` invoca só `aoMudar?.(novoValor)` e `handleLimpar` só `aoMudar?.('')` — antes, um uso futuro do alias dispararia o handler 2×.
  - Os 5 chamadores (ModalSelecionarGoleiro, ModalEscalarJogador, GestaoGoleiros, PartidaNova, GestaoJogadores) já usavam exclusivamente `valor`/`aoMudar` — zero migração necessária.
- **Passo 2** (`3b1c009`, `renomeia linhasComparador.tsx para PascalCase (A4)`):
  - `git mv src/components/linhasComparador.tsx → LinhasComparador.tsx` (diff `similarity index 100%` — rename real, histórico preservado, conteúdo interno intocado).
  - Imports atualizados nos 2 importadores: `SecaoJuntosComparador.tsx:3` e `SecaoAdversosComparador.tsx:3`.
  - Era o único arquivo de `src/components/` fora do padrão PascalCase.
- **Passo 3** (`7f1cf3b`, `unifica prop variant para variante no SeletorNota (A4)`):
  - `src/components/SeletorNota.tsx` (+3/−3): prop `variant?: 'full' | 'compact'` → `variante` (interface, destruturação `variante = 'full'`, leitura `variante === 'compact'`); JSDoc preservado.
  - `src/routes/PartidaVotar.tsx` (+1/−1): único call site migrado (`variante="compact"`).
  - Props `value`/`onChange`/`disabled` do `SeletorNota` intocadas — espelhos deliberados da API nativa de `<select>` (seção 6 do plano).
- **Passo 4** (`cb06abe`, `documenta convenção de nomenclatura de props no DESIGN.md (A4)`):
  - Arquivo único `DESIGN.md` (+10); nenhuma linha de código.
  - Nova subseção **5.6 "Convenção de Nomenclatura de Props"** na seção 5, com as 3 regras: props de dado em pt-BR (`CampoBusca`, `Badge`, `PainelPlacar`), handlers `ao*` (`CampoBusca`, `MensagemEstado`) e APIs nativas do DOM em inglês (`SeletorNota`, `Toggle`).
  - Parágrafo de exceções já estabelecidas (`open`/`onClose` do `ModalBase`, `checked`/`onChange` do `Toggle`) — espelha a seção 6 do plano e segue o estilo das subseções vizinhas.
  - Sumário do `DESIGN.md` lista só seções de nível 1 (sem subseções 5.x), então nada a atualizar nele (caso condicional do plano).

## 2. Confirmações técnicas da auditoria

- **Escopo global**: `git diff --name-only 2bd9ef2..cb06abe` → exatamente os 7 arquivos previstos; nenhum arquivo fora da lista; working tree limpa.
- **Zero aliases remanescentes**: interface e destruturação de `CampoBusca` só com `valor`/`aoMudar`/`desabilitado` (+ props nativas repassadas ao `<input>`); os `value=`/`onChange=`/`disabled=` encontrados nos chamadores pertencem a elementos HTML nativos, não ao `CampoBusca`.
- **Rename íntegro**: `grep -rn "linhasComparador" src/` vazio; todos os demais componentes de `src/components/` já em PascalCase; `tsc` (case-sensitive) passa — a prova definitiva de case-sensitivity virá também do CI.
- **Zero `variant="` em `src/`**; única divergência de API de `variante` restante é a sancionada (props nativas).
- **Build, lint e typecheck reexecutados pelo validador**: `npm run build` (exit 0), `npm run lint` (exit 0), `npx tsc --noEmit` (exit 0).
- **Comportamento**: nenhuma mudança de runtime; a única mudança observável é a desejada (handler de busca dispara exatamente 1×, eliminada a invocação dupla latente).

## 3. Divergências plano × código real / Decisões tomadas

1. **Linhas deslocadas no doc do plano**: os chamadores de `CampoBusca` (deslocados ~8–13 linhas) e o call site de `PartidaVotar` (`variant="compact"` em `:362`, plano citava `:352`). Corrigidos no próprio doc do plano (passo 5 do processo padrão). Linhas de `CampoBusca.tsx` e `SeletorNota.tsx` conferiam exatamente.
2. **Título da 5.6 em Title Case** ("Convenção de Nomenclatura de Props"), em vez da minúscula literal do plano — segue o padrão real das subseções vizinhas do `DESIGN.md` (ex.: "Prevenção Obrigatória de Race Conditions"). Melhoria de coerência, registrada como normalização.
3. Nenhuma decisão de conteúdo: os 4 pontos já estavam definidos no doc de origem (A4).

## 4. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] **Campo de busca**: digitar em um filtro (ex.: `GestaoJogadores`) e conferir filtragem normal; botão "X" esvazia texto e listagem (handler dispara 1× — comportamento idêntico ao antes).
- [ ] **Comparador**: seções "Juntos" e "Adversos" renderizam as linhas de atleta normalmente (rename de arquivo não afeta runtime, mas é a checagem prevista).
- [ ] **Votação (`PartidaVotar`)**: seletor de nota aparece no modo compacto (gatilho estreito ao lado do nome), abre/fecha o listbox e a escolha mantém destaque âmbar + haptics. Executar fora de janela de votação aberta, por segurança.
- [ ] **`DESIGN.md`**: nova subseção 5.6 renderiza sem quebra de markdown no lugar onde o time consome o doc.
