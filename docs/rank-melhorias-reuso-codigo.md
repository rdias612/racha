# Ranking das Melhorias do Plano PWA — Ganho em Redução de Code Slop / Duplicação / Reuso

> Complemento ao `docs/plano-melhorias-frontend-pwa.md`. Reordena **todas** as propostas daquele plano por um critério único e diferente do prioridade global do plano: **o quanto cada item reduz código duplicado/slop e aumenta reuso**, ignorando ganho de UX, PWA ou acessibilidade (que continuam valendo pelo critério original do plano).
>
> Método: as evidências de duplicação do plano foram reconfirmadas por grep sobre `src/` (contagens na coluna "Duplicação eliminada"). Nenhuma contagem divergiu do plano consolidado. Nenhum código foi alterado — este documento é o único artefato.

---

## 1. Critério de pontuação

Cada proposta recebeu uma nota de **ganho anti-slop (0–10)** somando três fatores:

| Fator | Peso | O que mede |
|---|---|---|
| **Volume** | 50% | Quantas linhas/call sites duplicados a proposta elimina de fato. |
| **Drift** | 30% | Risco de divergência hoje: a cópia já divergiu, ou cada correção futura precisa ser feita N vezes (ou será esquecida em silêncio)? |
| **Reuso** | 20% | O que a proposta cria vira infraestrutura reutilizável por código futuro (em vez de replicar o padrão de novo)? |

Itens puramente funcionais (UX, PWA, acessibilidade) tendem a nota baixa aqui **sem deixarem de ser valiosos pelo critério do plano original** — a tabela seção 4 deixa isso explícito.

---

## 2. Ranking geral

### Tier 1 — Ganho alto (atacam a maior duplicação real do código)

| # | Proposta (ref. plano) | Nota | Duplicação eliminada | Justificativa |
|---|---|---|---|---|
| 1 | **A1 · `CabecalhoSumula`** (P0) | **9,5** | ~200 LOC do mesmo bloco editorial em **22–23 arquivos** (confirmado: 23 arquivos contêm `sumula-header`); 4 cópias byte-idênticas no módulo notificações | Maior duplicação literal do app, já com **drift visível** (`font-black` só em `GestaoGoleiros`, `h1 text-2xl` vs `h2 text-xl` sem hierarquia). Cria a primitiva mais reutilizada do app — toda tela nova consome o cabeçalho. 1 ponto de mudança para o elemento mais recorrente. |
| 2 | **A2 · `Botao` com variantes** (P1) | **9,0** | **131 `<button>`** estilizados à mão (confirmado); fórmula do primário colada em ~29 usos (25 `<button>` + 4 CTAs-Link); 3 pares cancelar/confirmar + 4 rodapés de modal duplicados | Maior duplicação **em volume**. Drift real e documentado (`disabled:opacity-40` vs `-50`, `shadow-carimbo` vs `-destaque`). O componente (ou constantes) transforma alvo de 44px e foco âmbar em invariantes gratuitos — cada botão futuro nasce correto. |
| 3 | **D1 · Helper de invalidação pós-mutação** (P0) | **8,5** | Par `invalidarCache(CHAVE_JOGOS) + chaveResumo(...)` copiado em **7 call sites / 6 rotas** | É o slop mais perigoso do repo: a duplicação não é visual, é **comportamental** — esquecer um site gera tela obsoleta em silêncio. Esforço de meio dia, risco mínimo, e cria o ponto único onde chaves futuras (elenco, realtime do plano próprio) entram sem tocar 7 arquivos. Melhor custo/benefício do ranking. |
| 4 | **A3 · `CampoTexto`/`CampoTextoLongo`** (P1) | **8,0** | Par `label + input/textarea` repetido **26×** em 5 arquivos (~120 LOC); o próprio código já criou constante local `INPUT_CLASS` em `FormEventoAutomatico.tsx:19` sinalizando a duplicação | Duplicação densa e confinada (5 arquivos), com invariante de comportamento (anti-zoom 16px) que hoje depende de cópia fiel. A constante local existente é a prova de que o código já pediu essa extração. |

### Tier 2 — Ganho médio (eliminam boilerplate duplicado ou reimplementação de infra existente)

