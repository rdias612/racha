# Relatório de Análise Completa — Racha Gragoatá CBO

**Data:** 22/08/2026
**Escopo:** análise em 4 eixos — qualidade do código ("code slop"), UX mobile (PWA usado como app), design autêntico (menos genérico/IA) e novos requisitos.
**Metodologia:** revisão integral de `src/` (rotas, componentes, hooks, libs), `supabase/migrations/`, `index.html`, `public/` e `PLANO.md`, cruzando evidências com referências `arquivo:linha`. Projeto pessoal/hobby para o racha de quinta do grupo (Gragoatá/CBO, Niterói).

---

## Sumário executivo

| Eixo | Veredito resumido |
|---|---|
| **Qualidade de código** | Slop **3/10**. Base sólida (zero `any`, TS strict, lib bem desenhada), mas há **1 furo de segurança crítico** (senhas legíveis por qualquer anônimo), 3 violações de Rules of Hooks, escrita multi-tabela não transacional e sinais clássicos de geração descuidada (classes CSS alucinadas, `eslint-disable` num projeto sem ESLint). |
| **UX mobile** | Base técnica excelente (safe areas, alvos 44px, anti-zoom iOS). Falha nos detalhes nativos: bug no pull-to-refresh, fluxo de votação sem progresso real nem rascunho, voltar morto em deep-links, offline cru. |
| **Design** | Genérico por decisão acumulada: system-ui + neutral-* + amber-500 para tudo + 3 identidades convivendo (ícone azul, logo verde, botões âmbar). Direção recomendada: **"Súmula de Quinta"** (Preto/Branco + âmbar refletor, tipografia de placar, bordas duras). O P1 inteiro é CSS/ativos, zero lógica. |
| **Novos requisitos** | O app já cobre mais do que parece (push existe!, sorteio equilibrado, presença/lista de espera, dívidas). Maiores lacunas de valor: cartão de resultado p/ WhatsApp, bolão de placar, records all-time, prêmios mensais, comparador cara-a-cara. |

**Correção importante de premissa:** `PLANO.md` virou ficção — diz "sem push" (há Web Push completo com VAPID + Edge Functions, migrations 036–045), status `draft|published|closed` (existe `live`), destaque azul (realidade é âmbar). Vale um ADDENDUM.md ou atualização.

---

# 1 · Qualidade de código

## Veredito

**Grau de slop: 3/10.** Bem acima da média para projeto hobby: zero `any`, TS strict ativo, naming PT consistente, a11y real (`role="status"`, `aria-sort`), code-splitting e skeletons caprichados. Os problemas sérios são poucos mas reais: 1 furo de segurança grave, 3 violações de Rules of Hooks que podem crashar telas, escrita multi-tabela não transacional e sinais clássicos de geração descuidada. Parece débito de evolução rápida, não lixo de IA.

## Top 10 problemas (por gravidade)

### 1. CRÍTICO — `senha_hash` é legível publicamente (fora da postura do PLANO)
- **Evidência:** `supabase/migrations/016_grants_baseline.sql:10` — `GRANT SELECT ON jogadores TO anon, authenticated` (sem restrição de coluna, sem RLS); `migrations/021_plaintext_passwords.sql` guarda **senha em texto puro** nessa coluna. A chave anon é pública no bundle. Agravante: `Login.tsx:29` lista usernames pré-autenticação.
- **Risco:** qualquer pessoa pode chamar `.from("jogadores").select("username, senha_hash")` e pegar a senha de todos → takeover total das contas. Isso ultrapassa o "confio no client" assumido no PLANO.md (que só tolera spoof de IDs).
- **Correção:** numa migration nova: `REVOKE SELECT ON jogadores FROM anon, authenticated;` + grant **por coluna**: `GRANT SELECT (id, username, nome, posicao, posicao_b, is_admin, is_ativo, is_mensalista) ON jogadores TO anon, authenticated;`. Nenhuma tela seleciona `senha_hash` diretamente — o app continua funcionando.

### 2. ALTO — Violações de Rules of Hooks (crash real)
- **Evidência:** guards com retorno `<Navigate>` **antes** dos hooks:
  - `Administrador.tsx:66` retorna antes do `useEffect` da linha 103;
  - `PartidaConfirma.tsx:22,27` retornam antes do `useMemo` da linha 31;
  - `PartidaNovaTimes.tsx:49-58` retornam antes do `useMemo` da linha 64.
- **Risco:** se o guard mudar durante a mesma montagem (logout nesta tela, perda de `location.state`), React lança "Rendered fewer hooks than expected" e a tela morre (ErrorBoundary engole, mas o usuário cai na tela de erro).
- **Correção:** mover todos os hooks para antes dos guards — como `GestaoJogadores.tsx` e `PartidaEditar.tsx` já fazem corretamente.

### 3. ALTO — Salvamento de edição não-transacional com erros engolidos
- **Evidência:** `lib/partidas.ts:429-459` (`salvarEdicaoCompletaPartida`) deleta eventos (:431), votos (:438) e dívidas (:445) **sem checar o `error`** retornado; só o delete final (:454) é verificado. Tudo orquestrado client-side em N requisições sequenciais.
- **Risco:** falha no meio deixa o banco inconsistente (participante removido mas votos órfãos, stats pela metade). Contradiz a própria arquitetura do plano ("RPC transacional" como `criar_partida`).
- **Correção:** criar RPC `salvar_edicao_partida(p_partida_id, p_participantes jsonb)` com `BEGIN/EXCEPTION` espelhando `criar_partida`; no mínimo, checar todos os erros intermediários.

### 4. MÉDIO-ALTO — Copy-paste integral entre rotas irmãs
- **Evidência:** `atribuirTime` (`PartidaNovaTimes.tsx:87-125` vs `PartidaTimes.tsx:99-137`) e `autoEscalar` (`PartidaNovaTimes.tsx:69-85` vs `PartidaTimes.tsx:139-161`) são quase idênticos linha a linha, incluindo a string `"Times equilibrados! (Preto X★ vs Branco Y★)"`. Já divergiram: um valida mínimo de confirmados, o outro não.
- **Correção:** extrair hook `useEscalacaoTimes(jogadores, mediasNotas)` ou subir os handlers para dentro do `EscalacaoTimesEditor` (componente compartilhado que já existe — faltou levar a lógica junto).

