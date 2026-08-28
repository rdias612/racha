# 🔧 Plano de Refatorações — Racha Gragoatá CBO

> **Data da auditoria**: 2026-08-25
> **Escopo**: `src/routes/` (22 arquivos, ~9.900 linhas), `src/components/`, `src/hooks/`, `src/context/`, `src/lib/` (15 módulos), `supabase/` (`aplicar_tudo.sql` + 85 migrations + 3 Edge Functions), arquivos raiz e configuração.
> **Metodologia**: auditoria por área (5 revisões independentes), com verificação cruzada contra o `AGENTS.md` (regras canônicas), o `design-system.md` e buscas reais de uso (grep) para confirmar código morto e duplicações.
> **Como usar**: itens numerados por prioridade (`P0-1`, `P1-2`, ...). Cada item tem referência `arquivo:linha` clicável, problema e refatoração sugerida. Ao concluir um item, marque ✅.

---

## 📊 Resumo Executivo

| Prioridade | Significado                                                                   | Quantidade |
| ---------- | ----------------------------------------------------------------------------- | ---------- |
| **P0**     | Bugs reais em produção e falhas de segurança exploráveis                      | 14         |
| **P1**     | Riscos de estado obsoleto, quebras de regra canônica e código de alto impacto | 18         |
| **P2**     | Eliminação de duplicação (componentes/queries/SQL), tokens e performance      | 26         |
| **P3**     | Limpeza, código morto, tipagem fina e polimento                               | 22         |

**Top 5 por retorno**:

1. **Migration de `REVOKE` das escritas diretas** (P0-1) — maior impacto de segurança, menor risco de mudança.
2. **Corrigir bug de `match_id`** (P0-8) — função "editar votos" está silenciosamente quebrada.
3. **`aplicar_tudo.sql` quebra ao aplicar** (P0-5/P0-6) — o script mestre do banco está com erro de SQL e objetos faltando.
4. **Tipos gerados do Supabase** (`createClient<Database>`) (P1-1) — elimina a causa raiz de ~15 casts perigosos.
5. **Pacote de componentes compartilhados** (P2-1 a P2-9) — remove a maior parte da duplicação entre telas.

---

# 🚨 P0 — Bugs e Segurança Crítica (corrigir imediatamente)

## Banco de Dados (Segurança)

### P0-1. Escrita direta nas tabelas concedida a `anon` — escalada de privilégio trivial

**Onde**: `supabase/migrations/016_grants_baseline.sql:18-19`
O `GRANT INSERT, UPDATE, DELETE ON partidas, partidas_participantes, votes TO anon, authenticated` e o `GRANT UPDATE ON jogadores TO anon` nunca foram revogados — a migration `069` só revogou o `SELECT` de `senha_hash`. Sem RLS no banco, qualquer pessoa com a anon key (embutida no bundle) pode fazer `PATCH /rest/v1/jogadores?id=eq.N` com `{"is_admin": true}` ou `{"senha_hash": "x"}` e assumir qualquer conta, editar votos alheios fora da janela de 24h e mudar status de partidas.
**Refatoração**: migration nova `REVOKE INSERT, UPDATE, DELETE ON partidas, partidas_participantes, votes, dividas, push_subscriptions, jogadores FROM anon, authenticated;`. Toda escrita já tem RPC `SECURITY DEFINER` correspondente.

### P0-2. ✅ Gates de admin bypassáveis com `p_admin_id IS NULL`

**Onde**: `supabase/migrations/083_seguranca_goleiros_e_admin_gates.sql:88` e `:88`→`:165` (`salvar_times_e_goleiros_partida` e `abrir_partida`; idem `aplicar_tudo.sql:4561` e `:4632`)
O gate é `IF p_admin_id IS NOT NULL AND NOT EXISTS (...)` — chamando a RPC **sem** o argumento opcional, a condição inteira é falsa e nenhuma validação roda: anon monta escalação e abre partida. A própria `criar_goleiro_rapido` na mesma migration usa o padrão correto (`IS NULL OR NOT EXISTS`).
**Refatoração**: inverter para `IF p_admin_id IS NULL OR NOT EXISTS (...) THEN RAISE EXCEPTION ...`.

### P0-3. ✅ Overload antigo de `abrir_partida(bigint)` continua grantado

**Onde**: `aplicar_tudo.sql:4311-4365` (versão sem gate, com `GRANT EXECUTE ... TO anon` na linha 4365)
A 083 criou `abrir_partida(bigint, bigint)` com gate, mas não fez `DROP FUNCTION` da assinatura antiga — `CREATE OR REPLACE` com assinatura diferente não substitui o overload. O atacante chama a assinatura antiga e abre a partida sem validar admin.
**Refatoração**: `DROP FUNCTION abrir_partida(bigint);` na migration `088_drop_abrir_partida_overload_antigo.sql`.

### P0-4. Bug de SQL no mestre: `aplicar_tudo.sql` falha ao aplicar

**Onde**: `supabase/aplicar_tudo.sql:3159` — `FROM todos` dentro do `pares_racha` recriado no bloco 076; a migration original correta usa `FROM agregado a` (`076_remover_coluna_nome_jogadores.sql:630`)
A função é `LANGUAGE sql`: o PostgreSQL valida o corpo no `CREATE`, então o script mestre **quebra com `missing FROM-clause entry for table "todos"`** antes de terminar. O mestre foi editado à mão e divergiu.
**Refatoração**: corrigir para `FROM agregado a` e passar a gerar o mestre por concatenação automática das migrations (ou `supabase db dump`), nunca edição manual.

### P0-5. `aplicar_tudo.sql` não é auto-suficiente (referencia objetos que não cria)

**Onde**: verificado por grep — `partida_eventos` usada em `aplicar_tudo.sql:1952, 4036, 4350, 4662` (tabela criada só na migration `047`); `sincronizar_contadores_partida` chamada em `:1675, 3970`; colunas `telefone`/`chave_pix` usadas em `:4518-4537` (criadas só na `082`); `resetar_senha` (065) e `excluir_partida` (066) ausentes do mestre embora o app as use; grants de schema da `016` também ausentes.
**Refatoração**: incluir os blocos 016/047/065/066/082 no mestre, ou extinguir o mestre e documentar `supabase db push` + `supabase db reset` como fluxo único.

### P0-6. Escrita direta em `dividas` e `push_subscriptions` para anon + senhas em texto puro

**Onde**: `036_create_push_notifications.sql:25` e `051_create_dividas.sql:26-27` (grants totais a anon); senhas: `021_plaintext_passwords.sql` + `022_seed_jogadores.sql` (todos os admins com `'123'`)
Sem RLS, anon pode `DELETE /rest/v1/push_subscriptions` (derrubar notificações de todos), quitar dívidas de quem quiser, criar dívidas para vítimas. As RPCs `quitar_divida`/`quitar_dividas_jogador` também não têm gate de admin. As senhas em texto puro são risco aceito historicamente, mas os caminhos de UPDATE do P0-1 os transformam em takeover completo (o `pgcrypto` da migration 002 está habilitado e não é usado).
**Refatoração**: revogar escrita (junto do P0-1) + gates `is_admin` nas RPCs de quitação; migrar senhas para `crypt(p_senha, senha_hash) = senha_hash` (bcrypt) com troca obrigatória no primeiro login.

## Frontend (Bugs reais)

### P0-7. ✅ Query com coluna inexistente (`match_id`) engole erro — votos anteriores nunca carregam

**Onde**: `src/routes/PartidaVotar.tsx:118`
A tabela `votes` tem a coluna `partida_id` (migration 006); `.eq('match_id', partidaId)` retorna erro PGRST204 **sempre**, mas a desestruturação `const { data: meusVotos }` sem checar `error` engole a falha — a tela sempre cai no rascunho do localStorage e a função "editar voto" está quebrada em produção.
**Refatoração**: corrigir para `partida_id` e mover a leitura para `lib/partidas.ts` (`carregarMeusVotos(partidaId, voterId)`) — `votes` já é consultado à mão em 4 lugares (`BannerLembrete.tsx:42`, `PartidaDetalhe.tsx:76`, `PartidaVotar.tsx:116`, fallback em `lib/jogadores.ts:180`).

