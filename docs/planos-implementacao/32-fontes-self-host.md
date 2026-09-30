# 32 · Fontes self-host — Plano de Implementação

> Ref.: item **B6** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#32 (nota 0,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P3

## ⚠️ CONDICIONAL — critério de ativação (obrigatório antes de executar)

Este plano é **condicional**, como o próprio plano de origem define. O ranking anti-slop nota **0,0** porque não remove nenhuma duplicação: é um item de robustez de PWA, não de qualidade de código.

**Só executar se "primeira execução offline" virar queixa real** — ou seja, se houver relato concreto de usuário instalando o app sem rede e estranhando a ausência/degradação das fontes na primeira abertura. O Service Worker já mitiga o cold start a partir da **2ª** execução (`public/sw.js:199-217`); o custo deste plano (peso de arquivos no bundle, risco de FOUT, verificação de licença) só se justifica diante de demanda confirmada. Sem queixa registrada, o plano permanece arquivado — não deve entrar em nenhuma onda de execução "por completude" (mesma lógica do AGENTS.md: YAGNI).

## 1. Objetivo

Eliminar a dependência de `fonts.googleapis.com` / `fonts.gstatic.com` no carregamento das fontes: baixar os arquivos woff2 das 3 famílias da tríade tipográfica, declará-los com `@font-face` locais e remover os `<link>` do `index.html`. **Sem** fontsource ou qualquer dependência nova — os arquivos passam a ser assets estáticos da própria origem, servidos e cacheados pelo branch de assets do SW. Ganho: cold start sem terceiros (privacidade, latência, resiliência de rede).

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em 2026-09-30 (linhas do doc de origem corretas):

- `index.html:27-32`: dois `<link rel="preconnect">` (`fonts.googleapis.com`, `fonts.gstatic.com` com `crossorigin`) + o `<link rel="stylesheet">` da CSS2 API com a tríade: `Archivo` (ital, wght 400..700), `Barlow Condensed` (600, 700, 800 + itálicas 600, 700) e `Chivo Mono` (400–700), `display=swap`.
- `public/sw.js:199-217`: branch **CacheFirst** dedicado aos hostnames `fonts.googleapis.com`/`fonts.gstatic.com`, cacheando em `CACHE_STATIC` (`racha-static-v3`, linha 15) com fallback offline (503). Este branch fica **código morto** após a migração e deve ser removido.
- `public/sw.js:220-235`: branch de assets da mesma origem (NetworkFirst com fallback a cache, mesmo `CACHE_STATIC`) — é onde os woff2 locais passarão a ser servidos automaticamente, sem alteração de código nesse trecho.
- `public/sw.js:28-37`: `ASSETS_PRECACHE` (install) não inclui fontes hoje — a primeira execução offline continua sem fontes mesmo após este plano (ver §6).
- Tríade tipográfica declarada em `src/index.css:6-8` (`--font-sans: 'Archivo'`, `--font-display: 'Barlow Condensed'` com fallback `'Arial Narrow'`, `--font-mono: 'Chivo Mono'`) e documentada em `DESIGN.md:163-165` (papéis: display para títulos/súmula, sans para corpo, mono para placares/valores) e no checklist de fidelidade `DESIGN.md:520`.
- Observação registrada como débito (não alterar neste plano): `font-black` (900) aparece 42× em `src/`, mas o link atual carrega Barlow Condensed só até 800 e Archivo até 700 — o peso 900 já é sintetizado pelo navegador hoje. O plano mantém **exatamente** os pesos do link atual para não mudar a renderização.

## 3. Pré-condições e dependências

- **Critério de ativação**: queixa real de "primeira execução offline" registrada pelo dono (ver bloco no topo). Sem isso, o plano não executa.
- Nenhum plano do diretório é pré-requisito (item independente; sem sobreposição com os planos 18, 20 e 22, que tocam o `sw.js` em outros trechos).
- Decisão do dono exigida antes de executar: confirmar que o aumento do `dist/` com os woff2 (~150–300 KB brutos, ver §7) é aceito.
- Restrição de janela: nenhum passo toca dados ou comportamento de partida; pode executar a qualquer momento. Evitar deploy junto de outra mudança visual para isolar a validação.

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Baixar os woff2 e a licença

- Baixar das URLs servidas hoje (resposta da CSS2 API de `index.html:30`) os arquivos `.woff2` das 3 famílias, **nos pesos exatos declarados no link atual** (Archivo 400–700 normal+itálico; Barlow Condensed 600/700/800 + itálicas 600/700; Chivo Mono 400/500/600/700).
- Criar `public/fonts/` com nomes explícitos: `archivo-<peso>-<italico>.woff2`, `barlow-condensed-<peso>-<italico>.woff2`, `chivo-mono-<peso>.woff2`.
- Incluir o arquivo de licença OFL de cada família em `public/fonts/` (todas as três são SIL Open Font License — **verificar o LICENSE baixado junto de cada arquivo antes do commit**; se alguma não estiver sob OFL, parar e decidir com o dono).

### Passo 2 — Declarar `@font-face` no `src/index.css`

