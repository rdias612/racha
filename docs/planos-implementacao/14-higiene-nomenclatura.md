# 14 · Higiene de nomenclatura — Plano de Implementação

> Ref.: item **A4** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#14 (nota 3,0)**, Tier 3 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: mínimo · Prioridade global do plano: P1

## 1. Objetivo

Eliminar três incoerências pontuais de nomenclatura em `src/components/`: (a) **aliases bilíngues mortos** em `CampoBusca` (props `value`/`onChange`/`disabled` duplicando `valor`/`aoMudar`/`desabilitado`, que são as únicas usadas pelos chamadores); (b) **nome de arquivo em minúsculas** (`linhasComparador.tsx`) fugindo do padrão PascalCase de todos os demais componentes; (c) **divergência de API** (`variant` no `SeletorNota` vs `variante` em `Badge`/`CabecalhoTime`/`CampoBusca`/`PainelPlacar`). Metade do item é remover código morto; a outra metade é prevenir que a divergência se multiplique para código novo, documentando a convenção no lugar canônico. Zero risco funcional, quase zero volume — higiene de Tier 3.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

- `src/components/CampoBusca.tsx:4-22` — interface com os 3 pares bilíngues:
  - `valor` (`:6`) + alias morto `value` (`:8`, "Alias em inglês para compatibilidade");
  - `aoMudar` (`:10`) + alias morto `onChange` (`:12`);
  - `desabilitado` (`:20`) + alias morto `disabled` (`:22`).
- `src/components/CampoBusca.tsx:44-61` — destruturação dos dois lados de cada par; `:62-63` — fallbacks `valor ?? value ?? ''` e `desabilitado ?? disabled ?? false`; `:67-68` e `:72-73` — **invocação dupla** (`aoMudar?.(novoValor); onChange?.(novoValor);`), inofensiva hoje porque nenhum chamador usa o alias, mas um convite a handler executado 2× se alguém usar.
- **Os 5 chamadores usam exclusivamente pt-BR** (grep sobre `<CampoBusca` em `src/**`, revalidado):
  - `src/components/ModalSelecionarGoleiro.tsx:76` — `valor={busca} aoMudar={setBusca}`;
  - `src/components/ModalEscalarJogador.tsx:63-68` — `valor={buscaJogador} aoMudar={setBuscaJogador}`;
  - `src/routes/GestaoGoleiros.tsx:229-231` — `valor={busca} aoMudar={setBusca}`;
  - `src/routes/PartidaNova.tsx:246-248` — `valor={busca} aoMudar={setBusca}`;
  - `src/routes/GestaoJogadores.tsx:318-320` — `valor={busca} aoMudar={setBusca}`.
  - Zero ocorrências de `value=`/`onChange=`/`disabled=`/`desabilitado=` em nenhum chamador — os aliases são código morto confirmado.
- `src/components/linhasComparador.tsx` — arquivo em minúsculas exportando `LinhaAtletaContexto` (`:6`); exatamente **2 importadores**: `src/components/SecaoJuntosComparador.tsx:3` e `src/components/SecaoAdversosComparador.tsx:3` (ambos `import { LinhaAtletaContexto } from './linhasComparador'`).
- `src/components/SeletorNota.tsx:17` — `variant?: 'full' | 'compact'`; destruturação em `:34`, leitura em `:36` (`variant === 'compact'`). Único call site da prop: `src/routes/PartidaVotar.tsx:362` (`variant="compact"`).
- Padrão estabelecido no resto da base: `variante` em `Badge.tsx:20`, `CabecalhoTime.tsx:10`, `CampoBusca.tsx:24` e `PainelPlacar.tsx:5` — `SeletorNota` é o único fugindo.
- Observação registrada: `SeletorNota` também usa `value`/`onChange`/`disabled` (`:6-9`) — são espelhos deliberados da API nativa de `<select>` (ver seção 6) e **não** entram neste plano.
- Lugar canônico da convenção: `DESIGN.md` (raiz do repo, "Diretrizes Canônicas de Contribuição"), seção **5 · Padrões de Código Frontend e React 19** — hoje com subseções 5.1–5.5 e **nenhuma** regra de nomenclatura de props.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** Os 3 passos tocam arquivos que nenhum outro plano dos itens 01–13 altera (`CampoBusca`, `linhasComparador`/seções do comparador, `SeletorNota`/`PartidaVotar`); sem conflito de merge esperado. Se o plano 04 (`CampoTexto`) for executado antes, ele **não** altera `CampoBusca` (o doc de origem mantém `CampoBusca` separado).
- **Decisão do dono**: nenhuma pendente — o doc de origem (A4) já define os 4 pontos e o fora de escopo.
- **Restrição de janela**: nenhuma — nenhum passo altera comportamento em runtime. O passo 3 toca `PartidaVotar` (tela de votação); por segurança, preferir executar fora de janela de votação aberta, embora a mudança seja puramente de nome de prop com comportamento idêntico.

