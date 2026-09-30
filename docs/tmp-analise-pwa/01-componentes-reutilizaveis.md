# Análise de Componentes Reutilizáveis e Redução de Duplicação — Racha Gragoatá CBO

> Subanálise do frontend (etapa 01 do dossiê PWA). Foco: arquitetura de componentes reutilizáveis, duplicação de UI inline nas rotas e organização de `src/components/`.
> Ótica de uso: **PWA instalado no celular, mobile-first total** — desktop é secundário.
> Método: o catálogo `.superdesign/init/` foi usado como mapa inicial, mas **toda evidência abaixo foi verificada no código-fonte real** (caminho:linha). Nenhum código foi alterado nesta etapa.

---

## 1. Resumo executivo — top 5 propostas

| # | Proposta | Problema hoje | Ganho estimado | Esforço | Prioridade |
|---|---|---|---|---|---|
| 1 | **Extrair `CabecalhoSumula`** (cabeçalho editorial de tela) | Mesmo bloco markup repetido inline em **18 das 22 rotas** + 3 componentes + 7 espelhos em Skeletons (~200 LOC) | 1 ponto único de mudança para a identidade visual mais frequente do app | M | **P0** |
| 2 | **Extrair `Botao`** com variantes (primário âmbar / secundário / perigo) | Não existe botão compartilhado: **131 `<button>`** estilizados à mão; padrão primário repetido **~30× em 21 arquivos**, par cancelar/confirmar reimplementado em 3+ lugares | Maior eliminação de duplicação do codebase; garante alvo 44px e focus âmbar consistentes | M | **P0** |
| 3 | **Extrair `CampoTexto` / `CampoTextoLongo`** (label + input/textarea) | Par `label + input` repetido **26×** em 5 arquivos; `FormEventoAutomatico` já criou constante local de classes (sinal de necessidade) | ~120 LOC, consistência anti-zoom iOS (text-base sm:text-sm) em um ponto | S | **P1** |
| 4 | **Migrar `DialogoEvento` para `ModalBase`** + extrair rodapé "Fechar" | 3 implementações paralelas do shell de modal (portal + focus trap + overlay): `ModalBase`, `ConfirmDialog` e `DialogoEvento`; botão "Fechar" de rodapé duplicado em 4 modais | Um só caminho de acessibilidade/manutenção de modais | S–M | **P2** |
| 5 | **Higiene de nomenclatura (débito registrado, ação pequena)** | Props bilíngues mortas (`CampoBusca` aceita `valor`/`value`, `aoMudar`/`onChange`, `desabilitado`/`disabled` — 5/5 chamadores usam só o par pt-BR); `variant` vs `variante`; `linhasComparador.tsx` em minúsculas | Remover 3 aliases mortos; padrão único documentado para novas props | S | **P1** |

Tese central: o projeto **já tem uma camada de primitivas sólida** (Estado 31 importadores, BotaoVoltar 14, ConfirmDialog 10, Skeletons 10, Snackbar 9, PullToRefresh 7, Badge 7, ModalBase 6) — mas há **três famílias de UI que nunca viraram componentes** (cabeçalho editorial, botões, campos de formulário) e que concentram a maior parte da duplicação inline nas rotas. As extrações propostas seguem o padrão que o projeto já estabeleceu (componente nomeado em pt-BR, props semânticas, tokens do tema), sem introduzir biblioteca ou camada nova.

---

## 2. Estado atual mapeado

### 2.1 Inventário de `src/components/` (63 arquivos .tsx, ~10,4k LOC) e rotas (23 arquivos, ~5k LOC)

**Primitivas realmente compartilhadas** (nº de arquivos importadores, verificado por grep de imports):

| Componente | Importadores | LOC | Papel |
|---|---|---|---|
| `Estado` (Carregando + MensagemEstado) | 31 | 89 | Loading + banners erro/sucesso/info |
| `BotaoVoltar` | 14 | 53 | Retorno com navegação defensiva |
| `ConfirmDialog` | 10 | 92 | Confirmação centralizada com focus trap |
| `Skeletons` (11 exports) | 10 | 482 | Skeleton por tela (CLS=0) |
| `Snackbar` | 9 | 80 | Toast com haptics e auto-dismiss |
| `PullToRefresh` | 7 | 149 | Wrapper pull-to-refresh |
| `Badge` | 7 | 102 | Status/posição/variante (polimórfico) |
| `ModalBase` | 6 | 134 | Modal canônico (portal + focus trap + bottom-sheet) |
| `BarraAcaoInferior` | 5 | 36 | CTA fixa de fluxo focado |
| `CampoBusca` | 5 | 112 | Busca com limpar |
| `AbasNotificacoes` / `AbasEstatisticas` | 4 / 3 | 41 / 46 | Abas NavLink com prefetch |
| `CabecalhoTime` / `PainelPlacar` | 3 / 3 | 84 / 161 | Identidade preto/branco e placar LED |
| `Toggle`, `Logo`, `BadgeTime`, `StatBox`, `linhasComparador`, `SelectSumula`, `CardNotificacoes`, `ModalNovoGoleiro`, `ListaReceitasAbertas` | 2 | — | Uso duplo |
| Demais (~30 componentes de domínio) | 1 | — | Seções de tela (Secao*, Form*, Modal* específicos, Linhas, Cards) |

