# 13 · Limpeza de tokens e dados mortos (`C4`) — Plano de Implementação

> Ref.: item **C4** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#13 (nota 3,5)**, Tier 3 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: trivial · Prioridade global do plano: P2

## 1. Objetivo

Remover o **código morto** que sobrevive no CSS e no domínio de times: os tokens `--cor-oliva` e `--cor-led-fundo-hover` (definidos nos dois temas e mapeados no `@theme`, mas **zero usos** em `src/**`) e o campo `cor` de `TIMES`/`TimeInfo` (**zero consumo**). Não elimina duplicação — elimina a outra face do slop: definição sem consumidor, que induz o leitor a acreditar em comportamento inexistente e a editar o lugar errado. Mudança de deletar linhas, sem nenhum efeito visual ou funcional (grep revalidado).

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

- `src/index.css:52` — `--cor-oliva: #54552e;` em `:root`; `src/index.css:75` — mesmo valor em `.dark`.
- `src/index.css:54` — `--cor-led-fundo-hover: #161513;` em `:root`; `src/index.css:77` — mesmo valor em `.dark`.
- `src/index.css:28` — mapeamento no `@theme`: `--color-oliva: var(--cor-oliva);` (entre `--color-ok` e o grupo do LED).
- `src/index.css:31` — mapeamento no `@theme`: `--color-led-fundo-hover: var(--cor-led-fundo-hover);` (entre `--color-led-fundo` e `--color-led-borda`).
- Grep por `oliva` em `src/**` (incluindo as utilities derivadas `bg-oliva`, `text-oliva` etc. em `*.tsx`) retorna **somente as 4 definições/marcações do próprio `index.css`** — zero consumidores.
- Grep por `led-fundo-hover` em `src/**` retorna **somente as 4 marcações do `index.css`** — zero consumidores. Nota: os irmãos `--cor-led-fundo` e `--cor-led-borda` **têm** consumidores (placar LED) e não entram neste plano.
- `src/lib/times.ts:6` — campo `cor: string;` na interface `TimeInfo`; `src/lib/times.ts:16` (`cor: '#0d0d0e'`, Time Preto) e `src/lib/times.ts:24` (`cor: '#f4f1e8'`, Time Branco) — os 3 pontos onde o campo existe.
- Grep por acesso `.cor` em `src/**` (`*.ts`/`*.tsx`), excluindo as próprias definições de `times.ts`, retorna **vazio** — nenhum consumidor lê `TIMES.a.cor`/`TIMES.b.cor` nem `time.cor`. As classes `bgClasse`/`textClasse`/`borderClasse` (linhas vizinhas) é que carregam a cor real na UI.
- O `DESIGN.md` **não menciona** `oliva` em lugar nenhum — o token não tem documentação que precise de sincronização na remoção.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** A remoção é inerte e não conflita com nada dos planos 01–12 (nenhum deles toca `index.css` nos blocos de tokens citados ou `times.ts`).
- **Coordenação com o plano 29 / C5 (`DESIGN.md` em ordem)**: se o C5 for executado antes deste, a tabela de tokens nova do `DESIGN.md` já deve nascer **sem** `--cor-oliva`/`--cor-led-fundo-hover`; se este plano for executado antes, o C5 simplesmente não os documenta. Nenhuma ordem quebra.
- **Decisão do dono (única pendente, ver seção 6)**: se `--cor-oliva` é intenção de paleta futura. Conforme o doc de origem, a resposta correta é registrar no `DESIGN.md` — **não manter código morto por isso**. Nenhuma decisão é necessária para `--cor-led-fundo-hover` nem para o campo `cor` (puro órfão).
- **Restrição de janela**: nenhuma — nada muda em comportamento, marcação ou UI; pode rodar a qualquer momento.

## 4. Plano de execução (1 passo = 1 commit)

Dois passos independentes e reversíveis; a ordem entre eles é indiferente (arquivos distintos).

**Passo 1 — Remover os 2 tokens do CSS (commit 1).**
Arquivo único: `src/index.css`. Seis linhas deletadas, nenhuma linha criada ou alterada:

1. Deletar `--cor-oliva: #54552e;` em `:root` (`:52`) e em `.dark` (`:75`).
2. Deletar `--cor-led-fundo-hover: #161513;` em `:root` (`:54`) e em `.dark` (`:77`).
3. Deletar os mapeamentos no `@theme`: `--color-oliva: var(--cor-oliva);` (`:28`) e `--color-led-fundo-hover: var(--cor-led-fundo-hover);` (`:31`).
4. Conferir que os vizinhos ficam intactos: `--color-ok`, `--color-perigo`, `--cor-led-fundo`, `--cor-led-borda` permanecem (têm consumidores).
5. Como o grep da seção 2 prova zero consumidores, nenhuma call site precisa migração — o commit é morto por construção.