### 5. MÉDIO — Classes Tailwind inexistentes (alucinação silenciosa)
- **Evidência:** `animate-in fade-in slide-in-from-bottom-4 duration-200` em `GestaoJogadores.tsx:679`; `animate-in fade-in duration-150` em `PartidaEditar.tsx:520`; `no-scrollbar` em `PartidaEditar.tsx:563`. Não há import de `tw-animate-css`, plugin nem `@utility` em lugar nenhum.
- **Risco:** as animações simplesmente não acontecem; quem ler acredita que existem.
- **Correção:** instalar `tw-animate-css` (1 linha no CSS) ou substituir por transitions manuais como `ConfirmDialog.tsx:68-70` já faz; remover `no-scrollbar`.

### 6. MÉDIO — Race condition em `carregar()` do PartidaDetalhe
- **Evidência:** `PartidaDetalhe.tsx:115-118` — `useEffect([id])` chama `carregar()` sem flag de cancelamento; respostas podem chegar fora de ordem ao navegar rápido entre partidas.
- **Risco:** UI exibindo placar/notas da partida errada. O contraste dói porque `PartidaAoVivo.tsx:72-86` faz **exatamente certo** com `let ativo = true`.
- **Correção:** replicar o padrão do AoVivo (flag `ativo` no cleanup) aqui e nos demais effects sem proteção: `Jogos.tsx:72`, `Administrador.tsx:103`, `GestaoJogadores.tsx:66`, `Resumo.tsx:59,75`.

### 7. MÉDIO — `obterMediasNotasJogadores` baixa a tabela `votes` inteira
- **Evidência:** `lib/jogadores.ts:144-180` faz `select("target_id, rating")` **sem filtro nenhum** e calcula média aparada no cliente; chamado sempre em `PartidaTimes.tsx:49` e `PartidaNovaTimes.tsx:41` (mesmo sem usar auto-escala). Duplica a lógica que a migration 067 já implementou no servidor (`partida_notas.avg_rating`).
- **Risco:** custo cresce linearmente com o histórico; duas fontes de verdade para "média".
- **Correção:** RPC/view `media_notas_jogadores()` no Postgres reaproveitando a fórmula da 067.

### 8. MÉDIO — Dois estilos de formatação convivendo (sem prettier)
- **Evidência:** aspas simples + sem ponto-e-vírgula em `PartidaDetalhe.tsx:1`, `Jogos.tsx:1`, `Perfil.tsx:1`, `BannerLembrete.tsx:1`, `tema.ts`, `supabase.ts`, `main.tsx`, `hooks/*`; aspas duplas + `;` no resto (`GestaoJogadores`, `Ranking`, `lib/partidas.ts`…). Sem `.prettierrc` nem `.editorconfig`.
- **Correção:** Prettier default + `.editorconfig`, rodar uma vez, esquecer.

### 9. BAIXO-MÉDIO — Comentários de lint fantasma e feedback inconsistente
- **Evidência:** `// eslint-disable-next-line react-hooks/exhaustive-deps` em `PartidaDetalhe.tsx:117`, `Estatisticas.tsx:98`, `Administrador.tsx:105`, `PartidaVotar.tsx:131`, `BannerLembrete.tsx:58` — **não há ESLint instalado** (decoração morta).
- No mesmo tema: `window.confirm` nativo em `Administrador.tsx:110,122` e `PartidaVotar.tsx:155` enquanto existe o `ConfirmDialog`; `GestaoJogadores.tsx` usa `MensagemEstado` **e** `Snackbar` para o mesmo tipo de feedback; erro silenciado sem padrão (`Perfil.tsx:52`, `SessaoContext.tsx:62`, `PartidaDetalhe.tsx:687-691` catch vazio).
- **Correção:** padronizar — ConfirmDialog para confirmações, Snackbar para sucesso pós-ação, `MensagemEstado` para erro persistente.

### 10. BAIXO — PLANO.md virou ficção científica
- **Evidência:** o plano diz status `draft|published|closed` (linha 39), "Sem push" (linha 101), destaque azul `#2563eb` (linha 145), 10 telas. A realidade: status `live` (migration 047), Web Push completo (036–045), destaque âmbar (`index.css:13`), confirmações/dívidas/avulsos/gestão financeira. E o app permite editar partida `closed` (`PartidaEditar.tsx:310-314`), contradizendo a regra 3 do plano ("ao virar closed, trava").
- **Correção:** 30 min atualizando o PLANO.md ou criando ADDENDUM.md listando desvios conscientes — inclusive justificar a edição pós-closed.

## Dead code confirmado

| Item | Local | Situação |
|---|---|---|
| `SkeletonPerfil` | `components/Skeletons.tsx:204-240` | Exportado, **nunca importado** |
| `vibrateWarning` | `lib/haptics.ts:33` | Nunca chamado |
| `vibrateGoal` | `lib/haptics.ts:47` | Nunca chamado |
| `export type ColunaOrdenacaoDuplas` / `DirecaoOrdenacao` | `EstatisticasRacha.tsx:15,22` | `export` desnecessário; `DuplaCard.tsx:8` ainda redeclara a união inline |
| `ROTULO_TIPO` | `Administrador.tsx:31-35` | Duplica os `label` de `TIPOS_DIVIDA` (`dividas.ts:9-13`) |
| Classes `animate-in*`, `no-scrollbar` | ver item 5 | CSS fantasma |
| Comentários `eslint-disable` ×5 | ver item 9 | Referenciam ferramenta inexistente |

`index.css` está limpo — todos os tokens são consumidos.

## Elogios (manter!)

1. **Zero `any`, casts honestos e documentados** — os dois únicos `as unknown as` (`partidas.ts:124`, `dividas.ts:50-52`) têm comentário explicando *por quê* (quirk do join m:1 do PostgREST). Os tipos conferem com as migrations (`live`, `confirmacao_closes_at`, `pares_racha` sincronizados).
2. **`PartidaAoVivo.tsx` é a referência do projeto** — cleanup correto em effect (flag `ativo`, :72-86), polling com `clearInterval` (:88-94), `useMemo` no placar. Molde para as outras rotas.
3. **Camada lib bem desenhada** — `formatacao.ts` centraliza TODAS as datas (nenhum `toLocaleDateString` espalhado); `vagaOcupada/vagasOcupadas/podeConfirmar` (`partidas.ts:284-321`) espelham explicitamente as regras do RPC server-side com comentário apontando a migration 057.
4. **A11y e mobile-first genuínos** — skeletons com `aria-busy`/`sr-only`, `aria-sort` nas tabelas ordenáveis (`Ranking.tsx:350`, `EstatisticasRacha.tsx:288`), `min-h-[44px]`, `prefers-reduced-motion` global, `beforeunload` ao sair com votos pendentes (`PartidaVotar.tsx:40-49`). Raro até em projeto pago.