- Bloco de `@font-face` no topo do arquivo (antes de `@theme`), um por família/peso/itálico, com `font-display: swap` (paridade com o `display=swap` atual) e `url('/fonts/<arquivo>.woff2') format('woff2')`.
- Não alterar os tokens `--font-sans`/`--font-display`/`--font-mono` (linhas 6–8): os nomes de família e os fallbacks (`'Arial Narrow'`, `system-ui`, `monospace`) permanecem idênticos.

### Passo 3 — Remover os `<link>` do `index.html`

- Remover `index.html:27-32` (os dois preconnect e o stylesheet da CSS2 API). Nenhuma outra linha do arquivo muda.
- A partir deste commit as fontes são mesma origem e o branch de assets do SW (`sw.js:220-235`) passa a cachear os woff2 automaticamente na primeira visita online.

### Passo 4 — Remover o branch morto do `sw.js`

- Remover o bloco `public/sw.js:198-217` (condicional de `fonts.googleapis.com`/`fonts.gstatic.com`), que não é mais alcançável.
- Ajustar o comentário do cabeçalho do arquivo (linhas 3-5), que cita "NetworkFirst/CacheFirst para App Shell e Assets", se ficar impreciso.
- **Não** bumpar `CACHE_STATIC` (`racha-static-v3`): nenhum cacheado antigo é invalidado por estas mudanças (os assets locais têm URLs novas, sem conflito).

Ordem rígida: os passos 1–2 precisam preceder o 3 (as fontes locais precisam existir antes de os links caírem); o passo 4 é só limpeza do código morto. Cada passo é revertível por `git revert` isolado.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no build de preview (`npm run build` + preview):

- [ ] DevTools → Network: **nenhuma** requisição a `fonts.googleapis.com`/`fonts.gstatic.com`; os woff2 de `/fonts/` carregam com status 200.
- [ ] Renderização visual: títulos em Barlow Condensed, corpo em Archivo, placares/valores em Chivo Mono — lado a lado com o build anterior (mesmos pesos, sem diferença perceptível; lembrar que 900 já é sintetizado hoje, §2).
- [ ] Fallbacks intactos: bloquear `/fonts/*` no DevTools e conferir que a página degrada para `Arial Narrow`/`system-ui`/`monospace` sem layout quebrado.
- [ ] Offline (2ª visita): DevTools → Offline → recarregar; fontes renderizam a partir do cache (`racha-static-v3`).
- [ ] Peso: comparar o tamanho do `dist/` antes/depois e registrar o delta no commit ou no PR.
- [ ] Tema claro e escuro: fontes idênticas nos dois (não deveria variar, mas é o par padrão de validação do repo).
- [ ] iOS/Safari real (se disponível): fontes carregam — `format('woff2')` e caminho absoluto `/fonts/` são as armadilhas típicas.

## 6. Fora de escopo

- **Fontsource ou qualquer dependência npm** para fontes (o plano de origem explicita "sem fontsource/dependências").
- **Precache das fontes em `ASSETS_PRECACHE`**: mudaria o custo do install para atacar a *primeira* execução offline; se a queixa real for especificamente essa, é uma decisão separada do dono (pesa mais no primeiro acesso).
- Adicionar pesos novos (ex.: Baixo Condensed 900 real para os 42 `font-black`) ou remover pesos não usados — alteraria a renderização atual; registrar como débito à parte, se aplicável.
- Subsetagem, ferramentas de build de woff2, `unicode-range` manuais ou troca de famílias.
- Outros assets de terceiros (não há outros conhecidos no `index.html`).
- Qualquer mudança nos tokens tipográficos de `src/index.css:6-8` ou nos papéis de `DESIGN.md`.

## 7. Riscos e rollback

- **Peso dos arquivos no bundle**: 3 famílias × vários pesos em woff2 podem somar ~150–300 KB brutos no `dist/` (servidos sob demanda pelo navegador, não pelo JS). Mitigação: baixar **só** os pesos do link atual e medir o delta no passo 1 (checklist §5). Rollback: `git revert` do commit do passo 1 remove os arquivos; nenhum passo anterior os referencia ainda.
- **Licença das fontes**: as três famílias são distribuídas via Google Fonts sob SIL OFL, mas a verificação é parte do passo 1 (arquivo LICENSE versionado em `public/fonts/`). Se alguma família não estiver sob OFL, o plano **não prossegue** sem decisão do dono. Rollback: `git revert` do passo 1.
- **FOUT no primeiro load**: hoje o CSS de fontes é third-party com `display=swap`; com `@font-face` local o swap continua, mas o download agora compete com o bundle da própria origem no primeiro acesso. Mitigação: manter `font-display: swap` (paridade) e conferir o item de fallback quebrado no checklist; os fallbacks já declarados (`'Arial Narrow'`, `system-ui`, `monospace`) evitam layout nulo. Rollback: `git revert` do passo 3 restaura o carregamento third-party.
- **Peso/divergência de arquivo errado** (ex.: baixar peso 900 onde hoje é sintetizado): mudaria a renderização silenciosamente. Mitigação: conferência dos pesos no passo 1 contra `index.html:30` e validação visual lado a lado no §5. Rollback: substituição dos woff2 ou `git revert` do passo 2.
- **Branch morto esquecido no SW**: inofensivo em runtime, mas é código morto (anti-padrão). O passo 4 o remove; rollback trivial por `git revert` sem impacto funcional.