### P0-8. ✅ `Math.random()` dentro do comparator de `sort` viola o contrato

**Onde**: `src/lib/escalacao.ts:91-93`
`(a, b) => b.nota - a.nota + (Math.random() * 0.2 - 0.1)` gera ruído **por comparação**: o mesmo par pode ser ordenado `a<b` e `b<a`, produzindo ordem não especificada. O `embaralhar()` das linhas 53-54 é trabalho morto (o `sort` total por nota na linha 64 descarta a ordem).
**Refatoração**: aplicar jitter fixo uma vez por jogador antes de ordenar (`notaEfetiva = nota + (rng() * 0.2 - 0.1)` como campo derivado) e remover o `embaralhar` antes de sorts totais.

### P0-9. ✅ `SessaoContext` sem flag de cleanup — race condition real

**Onde**: `src/context/SessaoContext.tsx:54-86`
`sincronizarJogador` é assíncrona dentro de `useEffect` sem `let ativo = true`. Se `jogador` mudar com o fetch em voo, duas syncs intercalam e a resposta mais antiga pode resolver por último, sobrescrevendo estado novo com dado obsoleto. Agravado pelos non-null assertions `jogador!.id` (linhas 64, 74-78).
**Refatoração**: flag `ativo` + capturar `const id = jogador.id` antes do await (elimina os `!`).

### P0-10. ✅ useEffects assíncronos sem flag `ativo` (viola AGENTS 5.2)

**Onde** (telas fora de `useCache`):

- `src/routes/Estatisticas.tsx:81-95` e `:97-146`
- `src/routes/EstatisticasRacha.tsx:82-97`
- `src/routes/PartidaNova.tsx:37-71`
- `src/routes/PartidaNovaTimes.tsx:32-38`
- `src/routes/Perfil.tsx:57-69`
- `src/routes/Login.tsx:27-32`
- `src/components/BannerLembrete.tsx:25-58` (polling com `setInterval` sem cleanup de estado + erro ignorado + fetch duplicado quando `pendentes.length` muda as deps)

**Refatoração**: aplicar o padrão canônico do AGENTS 5.2 (referência correta: `PartidaDetalhe.tsx:134-140`). No `BannerLembrete`, separar "fetch" de "agendamento" (deps `[jogadorId]` apenas, valor atual via ref) e pausar quando `document.hidden`.

### P0-11. ✅ Múltiplos round-trips sem transação em lote de jogadores

**Onde**: `src/routes/GestaoJogadores.tsx:243-253`
`salvarTodasAlteracoes` faz `for (...) await atualizarCaracteristicasJogador(...)` — falha no meio deixa metade dos jogadores alterada, mas a tela já cometeu `setJogadores(jogadoresDraft)` antes (`:256`). Viola a atomicidade do AGENTS 7.4.
**Refatoração**: RPC em lote `salvar_caracteristicas_jogadores(p_jsonb)`; só atualizar estado local após sucesso.

### P0-12. ✅ Snackbar de sucesso otimista antes da confirmação do servidor

**Onde**: `src/routes/Administrador.tsx:232-243` e `:264-271`
`handleQuitar`/`handleQuitarTodas` exibiam "Lançamento marcado como quitado" **antes** do `await quitarDivida(...)`; em falha o usuário recebia toast de sucesso seguido de erro.
**Refatoração**: mover o toast de sucesso para depois do `await` (o rollback otimista da UI pode permanecer).

### P0-13. ✅ Navegação por teclado quebrada nos dois listbox customizados

**Onde**: `src/components/SelectSumula.tsx:175` e `src/components/SeletorNota.tsx:164`
O handler de teclado estava preso ao `<ul tabIndex={-1}>`, mas o foco nunca saía do botão gatilho — ArrowUp/Down não faziam nada e Enter **fechava** o popup. Usuário de teclado abria mas não conseguia escolher.
**Refatoração**: unificar o handler de teclado no botão gatilho combobox, implementar `aria-activedescendant` referenciando IDs das opções e suporte a ArrowUp/Down/Home/End/Enter/Space/Escape/Tab.

---

# ⚠️ P1 — Alto Impacto (estado obsoleto, regras canônicas, arquitetura)

## Tipos e Frontend

### P1-1. ✅ Cliente Supabase sem tipos gerados — causa raiz dos casts

**Onde**: `src/lib/supabase.ts:12`
`createClient` sem o genérico `Database`: todo `select()` retornava `any` e cada módulo pagava com casts duplos.
**Refatoração**: `supabase gen types typescript` → `createClient<Database>`; tipagem estrita no singleton Supabase e remoção de casts frágeis.

### P1-2. ✅ Mutações sem `invalidarCache` — dados obsoletos no mural/resumo

**Onde**: `src/routes/PartidaNovaTimes.tsx:111`, `src/routes/PartidaTimes.tsx:190`, `src/routes/PartidaAoVivo.tsx:199`, `src/routes/PartidaEditar.tsx:234`, `src/routes/PartidaDetalhe.tsx:162`, `src/routes/Jogos.tsx:122`
Criar partida, salvar times/goleiros, finalizar partida, abrir partida e salvar edição afetam `jogos`/`resumo`.
**Refatoração**: chamar `invalidarCache('jogos')` e `invalidarCache('resumo')` após cada mutação bem-sucedida (AGENTS 5.5, item 5).

### P1-3. ✅ `useCache`: invalidação não atualiza telas montadas

**Onde**: `src/hooks/useCache.ts:90-113` (efeito), `:19-23` (`invalidarCache`)
A proteção por geração existe no cache de módulo, mas (a) o `useEffect` gravava resultado de geração antiga no **estado local** sem checar; (b) após invalidação, tela já montada nunca revalidava (deps `[chave, buscar]` não mudam).
**Refatoração**: checar geração no consumer antes do `setEstado` + registry de ouvintes (listeners) para `invalidarCache` disparar refetch em componentes montados; `recarregar` com bypass de dedupe no PullToRefresh.

### P1-4. Componentes gigantes com responsabilidade misturada

**Onde e quebra sugerida**:

- `src/routes/PartidaDetalhe.tsx` (855 linhas) → `PlacarLed.tsx`, `CardCraque.tsx`, `ListaNotas.tsx`, `GridTimes.tsx` + mover `Confirmacoes` (608-855) para `components/ConfirmacoesPartida.tsx`.
- `src/routes/Administrador.tsx` (845 linhas, ~20 `useState`) → `FormLancamento`, `SecaoExportacao`, `ListaReceitas`, `ListaDespesas`.
- `src/routes/Notificacoes.tsx` (770 linhas) → `SecaoConfirmacao`, `SecaoVotacao`, `SecaoTestes` (recebendo `config`/`setConfig`).
- `src/routes/GestaoJogadores.tsx` (744) → `LinhaJogadorGestao.tsx`, `BarraRascunho.tsx`.
- `src/routes/PartidaEditar.tsx` (737) → extrair modal inline de ~120 linhas (`:509-631`).
- `src/components/EventosAutomaticosFinanceiro.tsx` (474) → `<FormEventoAutomatico>` separado.

### P1-5. Queries e RPCs direto nas telas (fora de `lib/`)

**Onde**: `NovoJogador.tsx:44`, `PartidaNovaTimes.tsx:86`, `PartidaTimes.tsx:179`, `PartidaVotar.tsx:65-69/115-119/209`, `Perfil.tsx:60-64/155`, `Login.tsx:66`, `Resumo.tsx:60-67`, `Estatisticas.tsx:83-94/104-116`, `Comparador.tsx:141-147`
O domínio vive em `lib/partidas.ts`/`lib/jogadores.ts`; esses acessos diretos quebram o padrão e dificultam teste/reuso.
**Refatoração**: wrappers nas libs (`criarJogador`, `trocarSenha`, `fazerLoginRpc`, `carregarStatsJogador`, `obterPartidaDraftAtual`).

### P1-6. ✅ Regra de "partida draft atual" com dois critérios divergentes