## Ferramentas mínimas sugeridas (hobby-grade)

```bash
npm i -D prettier eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals
```

1. **Prettier** (defaults + `.editorconfig`) — resolve o item 8 sozinho.
2. **ESLint flat config mínimo** com apenas 2 presets: `typescript-eslint recommended` + `eslint-plugin-react-hooks` (**teria pego os 3 bugs do item 2 automaticamente**) — nada de stylistic/imports/a11y plugins.
3. Script único: `"lint": "tsc -b && eslint src"`.
4. *(Opcional, 2 min)* **knip** — teria listado `SkeletonPerfil`, `vibrateGoal` e exports fantasmas sem esforço.

Nada de husky, commitlint, testes e2e, storybook — o projeto não pede isso.

---

# 2 · UX mobile (PWA usado como app)

## Veredito

A base técnica é muito boa para um PWA (safe areas, alvos de 44px globais, inputs 16px anti-zoom iOS, skeletons, reduced-motion). Mas a experiência ainda falha nos detalhes nativos: o pull-to-refresh tem bug que dispara refresh no meio das listas, o fluxo de votação não mostra progresso real nem sobrevive a um toque em voltar, e há inconsistências de identidade/feedback (status bar azul num app verde/âmbar, haptics quase não usados). Tudo corrigível de forma incremental.

## Top 10 melhorias (impacto/esforço)

**1. Bug do PullToRefresh — alto / mínimo**
- Problema: `PullToRefresh.tsx:20,27` checa `window.scrollY`, mas quem rola é o `<main overflow-y-auto>` (`Layout.tsx:122`). A window nunca rola → refresh dispara com a lista no meio. Afeta Jogos/Ranking/Estatísticas/EstatisticasRacha.
- Solução: expor o `main` via contexto e usar `container.scrollTop === 0`.

**2. Votação sem progresso real nem rascunho — alto / médio**
- Problema: `PartidaVotar.tsx:111-116` pré-preenche nota 6 para os 15 → `todosAvaliados` (l.149) é `true` desde o início e o contador "X restantes" (l.301) é código morto; **um toque envia quinze 6s**. Sem rascunho: `beforeunload` (l.40-49) é ignorado em standalone/iOS e o `window.confirm` (l.155) não protege o back do Android.
- Impacto: ~30 toques sem senso de progresso; risco de envio errado e perda total ao sair. É a tela mais importante do app.
- Solução: `Set` de avaliados separado dos defaults; barra fixa "8/15 avaliados"; autosave em localStorage por partida; confirmação via `ConfirmDialog`.

**3. theme-color incoerente — alto visual / mínimo**
- Problema: `index.html:10` usa claro `#2563eb` (azul); manifest usa `#15803d` (verde); primário real é outro (`index.css:12`). Status bar azul sobre app verde/âmbar.
- Solução: alinhar theme-color claro/escuro com os tokens reais.

**4. Swipe × tabela horizontal do Ranking — alto / mínimo**
- Problema: handlers em `Ranking.tsx:198-201` englobam a tabela `overflow-x-auto min-w-120` (l.339-340); arrastá-la lateralmente troca a métrica.
- Solução: `data-no-swipe` no wrapper da tabela (o hook já respeita, `useSwipeTabs.ts:57`).

**5. Voltar sem fallback pós deep-link — alto / baixo**
- Problema: todas as telas usam `navigate(-1)` (`PartidaVotar.tsx:159`, `PartidaDetalhe.tsx:168`, `PartidaNova.tsx:157`, etc.). Notificação push abre `/partida/:id/votar` direto → histórico vazio → "← voltar" morto ou fecha o app.
- Solução: helper `voltar(navigate, fallback)` usando `history.state?.idx > 0 ? navigate(-1) : navigate(fallback)`.

**6. Alvos de toque <44px — alto / baixo**
- `PartidaDetalhe.tsx:541`: botões admin ✓⏳✗✕ de 30×30px com gap-1;
- `:493` BotoesSelf `min-h-[32px]`;
- `PartidaEditar.tsx:737,751` steppers `h-8 w-8` com `min-h-0` anulando a regra global de 44px (`index.css:68`);
- `Jogos.tsx:139-151` lixeira sem padding (~20px) dentro do Link;
- `SeletorNota.tsx:142` gatilho 40px; `Ranking.tsx:363-376` headers de ordenação ~28px.
- Solução: aumentar área de toque por padding/pseudo-elemento mantendo visual compacto; espaçar os botões admin.

**7. Offline e erros amigáveis — alto / médio**
- Problema: o SW só cacheia same-origin (`sw.js` fetch handler); chamadas Supabase falham offline e `error.message` cru ("Failed to fetch") vaza na tela (`Resumo.tsx:66`, `Jogos.tsx:53`, `Ranking.tsx:118`, `PartidaVotar.tsx:125`). O `offline.html` quase nunca aparece pois o shell está cacheado. Nenhum listener online/offline.
- Solução: mapper central de erros (falha de rede → "Sem conexão…"), banner global offline, e stale-while-revalidate para GETs do Supabase (telas de leitura funcionam offline com último dado).

**8. Trocar window.confirm pelo ConfirmDialog — médio / mínimo**
- Problema: `Administrador.tsx:110,122` e `PartidaVotar.tsx:155` usam `window.confirm` nativo; o projeto já tem `ConfirmDialog` usado em 5 telas. Inconsistente e feio em standalone.