| # | Proposta (ref. plano) | Nota | Duplicação eliminada | Justificativa |
|---|---|---|---|---|
| 5 | **D2 · Elenco/derivados via `useCache`** (P1) | **7,0** | Boilerplate `useEffect`+`useState` de fetch duplicado em **~15 call sites / 10 arquivos**; 4+ fetches do mesmo elenco na mesma sessão de navegação | Não é duplicação de código idêntico, é o **mesmo padrão reinventado 15 vezes**. A infraestrutura (`useCache`) já existe e é superior; migrar transforma cada tela em 1 linha declarativa. Ganho duplo: menos código e menos requisição. Nota menor que Tier 1 porque exige desenhar invalidação correta (risco de stale). |
| 6 | **D3 · Aposentar `geracaoRef` manual** (P1) | **6,5** | Proteção anti-resposta-obsoleta reimplementada à mão com **14 refs** em 3 arquivos (`EstatisticasRacha`, `Estatisticas`, `BannerLembrete`) — exatamente o que `useCache.ts:70-77,131-139` já faz | Slop clássico de "reinventei o hook": código delicado de concorrência copiado manualmente, impossível de corrigir centralizadamente. Migração por arquivo, começando pelo caso trivial (`EstatisticasRacha`). |
| 7 | **D5 · Queries fora da `lib` → `lib`** (P2) | **6,0** | 4 queries Supabase escritas inline em componentes (`Jogos`, `Ranking`, `BannerLembrete`, `PartidaNova`) fora do padrão estabelecido dos 39 RPCs | A duplicação aqui é de **inconsistência arquitetural**: o padrão "tela → lib → supabase" existe e 4 sites fogem dele. Transposição mecânica e **pré-requisito do D2** (queries fora da lib não são cacheáveis). Ganho próprio moderado, ganho sistemático alto. |
| 8 | **A5 · `DialogoEvento` → `ModalBase`** (P2) | **5,5** | **Terceira implementação completa do shell de modal** (portal, overlay, focus trap, ARIA duplicados de `ModalBase`) | Duplicação estrutural inteira, não de trecho: qualquer correção de a11y no shell canônico não chega ao `DialogoEvento`. Elimina a última cópia do shell (ConfirmDialog fica por decisão do plano). Nota menor só pelo risco médio (tela de gols ao vivo) e escopo de 1 arquivo. |
| 9 | **A6 · Peças das listas financeiras** (P2) | **5,5** | `COR_TIPO` exportada de um componente de UI e importada por outro (acoplamento invertido); linha de metadados de lançamento duplicada entre Receitas e Despesas | Slope pequeno em volume, mas de má qualidade: constante de domínio morando em componente de UI é o tipo de acoplamento que se multiplica. Extração para `lib` devolve a responsabilidade ao lugar certo. O rodapé "Fechar" cai de graça com o A2. |
| 10 | **D4 · Tipos derivados de `database.types.ts`** (P2) | **5,0** | Interfaces hand-written + casts sobrescrevendo o que o gerador já produz (`ParRacha` em `partidas.ts:137-148`, tipos locais em `Jogos.tsx`, `Ranking.tsx`) | Duplicação de **tipo**, não de código executável — o drift de migration compila sem erro hoje. Elimina interfaces inteiras por derivação de 1 linha, por módulo, incremental. Ganho real de slop, mas silencioso (não aparece em runtime). |

### Tier 3 — Ganho baixo (higiene pontual; valem por custo quase zero)

| # | Proposta (ref. plano) | Nota | Duplicação eliminada | Justificativa |
|---|---|---|---|---|
| 11 | **A8 · Chip "mini" no `Badge`** (P2) | **4,0** | ~10 chips de 9px recriando manualmente a assinatura do `Badge` | Duplicação real mas rasa (classes repetidas, sem lógica). A solução correta (prop no Badge, sem componente `Chip` novo) evita criar a segunda abstração — é anti-slop também na forma. |
| 12 | **C3 · Token `--cor-scrim`** (P2) | **3,5** | 3 overlays hardcoded (`bg-black/75`, `bg-black/70`, `bg-black/70`) + o único `dark:` do app | Valor mágico repetido 3× com drift de opacidade. Unifica num token e mata o `dark:` órfão. Impacto mínimo, custo mínimo. |
| 13 | **C4 · Remoção de tokens/dados mortos** (P2) | **3,5** | `--cor-oliva`, `--cor-led-fundo-hover` (zero usos), campo `cor` de `TIMES` (zero consumo) | Não elimina duplicação — elimina **código morto**, a outra face do slop. Trivial, risco zero. Ganho limitado porque é pontual. |
| 14 | **A4 · Higiene de nomenclatura** (P1) | **3,0** | Aliases bilíngues mortos em `CampoBusca` (código morto), `variant` vs `variante` (divergência de API) | Metade é remover código morto, metade é prevenir duplicação de convenção para código novo. Zero risco, mas quase zero volume. |
| 15 | **A7 · `PilulaFiltro`** (P2) | **2,5** | Ternário de pílula ativa/inativa em 3 lugares | O próprio plano admite o teto: só 3 usos, sem drift relatado. É o limite exato abaixo do qual extrair componente é abstração prematura (AGENTS.md: DRY com critério). Manter como débito, não como backlog. |

### Tier 4 — Ganho ~zero em slop (funcionais; ranquear aqui não diminui o mérito pelo critério original do plano)