**Onde**: `src/lib/notificacoes.ts:116-130` (`order by id desc`) vs `src/routes/Resumo.tsx:62-67` (`order by data_jogo asc`)
Com dois drafts no banco, as telas exibem partidas diferentes como "a próxima".
**Refatoração**: expor `obterPartidaDraftAtual` em `lib/partidas.ts` com critério único documentado.

### P1-7. ✅ Regra de "votação aberta" inconsistente entre telas

> Corrigido em 2026-08-27: extraída a função pura e canônica `votacaoAberta(partida)` em `src/lib/partidas.ts` aplicando estritamente as regras de negócio de AGENTS 8.1 (status `'published'`, `voting_closes_at` presente e válido, e timestamp futuro). Substituídas todas as checagens inline divergentes e comparações de string em `PartidaVotar.tsx`, `PartidaDetalhe.tsx` e `BannerLembrete.tsx`.
> **Onde**: `src/lib/partidas.ts`, `src/routes/PartidaVotar.tsx`, `src/routes/PartidaDetalhe.tsx`, `src/components/BannerLembrete.tsx`.

### P1-8. ✅ Fallback de médias baixa a tabela votes inteira + duplica regra SQL

> Corrigido em 2026-08-27: removido o fallback client em `src/lib/jogadores.ts` que consultava a tabela inteira `votes` e recalculava a média aparada no JavaScript. A função `obterMediasNotasJogadores` (e o alias `carregarMediasNotasJogadores`) agora consulta unicamente a RPC `obter_medias_notas_jogadores` do PostgreSQL e propaga eventuais erros diretamente (throw), alinhando-se aos padrões canônicos de integridade e tratamento de erros do projeto.
> **Onde**: `src/lib/jogadores.ts:193-211`.

### P1-9. ✅ (resolvido pela P0-12) Checagem de `MAX_MENSALISTAS` com race condition (TOCTOU)

> Corrigido em 2026-08-25: a função client `atualizarCaracteristicasJogador` foi removida e substituída pela RPC transacional `salvar_caracteristicas_jogadores` (migration 087), que valida o teto de 14 mensalistas no servidor sobre o estado final do lote.
> **Onde**: `src/lib/jogadores.ts:111-135`
> Lê jogador → `count` → `update` em três idas sem transação: dois admins simultâneos excedem o limite de 14. O `update` também sobrescreve sem verificar estado atual.
> **Refatoração**: RPC transacional `atualizar_caracteristicas_jogador` (padrão já usado no resto do app).

### P1-10. ✅ (resolvido pela P0-12) Branch inalcançável esconde validação ausente

> Corrigido em 2026-08-25: a função client com o branch morto foi removida; a validação "apenas mensalista pode ser admin" agora existe de verdade e é aplicada server-side na RPC `salvar_caracteristicas_jogadores`.
> **Onde**: `src/lib/jogadores.ts:101-107`
> Em `atualizarCaracteristicasJogador`, `if (payload.is_mensalista === false) { payload.is_admin = false; }` força admin=false, tornando o `if` seguinte (`is_admin === true && is_mensalista === false`) **sempre falso** — o throw "Apenas mensalistas podem ser administradores" nunca dispara, e a guarda real não existe.
> **Refatoração**: reordenar validação antes da mutação do payload e espelhar a regra no servidor (RPC).

### P1-11. ✅ Tratamento de erros com três estratégias convivendo

> Corrigido em 2026-08-25: padronizada a estratégia canônica "lib lança cru, borda usa `formatarMensagemErro`". No `src/lib/erros.ts`, adicionada tipagem `ErroComCodigo` e checagem prioritária de códigos de status PostgreSQL (`23505`, `42501`, `23503`) e PostgREST (`PGRST301`, `PGRST116`), cobrindo violações de RLS e erros de conexão. Removido o re-wrap com `new Error` que descartava metadados em `src/lib/notificacoes.ts`. Substituídas todas as ocorrências de mensagens cruas (`error.message` / `err.message` / `e.message`) nas telas e componentes por `formatarMensagemErro`.
> **Onde**: `src/lib/erros.ts`, `src/lib/notificacoes.ts`, `src/routes/Login.tsx`, `src/routes/Perfil.tsx`, `src/routes/PartidaVotar.tsx`, `src/routes/PartidaTimes.tsx`, `src/routes/PartidaNovaTimes.tsx`, `src/routes/PartidaNova.tsx`, `src/routes/PartidaEditar.tsx`, `src/routes/PartidaDetalhe.tsx`, `src/routes/PartidaAoVivo.tsx`, `src/routes/NovoJogador.tsx`, `src/routes/Notificacoes.tsx`, `src/routes/GestaoJogadores.tsx`, `src/routes/EstatisticasRacha.tsx`, `src/routes/Estatisticas.tsx`, `src/routes/Administrador.tsx`, `src/routes/Jogos.tsx`, `src/components/ModalNovoGoleiro.tsx`, `src/components/EventosAutomaticosFinanceiro.tsx`.

### P1-12. ✅ Alvos de toque abaixo de 44px (violação de AGENTS 6.1 resolvida)

> Corrigido em 2026-08-25: auditados e elevados todos os alvos de toque interativos para no mínimo `min-h-[44px]`, com padding adequado, `cursor-pointer`, feedback tátil e foco acessível nos tokens do Design System. Padronizadas as abas de métricas e filtros de posição em `Ranking.tsx`, ordenação de colunas do `thead` em `Ranking.tsx` e `EstatisticasRacha.tsx`, abas de filtro em `GestaoJogadores.tsx`, botões de adição de avulsos em `PartidaDetalhe.tsx`, botões de edição/desfazer de eventos em `PartidaAoVivo.tsx`, botão limpar em `PartidaNova.tsx`, links de telefone/WhatsApp em `GestaoGoleiros.tsx`, select de atleta em `Estatisticas.tsx`, botão fechar em `Snackbar.tsx`, e inputs/seleção rápida em `Login.tsx`. Os 11 botões de voltar já haviam sido unificados pelo `BotaoVoltar` (P2-1).
> **Onde**: `src/routes/GestaoJogadores.tsx`, `src/routes/Ranking.tsx`, `src/routes/EstatisticasRacha.tsx`, `src/routes/PartidaDetalhe.tsx`, `src/routes/PartidaAoVivo.tsx`, `src/routes/PartidaNova.tsx`, `src/routes/GestaoGoleiros.tsx`, `src/routes/Estatisticas.tsx`, `src/routes/Login.tsx`, `src/components/Snackbar.tsx`, `src/components/BotaoVoltar.tsx`.

### P1-13. ✅ (resolvido por P2-11) Modais sem focus trap / foco inicial (padrão existe só no ConfirmDialog)

> Corrigido em 2026-08-25: criado hook canônico `src/hooks/useModalA11y.ts` com gerenciamento de foco inicial, focus trap circular (`Tab`/`Shift+Tab`), restauração do foco anterior no fechamento, `Escape` e trava de scroll no `document.body`. Integrado ao componente unificado `src/components/ModalBase.tsx`, `ConfirmDialog.tsx` e `DialogoEvento.tsx`.
> **Onde**: `ModalSelecionarAgendamento.tsx`, `ModalSelecionarGoleiro.tsx`, `ModalSelecionarOpcao.tsx`, `ModalNovoGoleiro.tsx`, `DialogoEvento.tsx` e `PartidaEditar.tsx`.

### P1-14. `Push`/`Sessao`: estado desativado silencia falhas e jogador inativo mantém sessão

**Onde**: `src/lib/pwa.ts:140-153` (`statusPush` converte **qualquer** erro em `'desativado'`, induzindo "reativar" desnecessário); `src/context/SessaoContext.tsx:66` (`!data || !data.is_ativo` faz `return` silencioso — sem logout/limpeza, admin inativado continua navegando com dado stale)
**Refatoração**: propagar erro no `statusPush`; no contexto, `setJogador(null)` + limpar `localStorage` quando `is_ativo = false`.

## Banco (P1)

### P1-15. Loops PL/pgSQL com INSERT por elemento