**Observações do inventário:**
- `ErrorBoundary` é importado apenas por `src/main.tsx:5` (uso único por design — ok).
- `StepperBox` (79 LOC) é usado só por `CartaoJogadorEdicao` (3×); `Toggle` só pelas duas `SecaoNotificacao*` — baixo alcance atual, sem problema funcional.
- Os 22 rotadores lazy estão centralizados em `src/lib/rotas.ts` (22 exports `lazy` verificados); `src/routes/` tem 23 arquivos (as 22 telas + `Layout.tsx`).
- ~30 componentes com 1 único importador são **seções de tela legítimas** (fatoram a rota grande) — não são código morto nem candidatura automática a extração.

### 2.2 Duplicação inline nas rotas — evidências

#### (A) Cabeçalho editorial de tela — a maior duplicação estrutural

O bloco `sumula-header` (linha pontilhada 2px do design system "Súmula de Quinta") + kicker mono + título `font-display` uppercase aparece **inline e repetido com pequenas variações**:

- **18 rotas**, cada uma com sua própria cópia (~9–14 linhas por cópia, ~200 LOC no total):
  - `src/routes/Resumo.tsx:123` (variante h1 `text-2xl`, kicker **acima** do título)
  - `src/routes/Jogos.tsx:110`, `src/routes/Ranking.tsx:223`, `src/routes/Estatisticas.tsx:163`, `src/routes/EstatisticasRacha.tsx:148`, `src/routes/Comparador.tsx:205` (padrão h2 `text-xl` + meta à direita "Oficial CBO")
  - `src/routes/Administrador.tsx:199` (ícone `Wallet` antes do título), `src/routes/GestaoJogadores.tsx:286` (ícone + subtítulo mono abaixo), `src/routes/GestaoGoleiros.tsx:184` (único com `font-black` + borda extra)
  - `src/routes/NovoJogador.tsx:98`, `src/routes/PartidaNova.tsx:187`, `src/routes/PartidaDetalhe.tsx:171`, `src/routes/PartidaAoVivo.tsx:244` (subtítulo com data abaixo), `src/routes/PartidaVotar.tsx:286` (countdown no slot direito)
  - `src/routes/NotificacoesConfirmacao.tsx:136`, `src/routes/NotificacoesVotacao.tsx:103`, `src/routes/NotificacoesTestes.tsx:124`, `src/routes/NotificacoesSaude.tsx:70` (bloco idêntico copiado 4× nas quatro telas do módulo)
- **3 componentes** usam a mesma assinatura como cabeçalho de **seção**: `src/components/ListaReceitasAbertas.tsx:62`, `src/components/ListaDespesasAbertas.tsx:25`, `src/components/EscalacaoTimesEditor.tsx:231`.
- **7 espelhos** em `src/components/Skeletons.tsx` (linhas 17, 60, 100, 145, 189, 362, 413) recriam a geometria do cabeçalho para CLS=0.

Variações reais observadas entre as cópias (o que a extração precisa parametrizar): nível do título (`h1`/`h2`/`h3`), peso (`font-bold` vs `font-black` em GestaoGoleiros:190), kicker acima vs abaixo, ícone opcional, e um **slot à direita** (meta "Oficial CBO", contador, countdown, badge). Nada que um componente com 4–5 props não resolva — o padrão já está catalogado no init como `HeaderSumula` (`.superdesign/init/extractable-components.md:14-19`).

#### (B) Botões estilizados à mão — não existe componente `Botao`

Contagem verificada: **131 `<button>`** no app (39 em `src/routes/`, 92 em `src/components/`). Nenhum botão compartilhado; cada tela repõe a receita de classes:

- **Primário âmbar** `bg-destaque text-destaque-tinta` (+ `min-h-[44px]`, `font-display uppercase tracking-wider text-xs`, `shadow-carimbo`, `active:translate-y-px`): **~31 ocorrências em 21 arquivos** — ex. `src/routes/Ranking.tsx` (5×), `src/routes/GestaoJogadores.tsx` (4×), `src/components/DialogoEvento.tsx` (3×), `src/components/ModalFiltrosRanking.tsx:108`, `src/components/FormLancamentoFinanceiro.tsx:221-236`, `src/components/ModalNovoGoleiro.tsx:129-136`.
- **Par cancelar/confirmar** (secundário neutro + primário) reimplementado com classes quase idênticas em `src/components/ConfirmDialog.tsx:67-86`, `src/components/ModalFiltrosRanking.tsx:90-113` e `src/components/FormLancamentoFinanceiro.tsx:221-236`.
- **Secundário neutro** (`border border-borda bg-superficie(-2)` + mesma tipografia): ~19 ocorrências, incluindo o botão "Fechar" de rodapé de modal repetido em **4 modais** com a mesma receita: `ModalSelecionarOpcao.tsx:50-58`, `ModalSelecionarGoleiro.tsx:67-75`, `ModalSelecionarAgendamento.tsx:78-82`, `ModalEscalarJogador.tsx:52-62` (variante alinhada à direita).
- **Destrutivo** `bg-perigo`/`border-perigo text-perigo`: presente em 17 arquivos (nem todos são botões — Badge/Estado/Snackbar usam a cor para outros papéis).
- A assinatura base de 44px (`min-h-[44px]`) aparece em **59 arquivos** — é o maior acoplamento implícito do design system, mantido por memorização, não por componente.

#### (C) Campos de formulário

- Par `label` (span `text-xs font-display uppercase tracking-wider text-giz-fraco mb-1`) + input estilizado: **26 repetições** em 5 arquivos — `FormEventoAutomatico.tsx` (9), `FormLancamentoFinanceiro.tsx` (7, ex.: linhas 121-148, 150-160, 162-176, 178-188, 190-201, 203-218), `SecaoNotificacaoConfirmacao.tsx` (6, ex.: 128-140, 142-154, 195-207, 209-221), `SecaoNotificacaoVotacao.tsx` (2, 180-206), `SecaoExportacaoFinanceira.tsx` (2).
- `src/components/FormEventoAutomatico.tsx:20` já define **constante local** `w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 ... focus-visible:outline-2 ...` — o próprio autor sentiu a duplicação e resolveu no escopo do arquivo.
- 3 `<textarea>` com receita idêntica (`SecaoNotificacaoConfirmacao.tsx:146,213`, `SecaoNotificacaoVotacao.tsx:198`).
- `ModalNovoGoleiro.tsx:73-118` tem 3 campos seguidos com o mesmo bloco de ~14 linhas.
- Nota: `SelectSumula` (listbox custom) e `ModalSelecionarOpcao` existem, mas **5 `<select>` nativos estilizados inline** sobrevivem: `src/routes/Estatisticas.tsx:183`, `src/routes/NovoJogador.tsx:156,180`, `src/components/DialogoEvento.tsx:94`, `src/components/SeletorAtletasComparador.tsx:30,52`. Débito registrado (ver §4 — não migrar cegamente; o nativo com `optgroup` tem valor aqui).

#### (D) Família de modais

Três shells de modal coexistem:

1. `ModalBase.tsx:63-133` — canônico: portal, overlay `bg-black/75 backdrop-blur-xs`, `useModalA11y`, bottom-sheet/centro, header, rodapé. **6 modais o reutilizam** (ModalEscalarJogador, ModalNovoGoleiro, ModalFiltrosRanking, ModalSelecionarAgendamento, ModalSelecionarGoleiro, ModalSelecionarOpcao).
2. `ConfirmDialog.tsx:39-91` — reimplementa o mesmo esqueleto (portal + overlay + `useModalA11y` + transição `opacity/scale`) com conteúdo fixo. É deliberadamente mais simples, mas é uma **segunda cópia do shell**.
3. `DialogoEvento.tsx:59-76` — **terceira cópia** do shell (overlay `bg-black/70`, `useModalA11y`, role/aria/tabIndex/`onKeyDown` iguais, transição `translate-y` em vez de `scale`), com fluxo de duas etapas e 6 botões internos. Não tem header, mas nada impede `ModalBase` com `mostrarBotaoFechar={false}`.

Além disso, os 6 modais que usam `ModalBase` repetem nos **rodapés** o botão "Fechar"/"Cancelar"/par de ações (ver §2.2-B).

#### (E) Cards, linhas e chips