**9. Haptics subutilizados + zero optimistic updates — médio / baixo**
- Problema: `vibrateGoal`/`vibrateWarning` (`haptics.ts:33,47`) nunca chamados; toda ação espera rede + refetch total (confirmar presença: `PartidaDetalhe.tsx:632-651`; quitar dívida recarrega tudo) — lento no 4G.
- Solução: vibrar ao selecionar nota (`SeletorNota.selecionar`), gol confirmado (`DialogoEvento`) e bloqueio de 2º goleiro (`PartidaNovaTimes.tsx:112`); toggle otimista na presença com rollback em erro.

**10. Polimento nativo faltante — médio / baixo**
- Resumo (home) é a única lista principal **sem** PullToRefresh;
- Header do Layout não é sticky (`Layout.tsx:45`) — tema/admin somem ao rolar;
- `Snackbar.tsx:51` fixa `bottom-20` sem `env(safe-area-inset-bottom)`;
- Manifest declara screenshot quadrado (icon-512) como `form_factor: narrow` (deveria ser retrato ~1080×1920);
- Sem splash iOS (`apple-touch-startup-image`) → flash branco no boot;
- Tab bar fica visível nos fluxos focados (votar/editar/ao-vivo), empilhando ~128px de chrome com a CTA fixa.

## Quick wins (<1h cada)

1. Corrigir meta theme-color clara (`index.html:10`).
2. `data-no-swipe` na tabela do Ranking.
3. Haptics: vibrar nota selecionada, gol e bloqueio de goleiro duplicado.
4. Header sticky no Layout.
5. Snackbar respeitando safe-area inferior.
6. Envolver o Resumo em `<PullToRefresh>`.
7. Helper de voltar com fallback para deep-link.
8. Substituir os 2 `window.confirm` do Administrador.
9. Padding na lixeira dos Jogos.
10. Screenshot portrait no manifest + `apple-touch-icon` 180×180.

## Já estão BEM feitos (não mexer)

1. **Base CSS mobile correta** (`index.css:43-95`): inputs/selects/textarea forçados a 16px (impedem zoom automático do iOS), `min-height:44px` global em botões, outline de foco visível e media query global de `prefers-reduced-motion`.
2. **Safe areas consistentes**: `viewport-fit=cover` (`index.html:7`), padding `env(safe-area-inset-*)` no body (`index.css:31`), nav inferior com `pb-[env(...)]` (`Layout.tsx:130`) e CTAs fixas com `calc(4rem + env(safe-area-inset-bottom))`.
3. **Carregamento e gestos**: code splitting lazy por rota com skeleton dedicado por tela (`Skeletons.tsx`, 8 skeletons), `useSwipeTabs` com trava vertical precoce bem calibrada, e `DialogoEvento` como bottom sheet nativo (ancorado embaixo, com scroll lock).

---

# 3 · Identidade visual — direção "Súmula de Quinta"

## Diagnóstico da genericidade (evidências concretas)

1. **Tipografia genérica** — `index.css:32` usa system-ui; o placar (`PartidaDetalhe.tsx:202`) renderiza na mesma fonte do texto corrido.
2. **Receita default Tailwind em toda superfície** — `bg-neutral-50 dark:bg-neutral-950` + `border-neutral-200/800` (`Layout.tsx:44`, `Resumo.tsx:188`, `Perfil.tsx:343`, `DuplaCard.tsx:24`, `Estado.tsx:56`).
3. **Um único accent para tudo** — amber-500 literal (`#f59e0b`, `index.css:13`) pinta aba ativa (`Ranking.tsx:212`), botão primário (`Login.tsx:215`), badge admin (`Perfil.tsx:190`), stats (`Perfil.tsx:344`): quando tudo é destaque, nada é.
4. **Iconografia híbrida sem regra** — emoji (`⭐` `PartidaDetalhe.tsx:220`, `⚽🅰️` :310–312, `🏆` `Ranking.tsx:396`) + lucide (`Layout.tsx:10–21`) + ASCII (`←` :171, `↑↓↕` `Ranking.tsx:371–374`, `✓⏳✗` :470–472).
5. **Cabeçalhos idênticos e anônimos** — `text-lg font-semibold` em todas as telas (`Resumo.tsx:164`, `Jogos.tsx:103`, `Ranking.tsx:202`, `Perfil.tsx:173`, `PartidaDetalhe.tsx:176`).
6. **Toggle sol/lua redondo** (`Layout.tsx:52–64`) — o clichê nº 1 de app gerado por IA.
7. **Identidade dividida** — ícone do PWA ainda azul `#2563eb` (`index.html:10`, `public/icon.svg`), logo verde (`Logo.tsx:36`), botões âmbar — três marcas num app.
8. **Microcopy neutra de sistema** ("Entre com seu usuário e senha", `Login.tsx:98`; `Perfil.tsx:221`) onde o domínio pede resenha.

## A direção recomendada: **SÚMULA DE QUINTA**

O cruzamento entre a **súmula de papel preenchida à caneta depois do jogo**, o **placar de LED do society noturno** e a **tabela de bar escrita no giz**.

A tese: **Preto vs Branco já é a marca** (`times.ts:9–12`), então o app inteiro vive esse duotônico, com **âmbar de refletores como ÚNICO accent de ação** e **verde apenas como cor contextual de campo**. Isso resolve os sintomas de uma vez: paleta com significado em vez de decoração, hierarquia natural (âmbar só onde há voto/craque/ação) e permissão para tipografia condensada de placar — porque placar é o produto. Não é gramado berrante nem retro kitsch: é o app como documento oficial-não-oficial do grupo.

## Paleta (tokens `--cor-*`)

Tema escuro (principal):

```css
--cor-fundo: #12100d;          /* asfalto quente */
--cor-superficie: #1b1814;
--cor-superficie-2: #242019;   /* hover/sticky */
--cor-borda: #35302a;
--cor-giz: #f2efe6;            /* texto principal */
--cor-giz-fraco: #a39f92;      /* texto secundário */
--cor-preto-time: #0d0d0e;
--cor-branco-time: #f4f1e8;
--cor-destaque: #ffb300;       /* âmbar refletor — única cor de ação */
--cor-destaque-tinta: #1a1200; /* texto sobre âmbar (~11:1) */
--cor-campo: #16281c;          /* superfície contextual de partida */
--cor-campo-linha: #2c4433;
--cor-perigo: #e4572e;         /* terracota — erro/derrota */
--cor-ok: #58b368;
--cor-oliva: #54552e;          /* vitória/empate neutro */
```