| # | Proposta (ref. plano) | Nota | Por que quase não mexe em duplicação |
|---|---|---|---|
| 16 | **E3 · Retry/PTR/haptics nas telas de partida** (P1) | 2,5 | Composição de primitivas **existentes** (`Estado`+prop `acao`, `PullToRefresh`, `haptics`) — adiciona comportamento, não remove cópia. A prop `acao` em `MensagemEstado` evita que retry seja reimplementado por tela (único efeito anti-slop, e preventivo). |
| 17 | **A9 · Pasta `ui/`** (P3) | 2,0 | Organização, não deduplicação. Valor: impedir que a raiz de componentes inche com as extrações dos Tiers 1–2. Executar **junto** do A1/A2/A3, nunca isolado. |
| 18 | **B1 · Revalidar ao voltar online** (P0) | 1,5 | ~2 linhas reusando a invalidação existente. Zero slop removido; é o P0 mais barato do plano pelo critério original, e a ordem do plano (Fase 1) continua correta. |
| 19 | **C1 · 44px nos CTAs-Link** (P1) | 1,0 | 2 pontos de correção. O seletor global já existe; é preencher lacuna, não unificar. |
| 20 | **B3 · Aviso de nova versão** (P1) | 1,0 | ~15 linhas novas seguindo padrão de ouvintes existente. Código novo, não duplicado. |
| 21 | **E1 · Cédula sinal honesto** (P1) | 1,0 | UX de fluxo de votação; estado derivado novo. |
| 22 | **B4 · Poda de `/assets/*`** (P2) | 1,0 | ~8 linhas novas no `sw.js`; corrige acumulação, não duplicação. |
| 23 | **C2 · Tokens `ok-texto`/`perigo-texto`** (P1) | 1,0 | Replica o mecanismo consagrado do âmbar para 2 cores — o mecanismo já é padrão do repo; migrar ~15-20 usos é troca de token, não deduplicação. Importante por acessibilidade, neutro aqui. |
| 24 | **E2 · Painel da Semana** (P1) | 1,0 | Adiciona UI nova (reusa haptics/otimização existentes, o que é bom reuso, mas não remove slop). |
| 25 | **E4 · Ranking "sua posição"** (P1) | 0,5 | Feature nova de UI. |
| 26 | **E5 · Perfil + Minhas Dívidas** (P2) | 0,5 | Feature nova; apoia roadmap do dono sem duplicá-lo. |
| 27 | **E6 · Filtro por status no mural** (P2) | 0,5 | Feature nova; reusa padrão de chips do Ranking. |
| 28 | **B5 · Manifest `shortcuts`** (P3) | 0,5 | 12 linhas de JSON. |
| 29 | **C5 · DESIGN.md em ordem** (P2) | 0,5 | Só doc — mas o comentário cruzado dos hexes duplicados (`tema.ts` ↔ `index.html` ↔ manifest) é prevenção de drift barata. |
| 30 | **E7 · Micro-ajustes de feedback** (P3) | 0,5 | Ajustes pontuais. |
| 31 | **C6 · Detalhes finos** (P3) | 0,5 | Pontuais, "ao tocar o arquivo". |
| 32 | **B6 · Fontes self-host** (P3) | 0,0 | Condicional a queixa real; não remove nada. |
| 33 | **B7 · Bundle inicial** (P3) | 0,0 | Decisão explícita de **não mexer**. |
| 34 | **A10 · Débitos registrados** (P3) | 0,0 | Registro de débito, não execução. |

---

## 3. Leitura prática — como este ranking muda (ou não) a ordem do plano

1. **Os dois critérios convergem no topo**: D1 e A1 são P0 no plano e 1º/3º aqui. Se o objetivo for uma passada anti-slop pura, a ordem eficiente dentro da Fase 1/2 é **D1 → A1 → A2 → A3** — as quatro maiores duplicações do repo em quatro commits independentes.
2. **O que sobe de prioridade relativa**: D3 e D5 (P1/P2 no plano, mas quase "grátis" em risco e desbloqueiam o D2 — a cadeia D5 → D2 → D3 é a única sequência com dependência real entre itens e rende a maior eliminação de boilerplate por commit).
3. **O que desce (aqui, não no plano)**: E2, E4, E5, E6, C2 e os P3 funcionais não têm valor anti-slop — devem continuar no roadmap pelo valor de produto, mas **fora** de qualquer época dedicada a redução de duplicação.
4. **Cuidado com o A7** (`PilulaFiltro`): é o único item "de extração" que o próprio plano limita. Numa onda anti-slop é tentador incluí-lo; com 3 usos e sem drift, extrair hoje seria criar abstração sem demanda — exatamente o que o AGENTS.md manda evitar.
5. **Sinergias que reduzem o custo total**: A2 puxa de graça os 4 rodapés "Fechar" e o par de `ConfirmDialog`; A6 sai mais barato depois do A2; A9 (pasta `ui/`) custa ~zero se executado no mesmo commit de criação de A1/A2/A3.

---

## 4. Resumo em uma linha por tier

- **Tier 1 (notas 8–9,5)**: A1, A2, D1, A3 — atacam ~450+ LOC de duplicação literal e o slop de maior risco silencioso do repo, todos com risco de execução baixo.
- **Tier 2 (5–7)**: D2, D3, D5, A5, A6, D4 — eliminam reimplementação de infraestrutura que já existe (`useCache`, `ModalBase`, padrão lib) e desacoplam domínio de UI.
- **Tier 3 (2,5–4)**: A8, C3, C4, A4, A7 — higiene pontual; fazer só "ao tocar o arquivo", como o plano já manda.
- **Tier 4 (≤2,5)**: tudo que é feature/UX/PWA — valiosos pelo plano original, neutros para este critério.