- **Card shell** `rounded-[4px] border border-borda bg-superficie ... shadow-carimbo text-giz`: **138 ocorrências em 49 arquivos** (ex. `DueloCard.tsx:14`, `DuplaCard.tsx:23`, `CardCraquePartida.tsx:9`, `LinhaJogadorGestao.tsx:36`, `CartaoJogadorEdicao.tsx:30`, `ConfirmacoesPartida.tsx:268`, `FormLancamentoFinanceiro.tsx:87`). É o idioma visual do app — mas é *coincidência de token*, não duplicação de lógica (ver §4).
- **Chips de metadado** `rounded-[2px] border px-1.5 py-0.5 text-[9px] font-display uppercase...`: ~10 ocorrências, concentradas em `LinhaJogadorGestao.tsx` (6: linhas 50, 57, 66, 72, 76, 81), `ListaReceitasAbertas.tsx:107,151` e `ListaDespesasAbertas.tsx:51`. O `Badge.tsx:86-87` já tem a mesma assinatura com `text-[10px]` — os chips de 9px são uma variante "mini" não parametrizada.
- **Linha meta de lançamento financeiro** (Badge de natureza + chip de tipo + ref + data): duplicada entre `ListaReceitasAbertas.tsx:148-163` e `ListaDespesasAbertas.tsx:48-63`. Pior: o mapa de cores `COR_TIPO` é **exportado de um componente e importado por outro** (`ListaReceitasAbertas.tsx:15-22` → `ListaDespesasAbertas.tsx:4`) — constante de domínio morando em componente de UI.
- **Pílulas de filtro** (chip ativo âmbar/inativo neutro com o mesmo ternário): `GestaoJogadores.tsx:322-360` (5 botões colados), `ModalEscalarJogador.tsx:74-97` (5 botões), `ModalFiltrosRanking.tsx:121-149` (grid de posição) e presets `:175-196`.
- **Acordeões** (`ChevronDown` + `rotate-180`): 7 arquivos, mas de dois tipos distintos — dropdown de listbox (`SelectSumula`, `SeletorNota`) e acordeão de conteúdo (`ListaReceitasAbertas`, `SecaoNotificacaoVotacao:158-210`, `SecaoNotificacaoSaude`, menu do `Layout`, `Login`). Só os de conteúdo são padrão comum real (3 ocorrências).

#### (F) Nomenclatura e organização (débitos registrados)

- **Props bilíngues mortas em `CampoBusca.tsx:4-22,62-75`**: aceita `valor` **ou** `value`, `aoMudar` **ou** `onChange`, `desabilitado` **ou** `disabled`. Verificado: os 5 chamadores (`GestaoGoleiros.tsx:215`, `GestaoJogadores.tsx:313`, `PartidaNova.tsx:237`, `ModalEscalarJogador.tsx:66`, `ModalSelecionarGoleiro.tsx:79`) usam **exclusivamente** `valor/aoMudar` — os aliases ingleses são código morto.
- **Mistura de idioma nas APIs** (sem aliases, cada componente escolheu um): `ModalBase` usa `open/onClose` + `titulo` (inglês+pt); `Toggle.tsx:5-7` usa `checked/onChange`; `SeletorNota.tsx:6-8` usa `value/onChange`; `StatBox.tsx:5-7` usa `label/value`; `SelectSumula` usa `value/onChange`. Já `CampoBusca`, `ConfirmDialog` (`textoConfirmar`, `tomConfirmar`) e `ModalBase` (`titulo`, `rodape`) são pt-BR. Não há convenção documentada.
- **`variante` vs `variant`**: `Badge.tsx:20`, `CabecalhoTime.tsx:10`, `CampoBusca.tsx:24`, `PainelPlacar.tsx:5` usam `variante`; `SeletorNota.tsx:17` usa `variant`.
- **`linhasComparador.tsx`** em minúsculas (único arquivo fora do PascalCase; 2 importadores: `SecaoJuntosComparador`, `SecaoAdversosComparador`).
- **Sufixos de card inconsistentes**: `DueloCard`/`DuplaCard` (sufixo `Card`), `CardCraquePartida` (prefixo), `CartaoJogadorEdicao` (tradução "Cartao" sem acento).
- **Todos os 63 componentes soltos na raiz de `src/components/`** — sem separação entre primitivas genéricas e componentes de domínio de tela.
- Textos residuais em inglês na UI: labels "Assists" em `Estatisticas.tsx:207`, `Perfil.tsx:189` e `CartaoJogadorEdicao.tsx:95` (o resto do app usa pt-BR).

---

## 3. Propostas priorizadas

> Critério de ordenação: maior ganho de manutenção × menor risco primeiro, respeitando AGENTS.md (mudanças pequenas, sem nova biblioteca, preservar arquitetura). Cada extração é independente e pode ser feita e revisada isoladamente.