Tema claro (derivado "papel de súmula"):

```css
--cor-fundo: #f3efe4;
--cor-superficie: #faf7ee;
--cor-superficie-2: #ece7d8;
--cor-borda: #d8d2c0;
--cor-giz: #1e1c18;            /* vira tinta grafite */
--cor-giz-fraco: #6b6759;
--cor-campo: #dfe8dc;
--cor-campo-linha: #b9cbb6;
/* destaque, times, perigo, ok, oliva: mantêm os mesmos hex do escuro */
```

**Dica chave:** manter os NOMES das variáveis atuais onde possível (~74 usos redesenham de graça, só trocam os valores).

## Tipografia

Google Fonts gratuitas: **Barlow Condensed** (display/placar/títulos), **Archivo** (texto corrido), **Chivo Mono** (dados/números).

Regras de uso:
- **Todo dígito de dado** (placar, nota, pts, gols, R$) usa fonte display/mono + `tabular-nums`. Hoje o app inteiro tem UM único `tabular-nums` (`PartidaDetalhe.tsx:202`).
- Títulos de tela em condensed uppercase com `tracking-[0.08em]` — substitui o par genérico `text-lg font-semibold` + `text-xs uppercase tracking-wide`.
- Fallbacks seguros: Barlow Condensed → `"Arial Narrow"`; Archivo → system-ui.

## Raios, sombras e bordas

- **Cantos quase retos:** nada de `rounded-xl/2xl`. Cards em `4px`, chips/badges em `2px`, só modais em `8px`. O impresso de várzea não tem cantos de bolha.
- **Borda dura vence sombra difusa:** eliminar os `shadow-xs/sm` atuais; elevação = `border: 1px solid var(--cor-borda)` + **sombra-carimbo** deslocada (`3px 3px 0`).
- Divisórias internas (`divide-y`) trocam `neutral-200/800` por `var(--cor-borda)`.
- **Regra do glow:** brilho âmbar existe em UM lugar — dígitos do placar ao vivo. Em todo o resto: matte.
- Grain global sutil cobre tudo (ver Textura & motion), então superfícies nunca ficam "lisas de template".

## Componentes-assinatura (redesenho detalhado)

### 4.1 Placar Painel de LED
Hoje: `PartidaDetalhe.tsx:193–214` e `Jogos.tsx:154–162` (faixas laterais coloridas + número central genérico).

- Barra horizontal única, fundo **preto absoluto** `#000`, borda dura externa.
- Centro: `3 × 2` em Barlow Condensed 700, ~64px, cor `#ffb300`; quando `status === 'live'`: `text-shadow: 0 0 12px rgba(255,179,0,.45)` (o único glow do app) + ponto pulsante ao lado do rótulo "AO VIVO".
- Quando encerrada: LED "apaga" — dígitos em giz fosco `var(--cor-giz)`; resultado vira histórico.
- Laterais: blocos sólidos PRETO (`#0d0d0e`) e BRANCO (`#f4f1e8`) com nome do time em condensed uppercase empilhado — sem cinzas no meio.
- Na lista de Jogos: mesma linguagem em escala menor (mini-painel ~40px) → a home vira um **mural de placares**.
- Motion: algarismo novo rola de cima pra baixo (~180ms ease-out) dentro de `overflow:hidden`.

### 4.2 Card do Craque
Hoje: `PartidaDetalhe.tsx:217–230` (caixa `bg-destaque/10` com ⭐ emoji).

- Container com **borda dupla** (border 2px + outline 1px offset) em âmbar sobre `--cor-superficie`, rotacionado `-rotate-1`, com sombra-carimbo — parece etiqueta colada no armário.
- **Fita preta** atravessando o topo com "CRAQUE DA PARTIDA" em condensed uppercase espaçado (mata o ⭐).
- Corpo: nota gigante em Chivo Mono (`8.7`) à esquerda, avatar com anel âmbar de 2px à direita, nome em condensed, contagem de votos em giz-fraco.
- Pseudo-elemento "fita adesiva" translúcida no canto superior (`rgba(255,179,0,.25)`, rotate 45°).
- Revelação (status → closed): micro-confete com peças retangulares pretas/brancas/âmbar, 900ms, uma vez só.

### 4.3 Pódio Top 3
Hoje: `Ranking.tsx:383–397` — o 1º lugar é um 🏆 dentro de célula de tabela.

- Bloco próprio acima da tabela: três cartões lado a lado, alturas escalonadas (2º menor, 1º maior centro, 3º menor).
- Colocação como numeral gigante vazado: `-webkit-text-stroke: 1.5px var(--cor-giz); color: transparent` (tipografia de costas-de-camisa, custo zero).
- 1º lugar: fundo âmbar, texto `--cor-destaque-tinta`, sombra-carimbo âmbar. 2º/3º: superfície + borda dura.
- Abaixo, linha tracejada com "— continua a classificação —" conectando à tabela completa.
- Tabela passa a usar Chivo Mono nas células numéricas; linha do jogador logado marcada por barra esquerda âmbar de 2px (hoje é `bg-destaque/10`, `Ranking.tsx:391`).

### 4.4 Avatar
Hoje: `Avatar.tsx` — paleta inclui indigo/blue/violet (:16–18), círculo perfeito, badge circular de posição.

- Paleta nova, 6 tons terrosos dessaturados da cena noturna: `#2f4a33` (campo), `#8a5a2b` (couro), `#7a2e2b` (tijolo), `#54552e` (oliva), `#31424e` (petróleo), `#5b4632` (terra). O hash atual (`getHashColor`) continua igual — só troca a paleta.
- Raio muda de círculo para **quadrado arredondado 2–4px** (coerente com a geometria de impresso); iniciais em Barlow Condensed 700.
- Badge de posição sai do círculo e vira **plaqueta retangular** estilo número de camisa: fundo giz, dígito preto, canto 2px, canto inferior-direito.

### 4.5 Badges vitória/empate/derrota + status de partida
Hoje: pills `rounded-full bg-destaque/10`, texto verde/vermelho soltos, `✓⏳✗` ASCII (`PartidaDetalhe.tsx:463–480`, `DuplaCard.tsx:30`).