**Onde**: `registrar_votos` (`aplicar_tudo.sql:562-571`), `criar_partida` (`:1993-2007`), `salvar_edicao_partida` (`:4085-4108`), `salvar_times_e_goleiros_partida` (`:4569-4575`)
`FOR elem IN jsonb_array_elements LOOP INSERT` executa N statements com EXCEPTION/ROLLBACK manual.
**Refatoração**: `INSERT INTO ... SELECT ... FROM jsonb_array_elements(p_participantes) ON CONFLICT ...` — 1 comando atômico.

### P1-16. ✅ Cron jobs disparam Edge Functions sem verificar resposta — falha silenciosa acumulável

> Corrigido em 2026-08-27: criada a migration `099_cron_http_response_logging.sql` e sincronizado `aplicar_tudo.sql`. Criada a tabela de auditoria `cron_execucoes` com índices e política de retenção de 30 dias. Implementada a função PL/pgSQL `disparar_e_registrar_cron_http` com `SECURITY DEFINER` e `SET search_path = public`, com disparo assíncrono via `net.http_post`, coleta e validação de resposta HTTP com timeout e fallback (`net._http_response` / `net.http_collect_response`), gravação de status code, resposta e erro em `cron_execucoes`, além de registro explícito de falhas na ausência do secret no Vault. Atualizadas as RPCs `disparar_confirmacao_manual`, `disparar_push_teste`, `salvar_configuracoes_notificacoes` e os jobs `enviar-push-reminders-1min` e `agendar-partida-semanal`.
> **Onde**: `supabase/migrations/099_cron_http_response_logging.sql`, `supabase/aplicar_tudo.sql`.

---

# 🔄 P2 — Eliminação de Duplicação, Tokens e Performance

## Pacote de componentes compartilhados (frontend)

### P2-1. ✅ `BotaoVoltar` — markup replicado 11x com divergência

`PartidaDetalhe.tsx:186-191`, `Administrador.tsx:373-379`, `Notificacoes.tsx:208-214`, `PartidaVotar.tsx:247-252`, `PartidaNova.tsx:155-160`, `NovoJogador.tsx:76-81`, `PartidaAoVivo.tsx:210-216` etc. → `components/BotaoVoltar.tsx` (fallback via prop, `voltar()` interno, `min-h-[44px]`).

### P2-2. ✅ `BarraAcaoInferior` — barra fixa inferior duplicada 6x

`PartidaEditar.tsx:484-506`, `PartidaNova.tsx:275-297`, `PartidaAoVivo.tsx:346-362/364-382` (as duas últimas quase idênticas entre si), `PartidaVotar.tsx:342-361`, `PartidaConfirma.tsx:90-111` → children + legenda opcional, com o `paddingBottom: calc(... + env(safe-area-inset-bottom))` interno.

### P2-3. ✅ `AbasEstatisticas` — barra de abas triplicada

`Estatisticas.tsx:193-230`, `EstatisticasRacha.tsx:146-183`, `Comparador.tsx:260-270` (mesmos 3 `NavLink` com ~30 linhas de classes; `Comparador` já tem `classeAba` em `:53-58`).

### P2-4. ✅ `StatBox` + fetcher de `stats_jogador` triplicados

Componente idêntico em `Perfil.tsx:393-404` e `Estatisticas.tsx:410-421`; interface `Stats` + query em `Perfil.tsx:18-25/60-64`, `Estatisticas.tsx:15-22/104-109`, `Comparador.tsx:26-33/141-147` → `components/StatBox.tsx` + `lib/jogadores.ts → carregarStatsJogador(ids)`.

### P2-5. ✅ `useSnackbar` — estado+helper de snackbar duplicado 5x

`Administrador.tsx:74-88`, `Notificacoes.tsx:80-90`, `GestaoJogadores.tsx:60-64`, `GestaoGoleiros.tsx:56-59`, `Jogos.tsx:62-70` → hook com haptics padronizados (hoje só `Notificacoes` vibra).

### P2-6. ✅ `CampoBusca` — campo de busca com botão limpar duplicado 4x

> Corrigido em 2026-08-25: criado componente canônico `src/components/CampoBusca.tsx` com alvos de toque acessíveis (min-h-[44px]), prevenção de zoom no iOS (text-base sm:text-sm), foco âmbar visível, suporte a variantes (superficie/superficie-2) e tipografia (sans/mono). Aplicado em `GestaoJogadores.tsx`, `GestaoGoleiros.tsx`, `PartidaNova.tsx`, `PartidaEditar.tsx` e `ModalSelecionarGoleiro.tsx`.

### P2-7. ✅ `Toggle` — switch triplicado no mesmo arquivo

> Corrigido em 2026-08-25: criado componente canônico `src/components/Toggle.tsx` com alvos de toque acessíveis (min-h-[44px]), anel de foco visível pelo teclado, transição suave e integração acessível com leitores de tela. Aplicado em `Notificacoes.tsx` nas seções de confirmação semanal, reforço e votação pós-jogo.

### P2-8. ✅ `CabecalhoTime` + `BadgeTime` — cabeçalho/badge de time com hex inline triplicado

> Corrigido em 2026-08-25: criados componentes canônicos `src/components/BadgeTime.tsx` e `src/components/CabecalhoTime.tsx` utilizando exclusivamente os tokens semânticos `bg-preto-time`, `bg-branco-time` e `font-display uppercase tracking-widest`. Aplicados em `PartidaDetalhe.tsx`, `PartidaVotar.tsx`, `PartidaEditar.tsx`, `ModalSelecionarGoleiro.tsx` e `EscalacaoTimesEditor.tsx`.

### P2-9. ✅ `PainelPlacar` — painel LED triplicado com hex hardcodado

> Corrigido em 2026-08-25: adicionados tokens de LED `--cor-led-fundo`, `--cor-led-fundo-hover` e `--cor-led-borda` ao `src/index.css`. Criado componente unificado `src/components/PainelPlacar.tsx` com as variantes `completo`, `compacto` e `edicao`, eliminando hexadecimais inline em `PartidaDetalhe.tsx`, `Jogos.tsx`, `PartidaEditar.tsx`, `CampoPartida.tsx` e `Skeletons.tsx`.

### P2-10. ✅ Motor de listbox duplicado (`useListbox`: `SelectSumula` vs `SeletorNota`)

> Corrigido em 2026-08-25: criado hook canônico `src/hooks/useListbox.ts` com gerenciamento de estado (`aberto`, `destaque`, `listaId`), auto-scroll (`scrollIntoView`), fechamento ao clicar fora (`mousedown`), navegação completa por teclado acessível (ArrowDown, ArrowUp com wrap cíclico e filtro de desabilitados, Home, End, Enter, Space, Escape, Tab) e haptics (`vibrateLight`). Refatorados `src/components/SelectSumula.tsx` e `src/components/SeletorNota.tsx` como cascas puras de renderização, substituindo ícone inline por `ChevronDown` do Lucide.
> **Onde**: `src/hooks/useListbox.ts`, `src/components/SelectSumula.tsx`, `src/components/SeletorNota.tsx`.

### P2-11. ✅ Casca de modal duplicada em 4 arquivos

> Corrigido em 2026-08-25: criados o hook `src/hooks/useModalA11y.ts` e o componente canônico `src/components/ModalBase.tsx` com portal, backdrop blur, Escape, trava de scroll no body, focus trap circular, foco inicial e botões de fechar acessíveis de 44px. Refatorados `ModalSelecionarAgendamento.tsx`, `ModalSelecionarGoleiro.tsx`, `ModalSelecionarOpcao.tsx`, `ModalNovoGoleiro.tsx`, o modal inline de `PartidaEditar.tsx`, `ConfirmDialog.tsx` e `DialogoEvento.tsx`.

## Queries e estado (frontend)

### P2-12. ✅ Select de colunas de `jogadores` copiado 4x + pós-processamento superadmin triplicado

> Corrigido em 2026-08-25: definidos `COLUNAS_JOGADOR_LISTA`, `aplicarSuperAdmin` e `mapearJogadorLista` em `src/lib/jogadores.ts`. Refatoradas as consultas em `listarJogadoresAtivos`, `listarTodosJogadores`, `listarGoleiros` e a sincronização de sessão em `src/context/SessaoContext.tsx`. Adicionadas notas de design documentando a intenção explícita de `listarJogadoresAtivos` incluir placeholders `random` (slots temporários para escalação/partidas) enquanto `listarTodosJogadores` filtra `random` (catálogo administrativo de atletas reais).