### P0-1 — Extrair `CabecalhoSumula`

- **Problema**: bloco de cabeçalho editorial copiado em 18 rotas + 3 componentes (~200 LOC repetidas), com 4 telas do módulo notificações carregando cópias byte-idênticas entre si (`NotificacoesConfirmacao.tsx:136`, `:103` da Votacao, `:124` da Testes, `:70` da Saude). Qualquer ajuste tipográfico (ex.: mudar `text-xl`, ou o tracking do kicker) exige editar 21+ arquivos.
- **Proposta**: componente `src/components/CabecalhoSumula.tsx` com props: `titulo: ReactNode`, `kicker?: string` (posicionado abaixo do título, o caso mais comum — 16/18 rotas), `icone?: ReactNode`, `acao?: ReactNode` (slot direito), `tamanho?: 'md' | 'lg'` (md = `text-xl` h2, lg = `text-2xl` h1 do Resumo), `nivel?: 'h1' | 'h2' | 'h3'`. Mantém `sumula-header` e as classes atuais; o `BotaoVoltar` **continua fora** do componente (hoje ele fica separado do bloco em todas as rotas — preservar isso evita mudar layout). Migração mecânica rota por rota, sem mudança visual. Os skeletons de `Skeletons.tsx` **não** são migrados (ver §4).
- **Benefício**: 1 ponto de mudança para o elemento visual mais recorrente do app; consistência do kicker/meta que hoje oscila; reduz ~200 LOC das rotas.
- **Esforço**: **M** (criar componente é S; tocar 21 arquivos é o custo).
- **Risco**: **baixo** — markup puro, sem estado nem comportamento; diffs são deletar JSX inline e usar props. Único cuidado: a variante do `GestaoGoleiros` (`font-black` + `border-b`) pode manter `className` extra por prop de classe.

### P0-2 — Extrair `Botao` (primário / secundário / perigo)

- **Problema**: 131 `<button>` à mão; a receita do primário âmbar repete ~30× em 21 arquivos e o par cancelar/confirmar é copiado em `ConfirmDialog`, `ModalFiltrosRanking` e `FormLancamentoFinanceiro`. Riscos concretos já visíveis: `disabled:opacity-40` em uns, `disabled:opacity-50` em outros; `shadow-carimbo` vs `shadow-carimbo-destaque` vs `shadow-xs` sem regra explícita; focus outline omitido em alguns botões de `DialogoEvento` (ex.: `DialogoEvento.tsx:155,205`).
- **Proposta**: `src/components/Botao.tsx` — `Botao` com `variante?: 'primario' | 'secundario' | 'perigo'` (default `primario`), `larguraCompleta?: boolean`, e spread de props nativas de `<button>` (type, disabled, onClick, aria-*, title). Classes = assinatura comum atual (44px, `rounded-[4px]`, `font-display uppercase tracking-wider text-xs font-bold`, `active:translate-y-px`, focus âmbar). **Migração incremental**: começar pelos pontos onde o par duplicado existe (`ConfirmDialog.tsx:67-86`, `ModalFiltrosRanking.tsx:90-113`, `FormLancamentoFinanceiro.tsx:221-236`), depois os 4 rodapés "Fechar" dos modais, e os demais arquivos quando tocados — sem big-bang.
- **Benefício**: elimina a maior duplicação em volume; padroniza acessibilidade (focus outline e alvo 44px viram invariantes do componente, não memória do autor); reduz risco de divergência visual entre telas do admin.
- **Esforço**: **M** (componente S; migração completa L, mas incremental e opcional — só os 3 pares + 4 rodapés já capturam ~40% do ganho).
- **Risco**: **baixo-médio** — classes com variações pequenas entre cópias; a saída é aceitar a variante canônica (diferenças de 1 classe em sombra/opacity) e usar `className` de escape nos raros casos que precisam do ajuste fino. Nenhuma mudança de comportamento.

### P1-3 — Extrair `CampoTexto` e `CampoTextoLongo`