**Passo 2 — Remover o campo `cor` de `TimeInfo` (commit 2).**
Arquivo único: `src/lib/times.ts`. Três linhas deletadas:

1. Deletar `cor: string;` da interface `TimeInfo` (`:6`).
2. Deletar `cor: '#0d0d0e',` de `TIMES.a` (`:16`) e `cor: '#f4f1e8',` de `TIMES.b` (`:24`).
3. O `satisfies Record<TimeId, TimeInfo>` (`:29`) continua fechando: os campos restantes (`id`, `nome`, `bgClasse`, `textClasse`, `borderClasse`) cobrem a interface reduzida. Se o TypeScript acusar consumidor inesperado (não deve, pelo grep da seção 2), parar e reavaliar antes de prosseguir — não silenciar com cast.
4. Nenhum import ou tipo derivado é tocado: `TimeId`, `LIMITE_POR_TIME`, `POSICOES` e `POSICOES_B` ficam intactos.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist objetivo:

- [ ] Build de produção passa sem erro (`npm run build`) — confirma que nenhuma utility derivada (`bg-oliva` etc.) nem consumidor de `.cor` ficou órfão.
- [ ] Smoke visual em `npm run dev`, nos dois temas (claro e escuro): Resumo (placar LED com fundo, borda e glow intactos — prova de que só os tokens órfãos saíram), abertura de uma partida (cores dos times Preto/Branco, badges e bordas idênticas ao antes).
- [ ] Tela de escalação/montagem de times (`PartidaTimes`): nomes, fundos, textos e bordas dos dois times sem nenhuma diferença visual (o `cor` removido nunca chegou à UI — as classes é que pintam).
- [ ] Grep de sanidade pós-commit: `grep -rn "oliva\|led-fundo-hover\|cor:" src/` não retorna ocorrência das definições removidas (exceto `cor-tema`/`COR_TIPO`-afins que não fazem parte deste escopo).

## 6. Fora de escopo

- **Não manter `--cor-oliva` "por garantia"**: se for intenção de paleta futura, o registro correto é uma linha no `DESIGN.md` (seção de tokens/paleta) — YAGNI no código, memória no doc. O registro no doc é opcional e não é obrigação deste plano; o código morto sai de qualquer forma.
- **Não tocar em nenhum outro token**: `--cor-led-fundo` e `--cor-led-borda` têm consumidores (placar LED); a tríade `tema.ts` ↔ `index.html` ↔ manifest e o hex de `shadow-carimbo-destaque` são dos planos C5/C6; o token `--cor-scrim` é o plano 12. Apenas os 2 tokens órfãos citados saem.
- **Não renomear, reorganizar ou regravar** os blocos `@theme`/`:root`/`.dark` — só deletar as linhas listadas, sem mover vizinhos.
- **Não tocar no restante de `times.ts`** além do campo `cor`: nenhuma mudança em `bgClasse`/`textClasse`/`borderClasse`, `LIMITE_POR_TIME` ou `POSICOES*`.
- **Não criar constante/primitiva nova para as cores hex dos times**: elas já vivem corretamente nas classes de tema; o campo `cor` era uma segunda representação nunca usada.

## 7. Riscos e rollback

- **Risco principal — utility fantasma**: se algum `bg-oliva`/`text-oliva`/`led-fundo-hover` for adicionado ao JSX **entre o grep e o commit**, o build não falha (Tailwind v4 gera utility sem o valor mapeado? não — sem `--color-*` a utility deixa de existir) e a classe vira no-op silencioso. Mitigação: o grep de sanidade da seção 5 roda imediatamente antes de cada commit; nenhum consumidor hoje (revalidado em 30/09/2026).
- **Risco — campo `cor` consumido fora do grep** (ex.: spread dinâmico `{...TIMES[a]}` em prop de componente): improvável (grep cobriu `.cor` e spread em `src/**` não demonstra esse padrão) e o compilador pega via `satisfies`/tipagem estrita se surgir. Mitigação: passo 2 é commit separado; se o build acusar, reverter só ele.
- **Rollback**: cada passo é 1 commit isolado, revertível por `git revert` independente. Nenhum dado, rota, comportamento ou estilo visível é alterado em nenhum passo — reverter restaura exatamente as linhas deletadas.