## 4. Plano de execução (1 passo = 1 commit)

**Passo 1 — Remover os aliases bilíngues de `CampoBusca` (commit a; zero mudança nos chamadores).**
Arquivo único: `src/components/CampoBusca.tsx`.

1. Na interface `CampoBuscaProps`: remover `value` (`:7-8`), `onChange` (`:11-12`) e `disabled` (`:21-22`), com seus comentários JSDoc de alias.
2. Na destruturação (`:44-61`): remover `value`, `onChange` e `disabled`.
3. `:62` — `const textoAtual = valor ?? value ?? '';` → `const textoAtual = valor ?? '';`
4. `:63` — `const isDisabled = desabilitado ?? disabled ?? false;` → `const isDisabled = desabilitado ?? false;`
5. `:67-68` — remover a linha `onChange?.(novoValor);` (mantém só `aoMudar?.(novoValor);`).
6. `:72-73` — no `handleLimpar`, remover a linha `onChange?.('');` (mantém `aoMudar?.('')` e `aoLimpar?.()`).
7. Nenhum chamador muda (evidência na seção 2). Commit reversível isolado.

**Passo 2 — Renomear `linhasComparador.tsx` → `LinhasComparador.tsx` (commit b).**
Três arquivos:

1. `git mv src/components/linhasComparador.tsx src/components/LinhasComparador.tsx` (preserva histórico no diff).
2. `src/components/SecaoJuntosComparador.tsx:3` — `from './linhasComparador'` → `from './LinhasComparador'`.
3. `src/components/SecaoAdversosComparador.tsx:3` — idem.
4. Conteúdo interno do arquivo **não muda** (a exportação `LinhaAtletaContexto` já está em PascalCase). Commit reversível isolado.

**Passo 3 — `variant` → `variante` em `SeletorNota` (commit c).**
Dois arquivos:

1. `src/components/SeletorNota.tsx`:
   - `:11-17` — comentário e prop `variant?: 'full' | 'compact'` → `variante?: 'full' | 'compact'`;
   - `:34` — destruturação `variant = 'full'` → `variante = 'full'`;
   - `:36` — `const compact = variant === 'compact';` → `variante === 'compact'`.
2. `src/routes/PartidaVotar.tsx:362` — `variant="compact"` → `variante="compact"` (único call site, migrado no mesmo commit).
3. As props `value`, `onChange` e `disabled` do `SeletorNota` permanecem como estão (ver seção 6). Commit reversível isolado.

**Passo 4 — Documentar a convenção de nomenclatura (commit d; só documentação).**
Arquivo único: **`DESIGN.md`** (raiz do repo), seção **5 · Padrões de Código Frontend e React 19**, como nova subseção **5.6 "Convenção de nomenclatura de props"** (seguindo a numeração existente 5.1–5.5; o sumário do topo do `DESIGN.md` é atualizado se listar subseções). Não executar neste plano — aqui só se registra onde e o quê:

- **Props de dado em pt-BR**: `valor`, `rotulo`, `variante`, `desabilitado` quando são conceito do domínio do componente (padrão de `CampoBusca`, `Badge`, `PainelPlacar`).
- **Handlers de evento em `ao*`**: `aoMudar`, `aoLimpar`, `aoAbrir`, `aoFechar` (padrão de `CampoBusca`, `MensagemEstado`).
- **APIs nativas do DOM em inglês**: quando a prop é repassada verbatim a um elemento HTML (`placeholder`, `autoFocus`, `className`, `id`, `name`, `disabled` em wrappers diretos de `<input>`/`<button>`/`<select>` como `SeletorNota`/`Toggle`), manter o nome nativo para preservar a analogia com o elemento.
- Exemplos citando os componentes canônicos deste próprio plano (`CampoBusca`, `Badge`, `SeletorNota`) como referência de cada regra.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no build local (`npm run dev` + `npx tsc --noEmit` para o passo 2 e 3, que mexem em import/nome de prop) e num aparelho:

**Passo 1:**
- [ ] `npx tsc --noEmit` e `npm run lint` passam sem erro novo (prova de que nenhum chamador usava os aliases).
- [ ] Digitar em um campo de busca (ex.: `GestaoJogadores`) e conferir que a lista filtra normalmente (handler dispara **1×** — comportamento idêntico, pois `onChange` nunca tinha chamador).
- [ ] Botão "limpar" (X) do campo de busca esvazia o texto e a listagem.

**Passo 2:**
- [ ] Build passa (import resolvido com a nova capitalização no Windows **e** conferir no CI/`tsc`, que é case-sensitive — no Windows o editor pode aceitar o caminho antigo sem o rename real).
- [ ] Abrir o comparador e conferir que as seções "Juntos" e "Adversos" renderizam as linhas de atleta (`LinhaAtletaContexto`) normalmente.

**Passo 3:**
- [ ] Abrir uma partida aberta para votação (`PartidaVotar`): o seletor de nota aparece no modo compacto (gatilho estreito `w-24` ao lado do nome) e abre/fecha o listbox normalmente.
- [ ] Escolher uma nota e conferir destaque âmbar + haptics como antes.

**Passo 4:**
- [ ] `DESIGN.md` renderiza sem quebra de markdown e a nova subseção aparece no sumário.

## 6. Fora de escopo

- **Não padronizar retroativamente APIs já estabelecidas** — explicitly pelo doc de origem (A4): `open`/`onClose` do `ModalBase` e `checked`/`onChange` do `Toggle` permanecem em inglês; migrá-los seria refactor cosmético amplo (10+ chamadores só no `ModalBase`).
- **Não trocar** `value`/`onChange`/`disabled` do próprio `SeletorNota` (nem de `useListbox`): são espelhos da API nativa de `<select>`/`<input>`, cobertos pela regra "APIs nativas do DOM em inglês" do passo 4.
- **Não renomear** nenhum outro arquivo em minúsculas nem revisar sufixos de card (`DueloCard`/`CardCraquePartida`/`CartaoJogadorEdicao`) ou labels "Assists" — são itens do A10, fora deste plano.
- **Não renomear** hooks/libs ou qualquer arquivo fora de `src/components/` citado nos passos.
- Não criar testes, nem alterar comportamento, estilos, markup ou JSDoc além do mínimo dos passos.

## 7. Riscos e rollback

- **Risco — baixo em todos os passos**: nenhuma mudança de comportamento em runtime; os passos 1 e 3 são renames de prop com todos os call sites conhecidos e confinados (5, 2 e 1 respectivamente).
- **Risco específico do passo 2 — case-sensitivity**: em Windows (FS case-insensitive) o `tsc`/Vite podem resolver `./linhasComparador` mesmo após o rename, mascarando um import esquecido. Mitigação: usar `git mv` (nunca renomear só no editor), conferir `git status` mostrando o rename dos 3 arquivos, e rodar `npx tsc --noEmit`/build no CI (case-sensitive) antes do merge.
- **Risco específico do passo 3 — call site esquecido**: só existe 1 (`PartidaVotar.tsx:362`, confirmado por grep); se surgisse outro futuro, o `tsc` aponta prop desconhecida em modo estrito.
- **Rollback**: cada passo é 1 commit isolado e reversível por `git revert` sem afetar os demais. Reverter o passo 1 restaura os aliases inertes; reverter o passo 2 exige reverter junto os 2 imports (mesmo commit, então um `git revert` único basta); reverter o passo 3 restaura `variant` no `SeletorNota` e no único call site; reverter o passo 4 é só documentação. Nenhum dado, rota ou fluxo funcional é tocado.