- **Problema**: 26 repetições do par label+input e 3 textareas com a mesma receita; o `FormEventoAutomatico.tsx:20` já mantém constante local de classes (duplicação reconhecida pelo próprio código).
- **Proposta**: `CampoTexto` com `rotulo`, `valor`, `aoMudar`, `tipo` (`text | tel | number | date`), `placeholder`, `maxLength`, `fonteMono?: boolean`, `obrigatorio?`, `className` (para `col-span-*` nos grids de `FormLancamentoFinanceiro.tsx:120-219`); `CampoTextoLongo` análogo com `linhas`. Reutiliza os mesmos tokens (`text-base sm:text-sm` anti-zoom iOS, `focus-visible:outline-destaque-texto`). Migra os 5 arquivos do §2.2-C; `CampoBusca` permanece separado (é semântico e já existe).
- **Benefício**: ~120 LOC a menos; o comportamento anti-zoom do teclado iOS/Android e o foco âmbar passam a ser garantidos em um lugar — relevante porque os formulários de configuração de push (`SecaoNotificacao*`) são os mais longos e editados.
- **Esforço**: **S–M** (2 arquivos novos + 5 migrações contidas).
- **Risco**: **baixo** — inputs controlados simples; nenhum deles tem comportamento além de value/onChange. Atenção apenas ao `FormEventoAutomatico`, que reusa a constante para inputs e um checkbox (o checkbox fica fora do componente).

### P1-4 — Higiene de nomenclatura (mudança pequena, agora; padrão documentado para o futuro)

- **Problema**: aliases bilíngues mortos e convenção implícita (ver §2.2-F). Cada novo componente terá que "adivinhar" o idioma das props olhando os vizinhos.
- **Proposta**: (a) remover os aliases `value/onChange/desabilitado/disabled` de `CampoBusca.tsx` e fixar `valor/aoMudar` (5/5 chamadores já usam assim — zero mudança nos chamadores); (b) documentar no AGENTS.md ou em comentário do `index.css`/DESIGN.md a convenção: **props de dado/estado em pt-BR (`titulo`, `rotulo`, `valor`, `aberto`), handlers `ao*` (`aoMudar`, `aoSelecionar`, `aoFechar`), e APIs nativas do DOM mantidas em inglês (`disabled`, `className`, `type`) onde o React exige**; (c) renomear `linhasComparador.tsx` → `LinhasComparador.tsx` (2 importadores, grep + rename) e alinhar `SeletorNota` `variant` → `variante` (1 chamador: `HistoricoComparador`/`ConfirmacoesPartida` — verificar no momento da mudança).
- **Benefício**: convenção única previsível; remove código morto; encerra a fonte da ambiguidade que gerou os aliases.
- **Esforço**: **S**.
- **Risco**: **mínimo** (mudança de assinatura com pouquíssimos chamadores, todos verificados).
- **Explicitamente fora do escopo**: renomear em massa APIs já estabelecidas (`open/onClose` do ModalBase, `checked/onChange` do Toggle, `value/onChange` de SelectSumula/StatBox) — custo de review alto, ganho estético; registrar como direção futura "novos componentes seguem a convenção", sem retroatividade.

### P2-5 — Migrar `DialogoEvento` para `ModalBase`

- **Problema**: terceira implementação do shell de modal (`DialogoEvento.tsx:59-76` duplica portal, overlay, focus trap e atributos ARIA de `ModalBase.tsx:63-85`). Bug de acessibilidade/UX corrigido num shell não chega aos outros (ex.: `disableEscape` já difere, `onMouseDown` do backdrop tem guard extra).
- **Proposta**: reescrever `DialogoEvento` usando `ModalBase` com `mostrarBotaoFechar={false}`, `tamanhoMaximo="sm"`, `posicao="bottom-sheet"`, conteúdo atual como children. `ConfirmDialog` fica como está: é canônico na sua função e usado em 10 lugares; mexer nele é refactor cosmético sem ganho real (ver §4).
- **Benefício**: 1 shell a menos para manter; animação e a11y consistentes com os outros 6 modais.
- **Esforço**: **S–M** (o componente tem fluxo de 2 etapas que se mantém igual).
- **Risco**: **médio** — é a tela mais crítica do app (marcar gols ao vivo) e tem estados sensíveis (`salvando` desabilita Escape e o clique no backdrop; animação `translate-y` vs `scale`). Migrar fora de partida ao vivo / com teste manual do fluxo completo.

### P2-6 — Peças de suporte das listas financeiras e modais

- **Problema**: (a) `COR_TIPO` é constante de domínio exportada de um componente de UI e importada por outro (`ListaReceitasAbertas.tsx:15-22` → `ListaDespesasAbertas.tsx:4`); (b) linha de metadados de lançamento (Badge + chip tipo + ref + data) duplicada (`ListaReceitasAbertas.tsx:148-163` vs `ListaDespesasAbertas.tsx:48-63`); (c) botão "Fechar" de rodapé repetido em 4 modais (§2.2-B).
- **Proposta**: mover `COR_TIPO` (e eventualmente `ChipTipoLancamento` — o span de ~4 linhas que consome o mapa) para `src/lib/dividas.ts` ou para um `ChipTipoLancamento.tsx` único; extrair `LinhaMetaLancamento` (badge natureza + chip + ref + data) usada pelas duas listas. O item (c) é resolvido naturalmente pelo `Botao` da P0-2 (`<Botao variante="secundario" larguraCompleta>Fechar</Botao>`).
- **Benefício**: corrige o acoplamento componente→componente por constante; uma só receita para o registro financeiro (área admin mais propensa a evolução).
- **Esforço**: **S**.
- **Risco**: **baixo** — mudança local no módulo financeiro.