### P2-13. ✅ Queries de `dividas` duplicadas

> Corrigido em 2026-08-25: definidos `SELECT_DIVIDA` e o mapeador canônico `mapearLinhaDivida` em `src/lib/dividas.ts`, unificando a projeção de 13 colunas com join em `jogadores` e a normalização de `natureza` para `'receita'`/`'despesa'` nas funções `listarDividasEmAberto` e `listarLancamentosPorPeriodo`.

### P2-14. ✅ Chaves de cache como strings mágicas + `'resumo'` sem ano

> Corrigido em 2026-08-27: criado `src/lib/chavesCache.ts` como fonte única das chaves do cache SWR (`CHAVE_JOGOS`, `chaveResumo(ano)`, `chaveRanking(filtro)`, `chaveComparador(idA, idB)`), com o ano entrando na chave do resumo (corrige o bug da virada de ano). Todas as leituras (`useCache`) e invalidações (`invalidarCache`) em `Jogos.tsx`, `Resumo.tsx`, `Ranking.tsx`, `Comparador.tsx`, `PartidaDetalhe.tsx`, `PartidaAoVivo.tsx`, `PartidaNovaTimes.tsx`, `PartidaTimes.tsx` e `PartidaEditar.tsx` passaram a importar daqui — zero literais de chave inline em rotas e componentes.
> **Onde**: `src/lib/chavesCache.ts` e as rotas listadas.

### P2-15. ✅ `LIMITE_POR_TIME` vive num componente (inversão de camadas)

> Corrigido em 2026-08-27: `LIMITE_POR_TIME = 7` movido para `src/lib/times.ts` (módulo folha, sem imports — impossibilita ciclo) e `CAPACIDADE_PARTIDA` agora é derivada em `src/lib/partidas.ts` como `LIMITE_POR_TIME * 2`, tornando o acoplamento 14 = 7×2 explícito. `EscalacaoTimesEditor.tsx`, `useEscalacaoTimes.ts` e `PartidaTimes.tsx` importam da lib; o export do componente foi removido sem re-export de compatibilidade.
> **Onde**: `src/lib/times.ts`, `src/lib/partidas.ts`, `src/components/EscalacaoTimesEditor.tsx`, `src/hooks/useEscalacaoTimes.ts`, `src/routes/PartidaTimes.tsx`.

### P2-16. ✅ Regra do placar (gol contra soma para o adversário) reimplementada no cliente

> Corrigido em 2026-08-25: criada função canônica e testável `calcularPlacarDeParticipantes(participantes)` em `src/lib/partidas.ts`. Integrada em `src/routes/PartidaEditar.tsx` eliminando o loop duplicado de cálculo de gols próprios e gols contra.
> **Onde**: `src/lib/partidas.ts`, `src/routes/PartidaEditar.tsx`.

### P2-17. ✅ Ordenações/filtros recomputados a cada render (sem `useMemo`)

> Corrigido em 2026-08-25: memoizadas com `useMemo` todas as operações de ordenação, filtros pesados e cálculos derivados em `Ranking.tsx` (linhas, colunas, máximo de partidas), `EstatisticasRacha.tsx` (pares ordenados e melhor/pior), `Estatisticas.tsx` (parcerias, filtros, destaques e username), `GestaoJogadores.tsx` (rascunhos, contagens de mensalistas/admins e filtros), `PartidaDetalhe.tsx` (escalação por time, notas ordenadas, ordenação de presença e candidatos avulsos) e `DialogoEvento.tsx` (nome e separação por time). Todos os hooks foram rigorosamente posicionados no topo dos componentes antes de quaisquer retornos condicionais (Strict Rules of Hooks).
> **Onde**: `src/routes/Ranking.tsx`, `src/routes/EstatisticasRacha.tsx`, `src/routes/Estatisticas.tsx`, `src/routes/GestaoJogadores.tsx`, `src/routes/PartidaDetalhe.tsx`, `src/components/DialogoEvento.tsx`.

### P2-18. ✅ `PullToRefresh` dispara `setState` a cada touchmove

> Corrigido em 2026-08-25: refatorado `src/components/PullToRefresh.tsx` para acumular a distância de arrasto em `ref` e manipular o elemento indicador diretamente via DOM (`ref.style`), eliminando completamente os re-renders da rota inteira (~60 FPS) durante o gesto de touch. Adicionados cacheamento de `getScrollTop` no `touchstart`, detecção de cruzamento de threshold com haptics (`vibrateLight`), e acionamento de estado de refresh apenas no `touchend`.
> **Onde**: `src/components/PullToRefresh.tsx`.

### P2-19. ✅ Cores genéricas Tailwind e hex fora de token

> Corrigido em 2026-08-25: auditados e substituídos todos os usos de cores fora de token (`text-white`, `text-neutral-*`, `accent-[#ffb300]`, hexadecimais em SVG) pelos tokens semânticos do Design System ("Súmula de Quinta"): `text-branco-time`, `text-preto-time`, `text-giz`, `text-giz-fraco`, `text-destaque-tinta`, `accent-destaque`, `var(--cor-campo)` e `var(--cor-campo-linha)`.
> **Onde**: `src/components/ErrorBoundary.tsx`, `src/components/CampoPartida.tsx`, `src/components/Avatar.tsx`, `src/components/PainelPlacar.tsx`, `src/components/Snackbar.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/DialogoEvento.tsx`, `src/components/EventosAutomaticosFinanceiro.tsx`, `src/routes/Administrador.tsx`, `src/routes/PartidaAoVivo.tsx`, `src/routes/PartidaEditar.tsx`, `src/routes/GestaoJogadores.tsx`, `src/routes/Layout.tsx`, `src/routes/Ranking.tsx`, `src/routes/Estatisticas.tsx`, `src/routes/NovoJogador.tsx`.

### P2-20. ✅ `TIMES[t].cor` divergente dos tokens — cor de time diferente entre telas

> Corrigido em 2026-08-25: alinhado `TIMES` em `src/lib/times.ts` aos valores hexadecimais canônicos do Design System (`#0d0d0e` para Preto e `#f4f1e8` para Branco) e adicionadas classes tokenizadas de fundo, texto e borda (`bgClasse`, `textClasse`, `borderClasse`), garantindo coerência visual absoluta entre prancheta tática (`CampoPartida.tsx`), crachás (`Avatar.tsx`), editores de time (`EscalacaoTimesEditor.tsx`) e modais.
> **Onde**: `src/lib/times.ts`.

### P2-21. ✅ `@utility text-destaque` sombreia o utilitário gerado por token

> Corrigido em 2026-08-25: realizado codemod integral substituindo `text-destaque` e `outline-destaque` por `text-destaque-texto` e `outline-destaque-texto` em todos os componentes, rotas e documentação (`design-system.md` e `AGENTS.md`) onde a semântica era de texto/foco em contraste WCAG AA sobre fundos claros/escuros. Removidas as declarações `@utility text-destaque` e `@utility outline-destaque` de `src/index.css`, eliminando a armadilha de sombreamento do utilitário Tailwind v4.
> **Onde**: `src/index.css`, `design-system.md`, `AGENTS.md`, `src/components/*`, `src/routes/*`.

### P2-22. ✅ Tema: flash claro no boot + `theme-color` ignora escolha manual

> Corrigido em 2026-08-25: adicionado script síncrono inline no `<head>` de `index.html` que inspeciona `localStorage.getItem('racha_tema')` e `matchMedia('(prefers-color-scheme: dark)')` aplicando a classe `.dark` no elemento raiz (`documentElement`) e sincronizando a meta tag `theme-color` (`#0f0e0c` escuro / `#f4f1e8` claro) antes do primeiro frame de renderização, eliminando qualquer flash claro indesejado. Atualizada a função `aplicarTema(tema)` em `src/lib/tema.ts` para sincronizar dinamicamente a meta tag `theme-color` durante a alternância manual do usuário.
> **Onde**: `index.html`, `src/lib/tema.ts`.