- Formato: **plaqueta de selo postal** — retângulo raio 2px, borda 1px sólida, condensed uppercase, fundo transparente.
- V = oliva `#54552e`; E = giz-fraco; D = terracota `#e4572e`. Sempre borda+texto na cor.
- Status da partida ("RASCUNHO"/"AO VIVO"/"ENCERRADO") vira **carimbo**: borda dupla, rotacionado 2–3°, uppercase condensado — AO VIVO em âmbar, ENCERRADO em terracota. Reutilizável em dívidas quitadas, votos descartados etc.
- Mini-botões admin (`PartidaDetalhe.tsx:550–583`) mantêm ✓/✗ mas dentro das plaquetas, estado ativo = borda da cor cheia.

## Textura & motion

- **Grain global:** overlay fixo com SVG `feTurbulence` inline como data-URI no `body::after`: `position:fixed; inset:0; opacity:.05; mix-blend-mode:overlay; pointer-events:none; z-index:9999`. Custo zero de rede; mata o aspecto liso de template sem virar textura berrante.
- **Bordas duras vs sombras:** borda 1px sólida + sombra deslocada dura; nenhuma sombra difusa (`blur > 0`) em componente algum.
- **Microinterações:**
  - Placar: dígitos rolam verticalmente quando gol sai (~180ms) + haptic leve (`haptics.ts` já existe);
  - Craque revelado: confete marca (retângulos P&B+âmbar), 900ms, executa uma vez;
  - Botão primário: `active:translate-y-[2px]` junto com a sombra-carimbo encolhendo — o botão "afunda no papel".
- **Coerência com reduced-motion:** garantir animações novas em CSS (`@keyframes`) e confete checando `matchMedia('(prefers-reduced-motion: reduce)')`.

## Tom de voz (microcopy PT-BR com humor de grupo)

| Contexto | Hoje | Proposto |
|---|---|---|
| Erro de rede (`Login.tsx:78`) | "Erro ao conectar." | "A rede falhou — nem aqui nem no campo. Tenta de novo." |
| Senha errada (`Login.tsx:83`) | "Usuário ou senha inválidos." | "Não bateu. Confere o usuário e tenta de novo." |
| Vazio em Jogos (`Jogos.tsx:114–119`) | "Nenhuma partida ainda." | "Ainda não tem jogo na ficha. A quinta cobra o preço do esquecimento." / admin: "Cria a primeira partida e convoca a galera." |
| Ranking vazio (`Ranking.tsx:301–303`) | "Nenhuma partida publicada ainda…" | "O ranking nasce no primeiro apito. Nada publicado ainda." |
| Já votou (`PartidaDetalhe.tsx:415`) | "✓ Você já votou. Pode editar…" | "Seu voto tá garantido. Dá pra mudar até as urnas fecharem." |
| Votação encerrada (`PartidaDetalhe.tsx:456`) | "Votação encerrada — aguardando resultado." | "As urnas fecharam. O craque está sendo apurado." |
| Recusar presença (`PartidaDetalhe.tsx:525`) | "Não vou" | "Essa quinta não rola pra mim" |
| Push indisponível (`Perfil.tsx:225`) | "Web Push não está disponível neste navegador." | "Seu navegador não quer saber dos lembretes." |
| Sucesso ao salvar nome (`Perfil.tsx:102`) | "Nome alterado com sucesso!" | "Nome atualizado. Respeita a camisa nova." |

**Manter** os acertos que já existem — "Maior seca de vitórias" (`Resumo.tsx:152`), "O que importa é participar" (:136), "Vou jogar" (`PartidaDetalhe.tsx:505`) — são exatamente essa voz; o trabalho é estendê-la aos estados genéricos.

## Dark mode como tema principal? **Sim, sem toggle.**

O racha acontece à noite sob refletores — tema escuro é o cenário canônico; o claro vira derivado "papel de súmula". Concretamente:

1. Remover o botão sol/lua (`Layout.tsx:52–64`): seguir `prefers-color-scheme`, override manual opcional via localStorage depois.
2. `index.html:10` — trocar os dois `theme-color`: dark `#12100d`, light `#f3efe4`. Hoje ainda está `#2563eb` (o azul fantasma).
3. Repintar `public/icon.svg` e `icon-maskable.svg`: fundo preto `#0d0d0e`, bola partida ao meio (giz/preta) ou monograma — mata a terceira identidade azul que hoje convive com verde e âmbar.

## Plano arquivo-por-arquivo (priorizado)

**P1 — muda a cara num fim de semana (só CSS/HTML/ativos, zero lógica):**
1. `src/index.css` — tokens + fontes + grain + sombras-carimbo. Manter nomes legados = ~74 usos redesenham de graça.
2. `index.html` — `<link>` das 3 fontes Google + theme-color corrigidos.
3. `public/icon.svg`, `icon-maskable.svg`, `manifest.webmanifest` — identidade única P&B+âmbar.
4. `Layout.tsx` — wordmark tipográfico "RACHA GRAGOATÁ" empilhado estilo costas-de-camisa no header (substitui `Logo.tsx:57–63`), remove toggle, nav inferior ganha indicador de barra âmbar de 2px sobre a aba ativa.
5. `Logo.tsx` — escudo verde genérico sai; entra escudo partido verticalmente preto/giz com estrela âmbar (Preto vs Branco é a marca).
6. `Avatar.tsx` — paleta terrosa + iniciais condensed + plaqueta de posição.
7. `Estado.tsx` + `ConfirmDialog.tsx` — bordas duras, cantos 4px, sem sombras difusas.

**P2 — os momentos-assinatura:**
8. `PartidaDetalhe.tsx` — Placar LED + selo do Craque + carimbos de status (itens 4.1, 4.2, 4.5).
9. `Ranking.tsx` — pódio Top 3 + números em Chivo Mono.
10. `Jogos.tsx` — lista vira mini-placares LED compactos (mesma linguagem, escala menor).
11. `Resumo.tsx` — grid de destaques vira "Boletim do Ano": cabeçalho de súmula (linha pontilhada, data, temporada), números display grandes.
12. `Skeletons.tsx` — espelhar novas formas (raios, bordas) para manter CLS=0.

**P3 — polimento:**
13. `CampoPartida.tsx` — alinhar verdes do gramado ao token `--cor-campo`; chips com borda dura.
14. `Perfil.tsx`, `Administrador.tsx` — StatBox com número display, dívidas em mono.
15. Copy pass conforme tabela de microcopy.