### P2-7 — Extrair `PilulaFiltro` (pílula de filtro)

- **Problema**: mesmo ternário de chip ativo/inativo repetido em 3 lugares com ~15 linhas cada (`GestaoJogadores.tsx:322-360`, `ModalEscalarJogador.tsx:74-97`, `ModalFiltrosRanking.tsx:121-149`).
- **Proposta**: `src/components/PilulaFiltro.tsx` com `ativo`, `children`, handlers padrão de button; cada chamada vira um `.map()` de dados já existente.
- **Benefício**: consistência visual das pílulas (hoje há 3 receitas quase iguais com deltas de `px`/`rounded`); menos ternário aninhado nas rotas.
- **Esforço**: **S**.
- **Risco**: **baixo** — botões sem estado próprio. É o "Strategy" honesto aqui: variação real de comportamento não existe, é só aparência repetida — se o app não crescer mais filtros, P2 é o teto (não passar de um componente).

### P2-8 — Chip "mini" no `Badge` (em vez de componente novo)

- **Problema**: chips de 9px repetidos (§2.2-E) recriam manualmente a assinatura que `Badge.tsx:86-87` já encapsula em 10px.
- **Proposta**: adicionar prop `densidade?: 'normal' | 'mini'` (ou `tamanho?: '10' | '9'`) ao `Badge` e migrar os ~10 chips; não criar `Chip` separado — evitar duas abstrações para o mesmo papel.
- **Benefício**: um sistema de badge só; menos drift entre 9px e 10px.
- **Esforço**: **S**. **Risco**: **baixo** (props opcionais, default mantém comportamento).

### P3-9 — Organização de camadas para o crescimento (adoção por toque, não mudança em massa)

- **Problema**: 63 arquivos planos em `src/components/` misturam primitivas genéricas (`Badge`, `Estado`, `ModalBase`), navegação (`BotaoVoltar`, `AbasEstatisticas`), domínio-esporte (`PainelPlacar`, `CabecalhoTime`) e seções de tela admin (`SecaoNotificacao*`, `FormLancamentoFinanceiro`). O problema é de **orientação**, não de compilação — hoje ninguém se perde, mas a raiz vai inchar a cada extração das P0/P1.
- **Proposta (organização alvo)**: criar `src/components/ui/` **apenas para as novas primitivas** das propostas P0/P1/P2 (`CabecalhoSumula`, `Botao`, `CampoTexto`, `CampoTextoLongo`, `PilulaFiltro`) — é onde quem extrai sabe que primitivas vivem. **Não mover** os 63 existentes: renomeações/moves em massa violam a diretriz de não fazer refactor cosmético amplo e poluem o review. Componentes existentes migram para `ui/` **só quando forem tocados** por uma mudança funcional, um por commit. Nomenclatura: pt-BR PascalCase; primitivas com nome de papel (`Botao`, `CampoTexto`, `PilulaFiltro`), componentes de domínio com nome de domínio (`PainelPlacar`, `LinhaJogadorGestao`).
- **Benefício**: orientação clara sem custo de churn; a pasta `ui/` nasce pequena e legível.
- **Esforço**: **S** (nada a fazer além de seguir a regra nas próximas extrações). **Risco**: **mínimo**.

### P3-10 — Débitos apenas registrados (não agendar agora)

- `<select>` nativos estilizados inline (5 ocorrências, §2.2-C): migrar para `SelectSumula` **só se** ele ganhar suporte a `optgroup` (necessário para "Time Preto/Branco" em `DialogoEvento.tsx:103-120` e `SeletorAtletasComparador`). Até lá, o nativo é aceitável.
- Sufixos de card (`DueloCard` vs `CardCraquePartida` vs `CartaoJogadorEdicao`) e "Assists" residual: corrigir apenas quando o arquivo for tocado por outra mudança.
- Skeletons espelharem 7 cabeçalhos reais: risco de drift geométrico se o `CabecalhoSumula` mudar. Mitigação barata: comentário no topo de `Skeletons.tsx` apontando para `CabecalhoSumula` como referência de geometria.