## Banco (P2)

### P2-23. ✅ Mestre carrega 2-3 versões históricas das mesmas funções

> Corrigido em 2026-08-25: `supabase/aplicar_tudo.sql` completamente limpo e consolidado no estado final canônico (1 única versão por assinatura de tabela, view, trigger e RPC), organizado estritamente na ordem correta de dependências (Extensões -> Tabelas e Constraints -> Funções Utilitárias -> Views -> RPCs -> Crons -> Grants -> Seeds), eliminando todas as 63 recriações e duplicatas históricas acumuladas.
> **Onde**: `supabase/aplicar_tudo.sql`.

### P2-24. ✅ Média aparada implementada em 2+ lugares no SQL

> Corrigido em 2026-08-25: criada a função pura canônica `IMMUTABLE PARALLEL SAFE media_aparada(sum, min, max, count)`. A fórmula que descarta 1 menor e 1 maior nota quando `count >= 3` foi centralizada e aplicada tanto na view `partida_notas` quanto na RPC `obter_medias_notas_jogadores`.
> **Onde**: `supabase/migrations/089_unificacao_media_aparada_e_levantamento.sql`, `supabase/aplicar_tudo.sql`.

### P2-25. ✅ Fórmula V/E/D + pontos replicada em 5-6 objetos SQL

> Corrigido em 2026-08-25: criada a view intermediária canônica `v_levantamento(partida_id, jogador_id, time, gols, assistencias, gols_contra, vencedor, resultado, pontos, vitoria, empate, derrota, data_jogo)`, unificando em um único ponto a contagem de partidas publicadas/encerradas com placar e o cálculo de resultados. As views `ranking` e `stats_jogador`, e as RPCs `parcerias_jogador`, `parcerias_destaque_jogador`, `pares_racha`, `confronto_direto` e `resumo_ano` foram refatoradas para agregar exclusivamente de `v_levantamento`.
> **Onde**: `supabase/migrations/089_unificacao_media_aparada_e_levantamento.sql`, `supabase/aplicar_tudo.sql`.

### P2-26. ✅ RPCs de leitura `LANGUAGE sql` sem `STABLE`

> Corrigido em 2026-08-25: auditadas e garantidas como `STABLE` todas as RPCs de leitura pura (`resumo_ano`, `parcerias_jogador`, `parcerias_destaque_jogador`, `pares_racha`, `obter_medias_notas_jogadores`, `obter_partidas_recentes_jogadores`, `confronto_direto` e `confronto_direto_partidas`). A declaração `STABLE` permite que o planejador de consultas do PostgreSQL realize inlining e evite re-execuções desnecessárias dentro do mesmo statement.
> **Onde**: `supabase/migrations/089_unificacao_media_aparada_e_levantamento.sql`, `supabase/migrations/090_otimizacao_placar_e_rpcs_notificacoes.sql`, `supabase/aplicar_tudo.sql`.

### P2-27. ✅ N+1 nas Edge Functions

> Corrigido em 2026-08-25: criadas as RPCs canônicas `listar_pendentes_votacao(interval)` e `listar_pendentes_confirmacao(bigint)` retornando candidatos elegíveis agregados com suas respectivas subscrições Web Push (`jsonb_agg`) em um único round-trip atômico ao banco de dados. Refatoradas as Edge Functions `send-voting-reminders` e `send-confirmation-requests` para consumir as RPCs diretamente, eliminando completamente o loop N+1 de consultas intermediárias em `partidas`, `partidas_participantes`, `jogadores`, `votes` e `push_subscriptions`.
> **Onde**: `supabase/migrations/090_otimizacao_placar_e_rpcs_notificacoes.sql`, `supabase/aplicar_tudo.sql`, `supabase/functions/send-voting-reminders/index.ts`, `supabase/functions/send-confirmation-requests/index.ts`.

### P2-28. ✅ View `partida_placar` recalculada em cascata por todas as telas

> Corrigido em 2026-08-25: refatorada a view `partida_placar` para realizar a agregação de gols próprios e gols contra em passo único (`agg` CTE), eliminando a dupla varredura de `partidas_participantes`. Criados índices de cobertura de alta performance: `idx_partidas_participantes_placar` em `(partida_id, time) INCLUDE (gols, gols_contra)` e `idx_partidas_data_jogo` em `partidas (data_jogo DESC)`.
> **Onde**: `supabase/migrations/090_otimizacao_placar_e_rpcs_notificacoes.sql`, `supabase/aplicar_tudo.sql`.

### P2-29. ✅ Comentário diz "capacidade 16" mas o código aplica 14

> Corrigido em 2026-08-27: extraída a função pura `capacidade_partida()` (retorna 14, `IMMUTABLE`, fonte única da capacidade: 14 jogadores de linha titulares + 2 goleiros = 16 participantes), usada nas contagens de vagas das RPCs `confirmar_presenca` e `adicionar_participante` (únicas funções canônicas com a checagem após a regeneração do mestre — as 6 ocorrências da auditoria eram definições duplicadas do mestre antigo). O comentário esclarecido "capacidade 14 de linha (+ 2 goleiros = 16 participantes)" acompanha a definição da função na migration 100 e no `aplicar_tudo.sql`; o header histórico da 057 permaneceu intacto por ser registro fiel da época (a capacidade era 16, reduzida para 14 pela migration 080). Refatoração de comportamento zero: mesmos números, mesma lógica.
> **Onde**: `supabase/migrations/100_funcao_capacidade_partida.sql`, `supabase/aplicar_tudo.sql`.

## Infra/Tooling (P2)

### P2-30. ✅ ESLint: react-hooks sem preset recommended; regras que poderiam ser `error`

> Corrigido em 2026-08-27: `eslint-plugin-react-hooks` (v7) agora registrado via preset flat (`reactHooks.configs.flat.recommended`) em vez de registro manual de 2 regras. `@typescript-eslint/no-explicit-any` e `no-unused-vars` promovidas a `error` (zero violações — base já estava limpa). Criado bloco de lint dedicado para `public/sw.js` com `globals.serviceworker` (regras base de JS, sem TS) e o script `lint` passou a cobri-lo (`eslint src public/sw.js`) — primeira vez que o service worker é lintado, o que revelou e corrigiu um inicializador inútil em `sw.js:47`. Decisão documentada no config: o `flat['recommended-latest']` do plugin v7 ativa 17 regras do React Compiler que produzem 22 erros arquiteturais no código atual (`set-state-in-effect` ×17, `purity` ×2, `static-components` ×1) — essas 3 regras ficam deliberadamente `off` com comentário explicativo; religá-las exige refatoração dedicada.
> **Onde**: `eslint.config.js`, `package.json` (scripts `lint`/`lint:fix`), `public/sw.js`.

### P2-31. ✅ Strict mode do TypeScript incompleto + `vercel.json` sem headers de cache do SW

> Corrigido em 2026-08-25: adicionadas as flags estritas `"noImplicitOverride": true`, `"noImplicitReturns": true` e `"noPropertyAccessFromIndexSignature": true` aos arquivos `tsconfig.app.json` e `tsconfig.node.json`. Corrigidos os erros apontados pelo compilador em `ErrorBoundary.tsx` (modificadores `override`), `Snackbar.tsx` (consistência de retorno em `useEffect`) e `pwa.ts` (acesso por index signature). Configurados em `vercel.json` os headers HTTP `Cache-Control: no-cache, no-store, must-revalidate` e `Service-Worker-Allowed: /` para `/sw.js`, `/index.html`, `/offline.html` e `/manifest.webmanifest`, além de `Cache-Control: public, max-age=31536000, immutable` para os assets versionados em `/assets/(.*)`.
> **Onde**: `tsconfig.app.json`, `tsconfig.node.json`, `vercel.json`, `src/components/ErrorBoundary.tsx`, `src/components/Snackbar.tsx`, `src/lib/pwa.ts`.

### P2-32. ✅ Registro do service worker dividido entre arquivos + comentário mentiroso

