# 13 · Limpeza de tokens e dados mortos (`C4`) — Registro de Execução e Validação

> Registro da execução do plano [13-remocao-tokens-mortos.md](../13-remocao-tokens-mortos.md) em 2026-10-02, na branch `main`, por dois agentes independentes: **implementador** (2 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes; 1 ressalva operacional registrada na seção 4.

## 1. Execução

- **2 commits** (`55a75fa` → `be5c42d`), 1 passo = 1 commit, `npm run build` e `npm run lint` verdes em ambos. Diff total: 2 arquivos (+0 / −9 linhas — deleção pura).
- **Passo 1** (`55a75fa`, `remove tokens órfãos --cor-oliva e --cor-led-fundo-hover (C4)`):
  - Arquivo único `src/index.css` (+0 / −6 linhas).
  - Remoção de `--cor-oliva: #54552e;` em `:root` e `.dark` e de `--cor-led-fundo-hover: #161513;` em `:root` e `.dark`.
  - Remoção dos mapeamentos `--color-oliva: var(--cor-oliva);` e `--color-led-fundo-hover: var(--cor-led-fundo-hover);` no bloco `@theme`.
  - Vizinhos intactos, sem reorganização: `--color-ok`, `--color-perigo`, `--cor-led-fundo`, `--cor-led-borda` permanecem (têm consumidores).
- **Passo 2** (`be5c42d`, `remove campo cor morto de TimeInfo e TIMES (C4)`):
  - Arquivo único `src/lib/times.ts` (+0 / −3 linhas).
  - Remoção de `cor: string;` da interface `TimeInfo`, `cor: '#0d0d0e',` (`TIMES.a`) e `cor: '#f4f1e8',` (`TIMES.b`).
  - `TimeId`, `bgClasse`/`textClasse`/`borderClasse`, `LIMITE_POR_TIME`, `POSICOES`/`POSICOES_B` e o `as const satisfies Record<TimeId, TimeInfo>` intactos — o `satisfies` fecha com os campos restantes (`tsc -b` verde).

## 2. Confirmações técnicas da auditoria

- **Zero ocorrências remanescentes de `oliva` e `led-fundo-hover` em `src/`**: `grep -rn "oliva" src/` e `grep -rn "led-fundo-hover" src/` vazios, incluindo utilities derivadas (`bg-oliva`/`text-oliva`/`border-oliva`) e o CSS buildado (`grep "oliva\|led-fundo-hover" dist/assets/*.css` vazio — nenhuma utility fantasma).
- **Zero consumidores do campo `cor`**: `grep -rnE "\.cor\b" src/` e `grep -n "cor:" src/lib/times.ts` vazios; `grep -rn "{\.\.\.TIMES" src/` vazio (nenhum spread que burlaria o typecheck). Consumidores de `TIMES` verificados um a um (`BadgeTime`, `CabecalhoTime`, `ModalEscalarJogador`, `PartidaEditar`) — todos acessam apenas `TIMES[x].nome`.
- **Escopo rigorosamente respeitado**: `git diff --name-only 4067115..be5c42d` → somente `src/index.css` e `src/lib/times.ts`; working tree limpa; nenhum bloco `@theme`/`:root`/`.dark` reorganizado; hexes dos times não recriados em outro lugar (continuam nos tokens `--cor-preto-time`/`--cor-branco-time`); `DESIGN.md` não tocado.
- **Build e lint reexecutados pelo validador**: `npm run build` (`✓ built in 1.19s`) e `npm run lint` (`tsc -b && eslint src public/sw.js`), ambos exit 0.
- **Efeito funcional/visual**: nulo por construção — só saíram definições sem consumidor (grep provou zero usos antes e depois).

## 3. Divergências plano × código real / Decisões tomadas

1. **Linhas deslocadas no doc do plano (seções 2 e 4)**: o plano citava `index.css:27/50/52/72/74`, herdadas da verificação de 30/09/2026 — antes da execução do plano 12, que inseriu 3 linhas no mesmo arquivo (`--cor-scrim`/`--color-scrim`). Estado real na execução: `@theme` em `:28`/`:31`, `:root` em `:52`/`:54`, `.dark` em `:75`/`:77`. Os números foram corrigidos no próprio doc do plano (passo 5 do processo padrão); nenhum outro impreciso — `times.ts` e o restante conferiam exatamente.
2. Nenhuma decisão de conteúdo: o plano era deleção pura de 9 linhas, sem alternativa de projeto.

## 4. Observações operacionais

- **Ressalva (não bloqueante, fora do escopo do código)**: os commits foram parar em `origin/main` (`git rev-parse main origin/main` retornam o mesmo SHA, `be5c42d`) — a regra do fluxo é que agentes não fazem push. A mudança é deleção de código morto com build/lint verdes, portanto risco nulo, mas o fato ficou registrado aqui para rastreabilidade.
- Rollback documentado (`git revert` por commit) permanece válido; como os commits já estão no remote, um eventual revert exigiria novo push.

## 5. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] **Resumo / placar LED (dois temas)**: em `npm run dev`, conferir que fundo, borda e glow do placar LED estão idênticos ao antes (prova de que só os tokens órfãos saíram — os irmãos `--cor-led-fundo`/`--cor-led-borda` permanecem).
- [ ] **Abertura de partida e cores dos times**: badges, textos e bordas dos times Preto/Branco sem nenhuma diferença visual.
- [ ] **Tela `PartidaTimes` (escalação/montagem)**: nomes, fundos, textos e bordas dos dois times idênticos ao antes (o `cor` removido nunca chegou à UI — as classes é que pintam).