---

## 4. O que NÃO fazer (overengineering a evitar)

1. **Não criar um componente `Cartao` genérico de 10 props** para substituir as 138 ocorrências do shell `rounded-[4px] border border-borda bg-superficie shadow-carimbo`. Isso é coincidência de *tokens*, não duplicação de *comportamento* — os cards divergem de propósito (fita adesiva do `CardCraquePartida:11`, rotação, estados de destaque). Um wrapper levaria a props-bandeja (`comSombra`, `comBorda`, `comGlow`...) que é exatamente a abstração prematura que o AGENTS.md proíbe. Se algum dia incomodar, a saída honesta é uma *constante de classes* compartilhada em `lib/`, não um componente.
2. **Não unificar `ConfirmDialog` dentro de `ModalBase`** nem criar um `Dialogo` configurável que cubra os três shells por props. `ConfirmDialog` é simples, estável e usado em 10 lugares; forçá-lo no `ModalBase` adicionaria propriedades de exceção (`semHeader`, `semRodapé`, `p-5`) que degradam a API do canônico. Migre só o `DialogoEvento` (P2-5), que não tem motivo para ter shell próprio.
3. **Não extrair os cards de uso único (`DueloCard`, `DuplaCard`, `CardCraquePartida`, `SeletorAtletasComparador`, `HistoricoComparador`)** como "reutilizáveis". Cada um tem 1 importador e semântica própria; generalizá-los é YAGNI puro. O init já aponta isso (`extractable-components.md:3`).
4. **Não criar um sistema de ícones/tema em TypeScript** nem mover os tokens do `@theme` do Tailwind 4 para objetos JS. Os tokens vivem em CSS (`src/index.css`) e os componentes consomem utilitárias — inverter isso adicionaria camada sem resolver problema real.
5. **Não migrar os `Skeletons.tsx` para reutilizar componentes reais** (`CabecalhoSumula`, cards etc.). Os skeletons são formas neutras sem texto, existem para CLS=0 durante o chunk lazy, e acoplá-los aos componentes reais criaria dependência bidirecional e risco de layout durante o loading.
6. **Não padronizar retroativamente todas as APIs de props para pt-BR** (`open`→`aberto`, `onChange`→`aoMudar` em Toggle/SelectSumula/StatBox/ModalBase...). Isso tocaria a maioria dos arquivos do app para zero ganho funcional — é o refactor cosmético amplo que a diretriz manda evitar. Padrão novo vale para código novo.
7. **Não criar componente de acordeão genérico** para as 3 ocorrências de conteúdo (`ListaReceitasAbertas`, `SecaoNotificacaoVotacao`, `SecaoNotificacaoSaude`) — os usos têm estados e estilos diferentes; extraia só se uma quarta cópia aparecer.
8. **Não adicionar biblioteca de UI (headless, Radix, shadcn) nem react-hook-form.** O app já tem padrões próprios funcionais (listbox ARIA em `useListbox`, focus trap em `useModalA11y`, haptics em `lib/haptics.ts`) e os formulários são pequenos e controlados à mão; uma lib resolveria problemas que não existem aqui, contrariando a filosofia do repositório.
9. **Não fazer big-bang de migração do `Botao`** (tocar 21 arquivos num único commit). A extração vale por criar o componente canônico e migrar os pares duplicados; o resto converge no ritmo das mudanças funcionais.

---

### Tabela-resumo de prioridades

| Prioridade | Proposta | Esforço | Risco | Quando |
|---|---|---|---|---|
| P0 | CabecalhoSumula | M | baixo | próxima mudança de UI global |
| P0 | Botao (variantes) | M (incremental) | baixo-médio | criar já; migrar pares duplicados primeiro |
| P1 | CampoTexto / CampoTextoLongo | S–M | baixo | próxima evolução dos formulários admin |
| P1 | Higiene nomenclatura (CampoBusca + LinhasComparador + variant→variante) | S | mínimo | qualquer momento |
| P2 | DialogoEvento → ModalBase | S–M | médio | fora de janela de partidas ao vivo |
| P2 | COR_TIPO/ChipTipoLancamento + LinhaMetaLancamento + rodapés Fechar | S | baixo | junto do módulo financeiro |
| P2 | PilulaFiltro | S | baixo | quando houver 4º uso ou evolução visual |
| P2 | Badge `densidade="mini"` | S | baixo | ao tocar as listas admin |
| P3 | Camada `src/components/ui/` para novas primitivas | S | mínimo | regra de adoção por toque |
| P3 | Débitos registrados (selects nativos, sufixos, "Assists") | — | — | só ao tocar os arquivos |