## Cinco detalhes assinatura baratos

1. **Linha de súmula nos cabeçalhos:** título de tela sobre linha pontilhada dupla (`border-bottom: 2px dotted`) com "TEMPORADA {ano}" à direita em mono — 3 linhas de CSS, transforma todo `<h2>` anônimo.
2. **Números vazados:** colocação no ranking e placar do craque com `-webkit-text-stroke: 1.5px var(--cor-giz); color: transparent`.
3. **Carimbo "ENCERRADO":** span inclinado `-rotate-3`, borda dupla terracota, uppercase condensed — reaproveita em status, dívidas pagas, votos descartados.
4. **Fita adesiva no card do craque:** pseudo-elemento retângulo âmbar translúcido rotacionado (`rgba(255,179,0,.25)`).
5. **Footer de boletim:** última linha de cada tela com `text-[10px] font-mono text-giz-fraco`: "Racha Gragoatá · desde 2024 · toda quinta, CBO".

**Resumo executivo do eixo:** o app não precisa de mais decoração — precisa de UMA decisão (Preto/Branco + âmbar, tipografia de placar, bordas duras) aplicada com consistência onde hoje há `neutral-*` + `amber-500` + system-ui. O P1 inteiro é CSS e ativos estáticos; nenhum fluxo, rota ou dado muda.

---

# 4 · Novos requisitos e features

## Mapa do que JÁ EXISTE (confirmado no código)

**Núcleo**
- Partidas com ciclo `draft → live → published → closed`, times Preto/Branco, gols/assistências/GC: `src/lib/partidas.ts:4-26`
- **Modo Ao Vivo** com eventos lançáveis (gol, GC, assistência), desfazer/editar/finalizar: `PartidaAoVivo.tsx`, RPCs `registrar_evento`/`editar_evento` (migration 047)
- Votação 24h anônima com **média aparada** (descarta menor/maior nota com 3+ votos): migration 067, `PartidaVotar.tsx`, "descartar votos p/ refazer" em `partidas.ts:172`

**Das ideias óbvias, isto JÁ ESTÁ FEITO:**
- ✅ **Sorteio automático de times equilibrados por posição + nota**: completo em `escalacao.ts:38` (`gerarEscalacaoAutomatica`: goleiros alternados, pares ABBA por posição, balanceio por soma de notas + `posicao_b`), usado em `PartidaNovaTimes.tsx`
- ✅ **Presença semanal + lista de espera de 16 vagas**: `confirmar_presenca`, regra de vaga ocupada, admin override, avulsos preenchendo vagas (`partidas.ts:280-378`, migrations 057/058/059/054). Partida semanal **nasce sozinha** por cron toda segunda 10h BRT para mensalistas (migration 060)
- ⚠️ **Push notifications JÁ EXISTEM** (contrário ao PLANO.md): Web Push c/ VAPID + `push_subscriptions` + Edge Functions (migrations 036/037/040/043/045), toggle no Perfil (`pwa.ts:152`), lembretes de confirmação e de votação 30/15min antes de fechar. Banner interno também existe (`BannerLembrete.tsx`)
- ✅ Parte das **conquistas sazonais**: home mostra Artilheiro, Maestro, "O que importa é participar", Eficiente %, Maior sequência de vitórias, Maior seca — RPC `resumo_ano` (migrations 028+031) em `Resumo.tsx:121-155`. Mas: só ano corrente, estático, sem prêmios mensais/zoeira
- ✅ **Duplas/parcerias**: melhor/pior dupla do racha top/bottom 5 (`EstatisticasRacha.tsx`, RPC `pares_racha` 032); por jogador: melhor/pior companheiro/adversário, "mais gols junto" (`Estatisticas.tsx`, RPCs 030/042)
- ✅ Ranking 4 métricas com filtros posição+mín. partidas (`Ranking.tsx`); perfil com stats (`Perfil.tsx`)
- ✅ **Dívidas**: linha por evento (mensalidade/avulso/outro), RPCs registrar/quitar/quitar-todas, view `dividas_resumo`, cron de mensalidades (051/053/055), avulso automático ao publicar (054), tela `/administrador` com drill-down (`dividas.ts`, `Administrador.tsx`)
- Infra: PWA instalável, dark/light, haptics, pull-to-refresh, swipe tabs, jogadores "random" placeholder, superadmins hardcode (`jogadores.ts:23`)

## Top features novas (ordenadas por risada/esforço)