> Corrigido em 2026-08-25: criada função privada `registrarServiceWorker()` em `src/lib/pwa.ts`, com guard `if (!('serviceWorker' in navigator)) return`. A flag `let iniciado = false` foi adicionada ao escopo de módulo e verificada no início de `initPWA()`, garantindo que listeners e registro ocorram exatamente uma vez mesmo em reloads HMR. O bloco inline de registro removido de `main.tsx`. Comentário de `initPWA` atualizado para descrever corretamente o que a função faz.
> **Onde**: `src/lib/pwa.ts`, `src/main.tsx`.

### P2-33. ✅ Inputs fora do padrão anti-zoom/foco do design-system

> Corrigido em 2026-08-25: substituído `text-sm` por `text-base` e `focus:outline-none focus:border-destaque` por `focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2` em todos os inputs e selects fora do padrão do design system. Abrangência: 3 password inputs em `Perfil.tsx`, 1 input de username + 2 selects de posição em `NovoJogador.tsx`, 1 input de data em `PartidaNova.tsx`. Varredura final confirmou zero ocorrências de `focus:outline-none` remanescentes em `src/`.
> **Onde**: `src/routes/Perfil.tsx`, `src/routes/NovoJogador.tsx`, `src/routes/PartidaNova.tsx`.

### P2-34. ✅ Regras mensalista/admin/goleiro duplicadas entre telas

> Corrigido em 2026-08-25: extraídos predicados canônicos `isentoMensalidade(j)` e `podeSerAdmin(j)` para `src/lib/jogadores.ts`. `isentoMensalidade` encapsula a regra "goleiro é isento de mensalidade" e `podeSerAdmin` a regra "admin exige mensalista não-goleiro". Ambas as telas `NovoJogador.tsx` e `GestaoJogadores.tsx` substituíram as verificações inline `posicao === 'goleiro'` e `!is_mensalista` pelos predicados importados.
> **Onde**: `src/lib/jogadores.ts`, `src/routes/NovoJogador.tsx`, `src/routes/GestaoJogadores.tsx`.

### P2-35. ✅ Template de cobrança WhatsApp + detecção de migration embutidos na UI

> Corrigido em 2026-08-25: extraída função `montarLembreteWhatsApp(g, formatarReais, formatarDataLista)` para `src/lib/dividas.ts`, removendo a montagem inline da mensagem de `Administrador.tsx`. Extraído também o predicado `isMigrationAusenteNatureza(msg)` para `src/lib/dividas.ts`, encapsulando o regex de detecção de schema ausente (`/natureza|column|schema|PGRST/i`) e eliminando conhecimento de infra da UI. `Administrador.tsx` agora apenas chama as funções de lib.
> **Onde**: `src/lib/dividas.ts`, `src/routes/Administrador.tsx`.

---

# 🧹 P3 — Limpeza, Código Morto e Polimento

## Frontend

### P3-1. ✅ Código morto (uso verificado por grep)

> Corrigido em 2026-08-25: removido componente não utilizado `src/components/ListRow.tsx`; removidas funções e constantes mortas `publicarPartida`, `vagaOcupada` e `STATUS_COR` de `src/lib/partidas.ts`; tornado `isErroConexao` privado em `src/lib/erros.ts`; removidos tokens `primaria` e a utility `@utility transition-slow` de `src/index.css`.
> **Onde**: `src/components/ListRow.tsx`, `src/lib/partidas.ts`, `src/lib/erros.ts`, `src/index.css`.

### P3-2. ✅ Parâmetros mortos "por compatibilidade"

> Corrigido em 2026-08-25: removidos os parâmetros residuais `_closesAt` e `_agora` de `vagasOcupadas` e `podeConfirmar`, bem como `_participantesOriginais` e `_statusPartida` de `salvarEdicaoCompletaPartida` em `src/lib/partidas.ts`. Atualizados os call sites em `src/routes/Resumo.tsx`, `src/routes/PartidaDetalhe.tsx` e `src/routes/PartidaEditar.tsx` (removido também o estado órfão `participantesOriginais`).
> **Onde**: `src/lib/partidas.ts`, `src/routes/Resumo.tsx`, `src/routes/PartidaDetalhe.tsx`, `src/routes/PartidaEditar.tsx`.

### P3-3. ✅ Tipagem fina

> Corrigido em 2026-08-27: alinhado o tipo `Participante.posicao` com o schema real e removido o cast cego em `carregarParticipantes`; refatorado `ParticipanteEdicao` para `Omit<Participante, 'confirmado_em'>`; removidos os campos vestigiais `media_nota` e `partidas_ultimos_2_meses` de `JogadorLista` e derivado `JogadorLogado` em `SessaoContext.tsx` a partir de `JogadorLista`; removidas as asserções perigosas (`!`) em `Administrador.tsx` (com tratamento de erro `.catch` no `clipboard.writeText`), `Perfil.tsx` (guardas antecipadas de `jogador`), `GestaoJogadores.tsx` (fallback seguro em `jOriginal`), e validados os estados de navegação (`location.state`) com type guard seguro `isEstadoPartida` em `PartidaConfirma.tsx` e `PartidaNovaTimes.tsx`.
> **Onde**: `src/lib/partidas.ts`, `src/lib/jogadores.ts`, `src/context/SessaoContext.tsx`, `src/lib/escalacao.ts`, `src/routes/Administrador.tsx`, `src/routes/Perfil.tsx`, `src/routes/GestaoJogadores.tsx`, `src/routes/PartidaConfirma.tsx`, `src/routes/PartidaNovaTimes.tsx`.

### P3-4. ✅ setTimeout de navegação/feedback sem cleanup

> Corrigido em 2026-08-27: adicionado gerenciamento defensivo de timers via `useRef` e `clearTimeout` nos cleanups de desmontagem (`useEffect`) e antes de novos agendamentos em todas as rotas que realizam redirecionamento ou feedback temporizado (`PartidaEditar.tsx`, `PartidaNovaTimes.tsx`, `PartidaTimes.tsx`, `PartidaVotar.tsx`, `GestaoGoleiros.tsx`, `Login.tsx` e `NovoJogador.tsx`). Eliminados riscos de vazamento de memória e atualizações de estado após desmontagem. Adicionados type guards seguros para `location.state` (`isEstadoPartida`) em `PartidaNovaTimes.tsx` e `PartidaConfirma.tsx`, além da limpeza de asserções de tipo.
> **Onde**: `src/routes/PartidaEditar.tsx`, `src/routes/PartidaNovaTimes.tsx`, `src/routes/PartidaTimes.tsx`, `src/routes/PartidaVotar.tsx`, `src/routes/GestaoGoleiros.tsx`, `src/routes/Login.tsx`, `src/routes/PartidaConfirma.tsx`, `src/routes/NovoJogador.tsx`.

### P3-5. ✅ Estado espelho via useEffect

> Corrigido em 2026-08-25: removido o `useEffect` que "clampava" `minimoPartidas` para baixo sempre que `maximoPartidas` mudava (snap-back do slider ao recarregar dados); o clamp agora roda no `onChange` do range, limitando o valor a `maximoPartidas`. Mantido apenas o `useEffect` legítimo de reset de filtros/ordenação ao trocar a métrica.
> **Onde**: `src/routes/Ranking.tsx`.

### P3-6. ✅ Constantes grandes recriadas por render

> Corrigido em 2026-08-27: extraídas as constantes de módulo `VARIAVEIS_CONVITE`, `BUCKETS_VOTACAO` e `TEMPLATES_VOTACAO` no topo de `src/routes/Notificacoes.tsx`, eliminando a recriação de arrays e objetos literais estáticos a cada ciclo de render. Tipadas estritamente as chaves de campos (`titField`, `msgField`, `field`) com base em `NotificacoesConfig`, eliminando asserções e casts duplos inseguros no binding dos formulários.
> **Onde**: `src/routes/Notificacoes.tsx`.

### P3-7. ✅ `useEscalacaoTimes` não sincroniza com props + varredura O(n²)

> Corrigido em 2026-08-27: varredura O(n×m) do `.find` dentro do `.some` (checagem de goleiro por time) substituída por `jogadoresPorId`, um `Map<number, JogadorLista>` via `useMemo` com lookup O(1), usado também no `atribuirTime`. `NOTA_PADRAO = 6.0` agora é exportada de `escalacao.ts` e usada no feedback de equilíbrio do `autoEscalar` (antes `6.0` inline duplicado). Sobre a sincronização com props: o ajuste via adjust-state-during-render **não era exigido pelo fluxo** — nenhum caller passava `initialTimes` (opção morta); `PartidaTimes` hidrata os times salvos via `setTimes` no próprio `useEffect` de carga e `PartidaNovaTimes` começa limpo. A opção `initialTimes` foi removida (zero code slop), eliminando o hazard de estado stale em vez de mascará-lo com sync.
> **Onde**: `src/hooks/useEscalacaoTimes.ts`, `src/lib/escalacao.ts`.

### P3-8. ✅ Diversos pequenos

> Corrigido em 2026-08-28: implementados todos os 13 itens refinados em `docs/plano-p3-8-diversos-pequenos.md`:
> 1. `ModalNovoGoleiro.tsx` — reset defensivo de estado (`nome`, `telefone`, `chavePix`, `erro`) via `useEffect` no fechamento/abertura.
> 2. `useSwipeTabs.ts` — memoização dos handlers touch via `useMemo`.
> 3. `DuplaCard.tsx` — `ColunaOrdenacaoDuplas` centralizado em `src/lib/partidas.ts`, eliminando import de rota em componente.
> 4. `DialogoEvento.tsx` — ajuste geométrico de cantos para `rounded-t-[6px]` (teto do Design System).
> 5. `tema.ts` — `try/catch` defensivo em `localStorage` e sincronização do `<meta name="theme-color">`.
> 6. `exportacao.ts` — módulo dedicado criado para `escaparXml` e `baixarExcelLancamentos`, desacoplando I/O de `dividas.ts`.
> 7. `pwa.ts` & `SessaoContext.tsx` — erro propagado em `statusPush` e desconexão imediata se `is_ativo === false`.
> 8. Constantes centralizadas — `hojeStr`, `mesAtualStr`, `primeiroDiaMesStr` em `formatacao.ts`; `STORAGE_NOVA_PARTIDA` e `CAPACIDADE_PARTIDA` em `partidas.ts`.
> 9. `jogadores.ts` — helper puro `compararPorPresencaRecente` reutilizado em `PartidaDetalhe.tsx` e `PartidaNova.tsx`.
> 10. `PartidaNova.tsx` — conformidade estrita com hooks do React 19 no topo e fluxo desacoplado de `history.state`.
> 11. `sw.js` — tag com fallback garantido para notificações com `renotify: true`.
> 12. `index.html` — links canônicos de favicon SVG e PNG 192px no `<head>`.
> 13. `ErrorBoundary.tsx` — render enquadrado no Design System "Súmula de Quinta" (`bg-superficie`, `shadow-carimbo-preto`, badge `perigo`).
> **Onde**: `src/components/`, `src/hooks/`, `src/lib/`, `src/routes/`, `public/sw.js`, `index.html`.

## Banco e Infra (P3)

### P3-9. Documentação e higiene de repositório

- `GUIA/SETUP_FRONTEND_LOCAL.md:13,50` — links `file:///c:/Users/PC/...` (máquina de outra pessoa)
- `GUIA/SETUP_FRONTEND_LOCAL.md:64-67` — anon key hardcoded no doc → apontar para `.env.example`
- `GUIA/README.md:15` — cita `071_...sql` como último exemplo; o repo já tem 86 migrations
- `supabase/.temp/` (10 arquivos do CLI) e `Conta Racha CBO 2024 - Quinta.xlsx` (464 KB) commitados → `.gitignore` + `git rm --cached`
- `iniciar_local.bat` vs `iniciar_local.ps1` — mesmos checks duplicados com comportamentos **diferentes** (bat = build+preview; ps1 = sempre dev); `GUIA` os descreve como equivalentes → eleger um canônico

### P3-10. SQL: detalhes de consistência

- `015_pg_cron_fechar_votacao.sql:23-27` — único cron sem guard unschedule-if-exists (re-aplicar falha)
- FKs sem `ON DELETE` explícito em `votes` (mestre `:147-148`), `partida_eventos` (`047:27-28`), `notificacoes_config.updated_by` — documentar "jogador nunca é deletado" como invariante ou padronizar `RESTRICT`
- `022_seed_jogadores.sql:4` — `TRUNCATE ... CASCADE` destrutivo se rodado em banco com dados → `DELETE` idempotente
- `(HOUR + 3) % 24` hardcode do offset BRT (mestre `:3341, 4433`) — documentar invariante UTC-3 em um único lugar
- Índice parcial ausente: `CREATE INDEX idx_partidas_publicadas_closes ON partidas (voting_closes_at) WHERE status = 'published';` (serve o cron de fechamento e a Edge Function)
- Edge Functions `:195/:216/:41` — comparação de secret não timing-safe (comparar hashes SHA-256)

---

# ✅ Pontos verificados e CORRETOS (não reauditar)

Para evitar falso positivo em revisões futuras, estes itens foram verificados e **estão conformes**:

- **Rules of hooks**: nenhum hook após guard condicional em nenhuma rota.
- **`navigate(-1)` seco**: zero ocorrências; `voltar(navigate, fallback)` consistente.
- **`window.confirm`/`window.alert`**: zero ocorrências.
- **Imports `lazy()` fora de `src/lib/rotas.ts`**: nenhum; `Suspense` envolve só o `<Outlet />` no `Layout.tsx` com skeleton por rota.
- **`formatarMensagemErro` e `'[object Object]'`**: na versão `supabase-js 2.112.2`, `PostgrestError` estende `Error` — o `instanceof` funciona.
- **`fazer_login`** retorna apenas colunas seguras (não vaza `senha_hash` para o front).
- **`useCache`**: semântica SWR com geração/invalidação correta no cache de módulo (a ressalva de telas montadas está no P1-3).
- **Dependências npm**: todas usadas; nenhuma morta.
- **Crons UTC×BRT**: `'0 13 * * 1'` (seg 10h BRT) e `'0 13 1 * *'` (dia 1º 10h BRT) corretos.
- **Segredos nas Edge Functions**: só via `Deno.env.get`, nada hardcoded.
- **`formatacao.ts`**: `new Date(data)` sem bug de fuso no fluxo atual (timestamptz ISO + combinação de hora antes do parse).

---

# 🗓️ Roadmap de Execução Sugerido

| Onda                                         | Conteúdo                                                                                             | Rationale                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **1. Contenção (P0)**                        | Migration de `REVOKE` + gates (P0-1 a P0-4, P0-7) e os 3 bugs de produto (P0-8, P0-9, P0-13)         | Segurança explorável + features quebradas; mudanças pequenas e cirúrgicas  |
| **2. Estabilidade (P0-5/P0-6 + P1 estado)**  | Regenerar `aplicar_tudo.sql`; flags `ativo`; `invalidarCache`; `useCache` listeners; `SessaoContext` | Elimina todo estado obsoleto/race condition                                |
| **3. Fundação (P1-1 + P2-14/15)**            | Tipos gerados Supabase; chaves de cache centralizadas; constantes de capacidade                      | Destrava refatorações seguintes com segurança de compilador                |
| **4. Duplicação frontend (P2-1 a P2-11)**    | Pacote de componentes compartilhados + quebra dos gigantes (P1-4)                                    | Maior redução de LOC; cada componente novo já nasce conforme design-system |
| **5. Banco (P1-15 a P1-18 + P2-23 a P2-29)** | RPCs em lote, STABLE, materialized view, dedup de fórmulas SQL, N+1 Edge                             | Performance cresce com o histórico de partidas                             |
| **6. Polimento (P3)**                        | Código morto, tipagem fina, docs, higiene                                                            | Onda contínua, sem dependência                                             |

> **Checklist por item concluído** (AGENTS 11.2): `npm run lint` 0 erros → `npm run format` → `npm run build` → validação contra `design-system.md`. Alterações de banco: migration `XXX_...sql` sequencial, zero UUID, `SECURITY DEFINER SET search_path = public`, `GRANT EXECUTE`, e manter `aplicar_tudo.sql` sincronizado (de preferência gerado, não editado à mão).