| # | Feature | O que é / por quê gruda | Esforço | Primeiro passo técnico |
|---|---------|------------------------|---------|------------------------|
| 1 | **Cartão do resultado p/ WhatsApp** | Imagem bonita (placar, craque, notas) gerada após fechar a votação, pronta pra colar no grupo. É o combustível do zoerinho — hoje alguém monta print na mão. | Baixo-médio | Componente `CartaoPartida.tsx` desenhando `<canvas>` nativo com `partida_placar` + `partida_notas`; botão em `PartidaDetalhe.tsx` chamando `navigator.share({files})` c/ fallback download |
| 2 | **Bolão de placar** | Palpite antes da quinta; acerto exato 3 pts, vencedor 1 pt; ranking de palpiteiros. Gera discussão quarta à noite e rivalidade própria. | Médio | Tabela `bolao_palpites(partida_id, jogador_id, gols_a, gols_b)` UNIQUE(partida,jogador); RPC `registrar_palpite` validando janela **server-side** (padrão `registrar_votos`); pontos calculados ao publicar. UI: seção no `PartidaDetalhe` quando draft/live |
| 3 | **Streak badges no Ranking 🔥🧊** | Fogo pra quem tá em sequência de vitórias, gelo pra quem tá na seca — atualizado a cada rodada. Custo mínimo, visibilidade máxima. | **Baixíssimo** | Sequências já calculadas no `resumo_ano` (031): extrair p/ RPC `sequencias_atuais(jogador_id)` ou computar no client; renderizar ícone na linha de `Ranking.tsx` |
| 4 | **Hall de records ("Livro do Racha")** | Records ALL-TIME: maior goleada, jogo com mais gols, invencibilidade mais longa, jejum histórico, maior zerada… vira tópico fixo de discussão. | Baixo-médio | Nova seção `<SecaoRacha titulo="Records">` (componente já extensível — `EstatisticasRacha.tsx:184`) + RPC `records_geral` consultando `partida_placar`/`partidas_participantes` |
| 5 | **Prêmios do mês (craque + zoeira)** | Craque do mês, Artilheiro do mês e o lendário **"Pior do mês"** (menor média, mín. 3 jogos) 🥇🥈🥉💩. Cadência mensal = briga constante; hoje só existe snapshot anual. | Baixo-médio | Generalizar `resumo_ano` → `resumo_periodo(p_ano, p_mes)` incluindo agregação de `partida_notas`; cards no Resumo com seletor de mês |
| 6 | **Comparador cara-a-cara** | Dois jogadores lado a lado (gols, assists, notas, % vitórias) + confronto direto mesmo time vs times opostos. Combate de vizinho = conteúdo garantido. | Baixo | Dados já existem (`stats_jogador`, `parcerias_jogador`); RPC `confronto_direto(a,b)` somando vitórias mútuas em `partidas_participantes` + `partida_placar`; tela `/comparar` com dois dropdowns |
| 7 | **Time da temporada (Seleção do Ano)** | 11 ideal pelas médias de nota do ano, estilo FIFA, com cartão compartilhável (sinergia c/ #1). Todo mundo quer saber se entrou. | Médio | RPC `time_temporada(p_ano)`: média de `avg_rating` por jogador no ano via `partida_notas` join `partidas` (published/closed), best-by-posição; render tipo escalação em campo |
| 8 | **Dívida com idade + copiar cobrança** | "Devedor há X semanas" 🚨 ordenado por antiguidade + botão copiando mensagem formatada pro WhatsApp ("@fulano, pendência de R$180 desde 12/07 😅"). Zoeira com propósito: faz o dinheiro entrar. | **Baixo** | Adicionar coluna derivada na view `dividas_resumo` (`date_part('week', now()-min(data_divida))`); botão `navigator.clipboard.writeText` montando texto em `Administrador.tsx` |
| 9 | **Elo/Poder do jogador** | Número único de "força" exibido no Perfil/Ranking; narrativa de evolução semanal — sobe na quarta à noite depois da votação. | Médio | Começar simples: `poder = 900 + media_nota*40 + vitorias*8 - derrotas*5` recalculado no fechamento da votação (hook no cron 015); coluna na view `ranking`; refinar p/ ELO real depois |
| 10 | **Mural "Momentos da temporada"** | Admin cola link de foto/vídeo do WhatsApp + legenda ("gol do Tadeu de bicicleta"); galeria simples navegável. Preserva a história do grupo fora do scroll infinito do ZAP. | Médio | Sem storage novo: tabela `momentos(id, partida_id null, url text, descricao, data)` + insert via SQL/RPC simples; tela `/momentos` |

## Ideias malucas mas baratas (uma tarde cada)

1. **Narração automática no Ao Vivo:** cada gol lançado sorteia frase pré-definida ("GOOOOL DO RODRIGO! A quadra veio abaixo! 📢", "É o gol do título??"). Só array de strings + `Math.random()` no `DialogoEvento`/timeline de `PartidaAoVivo.tsx`. Zero schema.
2. **"Nunca fui craque" 👻:** lista dos jogadores ativos que **nunca** foram craque (query trivial sobre `partida_notas.is_craque`). Pressão social pura. Nova seção no `EstatisticasRacha`.
3. **Botão "copiar ranking" como texto:** transforma a tabela em texto emoji formatado (`🏆 Dico — 87 pts\n2️⃣ …`) pro clipboard. Admin cola no grupo sem digitar nada. ~20 linhas.

## Conflitos com restrições atuais

- **Push**: a restrição "sem push" **já não vale** — pipeline completo existe (docs/notificacoes-push.md, migrations 036–045). Features novas (bolão aberto, resultado publicado, cobrança) devem **reusar esse pipeline** (cron/pg_net → Edge Function → `push_subscriptions`), com banner interno como fallback iOS.
- **Confiança no client**: o Bolão (#2) cria incentivo real a trapaça (alterar palpite após o jogo) — precisa do **bloqueio server-side duplo** no padrão do `registrar_votos` (014): validar janela dentro da RPC, não só esconder o form.
- **Anonimato dos votos**: é propriedade da UX, não do servidor. Comparador/Elo/Time da temporada devem consumir apenas `partida_notas` (agregados), **nunca** `votes` cru — manter essa fronteira nas views novas.
- **Sem storage/RLS**: o Mural (#10) usa links de propósito — habilitar Storage + policies fere a postura "sem RLS/triggers" do PLANO.md e adiciona superfície de manutenção pro dev solo.
- **pg_cron já carregado** (fecha votação, mensalidades, partida semanal): novos gatilhos seguem o padrão `unschedule-if-exists → schedule` das migrations 040/055/060.

**Sequência sugerida:** #1 (cartão) → #3 (badges) → #8 (cobrança) num fim de semana; #2 (bolão) na semana seguinte; #4/#5/#6 conforme o grupo pedir.

---

# 5 · Ordem sugerida de execução (roadmap consolidado)

**Fim de semana 1 — segurança + bugs (o que dói)**
1. Grant por coluna nas senhas (item 1.1) — 5 minutos, prioridade máxima.
2. Hooks antes dos guards (item 1.2).
3. RPC transacional na edição de partida (item 1.3).
4. Flag `ativo` nos effects com race condition (item 1.6).
5. Bug do PullToRefresh (item 2.1).
6. Fluxo de voto com progresso real + rascunho (item 2.2).

**Fim de semana 2 — identidade visual (o que se vê)**
7. P1 do design inteiro: tokens + fontes + ícones PWA + remover toggle + wordmark — muda a cara sem tocar em lógica.
8. Quick wins de UX (lista da seção 2) aproveitando o mesmo commit de CSS.

**Depois — valor contínuo**
9. P2 visual (placar LED, pódio, mural de placares) + P3 polimento/copy.
10. Streak badges + cartão WhatsApp + cobrança de dívida (maior risada por hora investida).
11. Bolão de placar; demais features conforme o grupo pedir.
12. Prettier + ESLint mínimos; ADDENDUM/atualização do PLANO.md.
