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

### P0-2. `resetar_senha` sem gate de admin — takeover de qualquer jogador

**Onde**: `supabase/migrations/065_rpc_resetar_senha.sql:16-31`
A função só recebe `p_jogador_id`; o comentário na linha 12 admite que o bloqueio de superadmin está "aplicado no front". Qualquer chamada anônima reseta a senha de **qualquer** jogador para `'123'` e depois loga via `fazer_login`.
**Refatoração**: adicionar `p_admin_id bigint` + gate `IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin) THEN RETURN false;` — padrão já adotado em `excluir_partida` (066) e `admin_definir_confirmacao`.

### P0-3. Gates de admin bypassáveis com `p_admin_id IS NULL`

**Onde**: `supabase/migrations/083_seguranca_goleiros_e_admin_gates.sql:88` e `:88`→`:165` (`salvar_times_e_goleiros_partida` e `abrir_partida`; idem `aplicar_tudo.sql:4561` e `:4632`)
O gate é `IF p_admin_id IS NOT NULL AND NOT EXISTS (...)` — chamando a RPC **sem** o argumento opcional, a condição inteira é falsa e nenhuma validação roda: anon monta escalação e abre partida. A própria `criar_goleiro_rapido` na mesma migration usa o padrão correto (`IS NULL OR NOT EXISTS`).
**Refatoração**: inverter para `IF p_admin_id IS NULL OR NOT EXISTS (...) THEN RAISE EXCEPTION ...`.

### P0-4. Overload antigo de `abrir_partida(bigint)` continua grantado

**Onde**: `aplicar_tudo.sql:4311-4365` (versão sem gate, com `GRANT EXECUTE ... TO anon` na linha 4365)
A 083 criou `abrir_partida(bigint, bigint)` com gate, mas não fez `DROP FUNCTION` da assinatura antiga — `CREATE OR REPLACE` com assinatura diferente não substitui o overload. O atacante chama a assinatura antiga e abre a partida sem validar admin.
**Refatoração**: `DROP FUNCTION abrir_partida(bigint);` na próxima migration de correção.

### P0-5. Bug de SQL no mestre: `aplicar_tudo.sql` falha ao aplicar

**Onde**: `supabase/aplicar_tudo.sql:3159` — `FROM todos` dentro do `pares_racha` recriado no bloco 076; a migration original correta usa `FROM agregado a` (`076_remover_coluna_nome_jogadores.sql:630`)
A função é `LANGUAGE sql`: o PostgreSQL valida o corpo no `CREATE`, então o script mestre **quebra com `missing FROM-clause entry for table "todos"`** antes de terminar. O mestre foi editado à mão e divergiu.
**Refatoração**: corrigir para `FROM agregado a` e passar a gerar o mestre por concatenação automática das migrations (ou `supabase db dump`), nunca edição manual.

### P0-6. `aplicar_tudo.sql` não é auto-suficiente (referencia objetos que não cria)

**Onde**: verificado por grep — `partida_eventos` usada em `aplicar_tudo.sql:1952, 4036, 4350, 4662` (tabela criada só na migration `047`); `sincronizar_contadores_partida` chamada em `:1675, 3970`; colunas `telefone`/`chave_pix` usadas em `:4518-4537` (criadas só na `082`); `resetar_senha` (065) e `excluir_partida` (066) ausentes do mestre embora o app as use; grants de schema da `016` também ausentes.
**Refatoração**: incluir os blocos 016/047/065/066/082 no mestre, ou extinguir o mestre e documentar `supabase db push` + `supabase db reset` como fluxo único.

### P0-7. Escrita direta em `dividas` e `push_subscriptions` para anon + senhas em texto puro

**Onde**: `036_create_push_notifications.sql:25` e `051_create_dividas.sql:26-27` (grants totais a anon); senhas: `021_plaintext_passwords.sql` + `022_seed_jogadores.sql` (todos os admins com `'123'`)
Sem RLS, anon pode `DELETE /rest/v1/push_subscriptions` (derrubar notificações de todos), quitar dívidas de quem quiser, criar dívidas para vítimas. As RPCs `quitar_divida`/`quitar_dividas_jogador` também não têm gate de admin. As senhas em texto puro são risco aceito historicamente, mas os caminhos de UPDATE do P0-1 os transformam em takeover completo (o `pgcrypto` da migration 002 está habilitado e não é usado).
**Refatoração**: revogar escrita (junto do P0-1) + gates `is_admin` nas RPCs de quitação; migrar senhas para `crypt(p_senha, senha_hash) = senha_hash` (bcrypt) com troca obrigatória no primeiro login.

## Frontend (Bugs reais)

### P0-8. ✅ Query com coluna inexistente (`match_id`) engole erro — votos anteriores nunca carregam

**Onde**: `src/routes/PartidaVotar.tsx:118`
A tabela `votes` tem a coluna `partida_id` (migration 006); `.eq('match_id', partidaId)` retorna erro PGRST204 **sempre**, mas a desestruturação `const { data: meusVotos }` sem checar `error` engole a falha — a tela sempre cai no rascunho do localStorage e a função "editar voto" está quebrada em produção.
**Refatoração**: corrigir para `partida_id` e mover a leitura para `lib/partidas.ts` (`carregarMeusVotos(partidaId, voterId)`) — `votes` já é consultado à mão em 4 lugares (`BannerLembrete.tsx:42`, `PartidaDetalhe.tsx:76`, `PartidaVotar.tsx:116`, fallback em `lib/jogadores.ts:180`).

### P0-9. ✅ `Math.random()` dentro do comparator de `sort` viola o contrato

**Onde**: `src/lib/escalacao.ts:91-93`
`(a, b) => b.nota - a.nota + (Math.random() * 0.2 - 0.1)` gera ruído **por comparação**: o mesmo par pode ser ordenado `a<b` e `b<a`, produzindo ordem não especificada. O `embaralhar()` das linhas 53-54 é trabalho morto (o `sort` total por nota na linha 64 descarta a ordem).
**Refatoração**: aplicar jitter fixo uma vez por jogador antes de ordenar (`notaEfetiva = nota + (rng() * 0.2 - 0.1)` como campo derivado) e remover o `embaralhar` antes de sorts totais.

### P0-10. ✅ `SessaoContext` sem flag de cleanup — race condition real

**Onde**: `src/context/SessaoContext.tsx:54-86`
`sincronizarJogador` é assíncrona dentro de `useEffect` sem `let ativo = true`. Se `jogador` mudar com o fetch em voo, duas syncs intercalam e a resposta mais antiga pode resolver por último, sobrescrevendo estado novo com dado obsoleto. Agravado pelos non-null assertions `jogador!.id` (linhas 64, 74-78).
**Refatoração**: flag `ativo` + capturar `const id = jogador.id` antes do await (elimina os `!`).

### P0-11. ✅ useEffects assíncronos sem flag `ativo` (viola AGENTS 5.2)

**Onde** (telas fora de `useCache`):

- `src/routes/Estatisticas.tsx:81-95` e `:97-146`
- `src/routes/EstatisticasRacha.tsx:82-97`
- `src/routes/PartidaNova.tsx:37-71`
- `src/routes/PartidaNovaTimes.tsx:32-38`
- `src/routes/Perfil.tsx:57-69`
- `src/routes/Login.tsx:27-32`
- `src/components/BannerLembrete.tsx:25-58` (polling com `setInterval` sem cleanup de estado + erro ignorado + fetch duplicado quando `pendentes.length` muda as deps)

**Refatoração**: aplicar o padrão canônico do AGENTS 5.2 (referência correta: `PartidaDetalhe.tsx:134-140`). No `BannerLembrete`, separar "fetch" de "agendamento" (deps `[jogadorId]` apenas, valor atual via ref) e pausar quando `document.hidden`.

### P0-12. ✅ Múltiplos round-trips sem transação em lote de jogadores

**Onde**: `src/routes/GestaoJogadores.tsx:243-253`
`salvarTodasAlteracoes` faz `for (...) await atualizarCaracteristicasJogador(...)` — falha no meio deixa metade dos jogadores alterada, mas a tela já cometeu `setJogadores(jogadoresDraft)` antes (`:256`). Viola a atomicidade do AGENTS 7.4.
**Refatoração**: RPC em lote `salvar_caracteristicas_jogadores(p_jsonb)`; só atualizar estado local após sucesso.

### P0-13. ✅ Snackbar de sucesso otimista antes da confirmação do servidor

**Onde**: `src/routes/Administrador.tsx:232-243` e `:264-271`
`handleQuitar`/`handleQuitarTodas` exibiam "Lançamento marcado como quitado" **antes** do `await quitarDivida(...)`; em falha o usuário recebia toast de sucesso seguido de erro.
**Refatoração**: mover o toast de sucesso para depois do `await` (o rollback otimista da UI pode permanecer).

### P0-14. ✅ Navegação por teclado quebrada nos dois listbox customizados

**Onde**: `src/components/SelectSumula.tsx:175` e `src/components/SeletorNota.tsx:164`
O handler de teclado estava preso ao `<ul tabIndex={-1}>`, mas o foco nunca saía do botão gatilho — ArrowUp/Down não faziam nada e Enter **fechava** o popup. Usuário de teclado abria mas não conseguia escolher.
**Refatoração**: unificar o handler de teclado no botão gatilho combobox, implementar `aria-activedescendant` referenciando IDs das opções e suporte a ArrowUp/Down/Home/End/Enter/Space/Escape/Tab.

---

# ⚠️ P1 — Alto Impacto (estado obsoleto, regras canônicas, arquitetura)

## Tipos e Frontend

### P1-1. Cliente Supabase sem tipos gerados — causa raiz dos casts

**Onde**: `src/lib/supabase.ts:12`
`createClient` sem o genérico `Database`: todo `select()` retorna `any` e cada módulo paga com casts duplos (`as unknown as ParticipanteJoinRow[]` em `partidas.ts:120`, `as unknown as Divida` em `dividas.ts:67-68/157-158`, `as NotificacoesConfig` em `notificacoes.ts:76`, `data as boolean` ~15x em `partidas.ts`, rows manuais em `jogadores.ts:269-306`). O bug do P0-8 seria pego em compile-time com tipos.
**Refatoração**: `supabase gen types typescript` → `createClient<Database>`; remover os `as`.

### P1-2. Mutações sem `invalidarCache` — dados obsoletos no mural/resumo

**Onde**: `src/routes/PartidaNovaTimes.tsx:111`, `src/routes/PartidaTimes.tsx:190`, `src/routes/PartidaAoVivo.tsx:199`, `src/routes/PartidaEditar.tsx:234` (o único `invalidarCache` do app está em `Jogos.tsx:122`)
Criar partida, salvar times/goleiros, finalizar partida e salvar edição afetam `jogos`/`resumo` sem invalidar (AGENTS 5.5, item 5).
**Refatoração**: chamar `invalidarCache('jogos')` (e `'resumo'`) após cada mutação bem-sucedida — idealmente via constantes centralizadas (ver P2-20).

### P1-3. `useCache`: invalidação não atualiza telas montadas

**Onde**: `src/hooks/useCache.ts:90-113` (efeito), `:19-23` (`invalidarCache`)
A proteção por geração existe no cache de módulo, mas (a) o `useEffect` grava resultado de geração antiga no **estado local** sem checar; (b) após invalidação, tela já montada nunca revalida (deps `[chave, buscar]` não mudam). O contrato do AGENTS 5.5 só vale para revisitas.
**Refatoração**: checar geração no consumer antes do `setEstado` + registry de listeners (ou `useSyncExternalStore`) para `invalidarCache` disparar refetch nos montados. Aproveitar: `recarregar` (:117-130) deve ignorar o dedupe de promise em voo (PullToRefresh solta o indicador com dado anterior ao gesto).

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

### P1-6. Regra de "partida draft atual" com dois critérios divergentes

**Onde**: `src/lib/notificacoes.ts:116-130` (`order by id desc`) vs `src/routes/Resumo.tsx:62-67` (`order by data_jogo asc`)
Com dois drafts no banco, as telas exibem partidas diferentes como "a próxima".
**Refatoração**: expor `obterPartidaDraftAtual` em `lib/partidas.ts` com critério único documentado.

### P1-7. Regra de "votação aberta" inconsistente entre telas

**Onde**: `src/routes/PartidaVotar.tsx:80-81` (`!p.voting_closes_at || ...` = nulo é aberto) vs `src/routes/PartidaDetalhe.tsx:176-179` (nulo é fechado)
**Refatoração**: extrair `votacaoAberta(partida)` em `lib/partidas.ts` (AGENTS 8.1).

### P1-8. Fallback de médias baixa a tabela `votes` inteira + duplica regra SQL

**Onde**: `src/lib/jogadores.ts:180-211`
O fallback client baixa `votes` completa (viola AGENTS 7.5), engole erros com `catch {}`/`return {}` (silencia falha de rede como "média inexistente") e reimplementa a média aparada que já existe na RPC 070 — duas cópias para sincronizar à mão para sempre.
**Refatoração**: garantir a RPC como única fonte; remover fallback ou propagar erro como as demais funções de lib.

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

### P1-11. Tratamento de erros com três estratégias convivendo

**Onde**: `lib/notificacoes.ts:43-44/88-90/98-100/110-112/125-127` (re-wrap com `new Error` que **descarta `code`/`details`**); `Login.tsx:75` (qualquer erro vira "a rede falhou", inclusive RPC inexistente); ~25 ocorrências de `error.message` cru nas telas (`PartidaDetalhe.tsx:105,128,164,703`; `Administrador.tsx:126,137,173,242,271,309,338`; `Notificacoes.tsx:113,150,167,183`; `GestaoJogadores.tsx:74,225,262`; `PartidaAoVivo.tsx:70,128,163,182,201`; `Perfil.tsx:101,133,176`; etc.)
**Refatoração**: padronizar "lib lança cru, borda usa `formatarMensagemErro`" (AGENTS matriz). No `erros.ts:27-38`, checar `error.code` estável (`23505`, `42501`, `PGRST301`) antes do matching por substring e cobrir `row-level security`.

### P1-12. Alvos de toque abaixo de 44px (viola AGENTS 6.1)

**Onde**:

- Abas de filtro `min-h-[36px]`: `GestaoJogadores.tsx:424,434,444,454`; pílulas `PartidaEditar.tsx:569`
- Filtros de posição `px-2.5 py-1`: `Ranking.tsx:255-279`
- Botões de ordenação do `thead`: `Ranking.tsx:445-454`, `EstatisticasRacha.tsx:285-295`
- Botões "voltar" texto-puro `text-xs`: `PartidaDetalhe.tsx:186-191`, `Administrador.tsx:373-379`, `Notificacoes.tsx:208-214`, `PartidaVotar.tsx:247-252`, `PartidaNova.tsx:155-160`, `NovoJogador.tsx:76-81`, `PartidaAoVivo.tsx:210-216` (só `GestaoGoleiros.tsx:186-193` está correto)
- Botões de hora/minuto `min-h-[36px]`: `ModalSelecionarAgendamento.tsx:189,218`; `ModalSelecionarGoleiro.tsx:133,218-225`; `EscalacaoTimesEditor.tsx:174` (`min-h-[32px]`); `CampoPartida.tsx:41` (chips 36px — alvo primário de gol no ao-vivo); `DialogoEvento.tsx:174,188-227`

**Refatoração**: elevar para `min-h-[44px]`; o componente `BotaoVoltar` (P2-1) resolve os 11 voltar de uma vez.

### P1-13. Modais sem focus trap / foco inicial (padrão existe só no ConfirmDialog)

**Onde**: `ModalSelecionarAgendamento.tsx:42-63`, `ModalSelecionarGoleiro.tsx:35-54`, `ModalSelecionarOpcao.tsx:37-55`, `ModalNovoGoleiro.tsx` (sem portal, sem lock, sem backdrop-click), `DialogoEvento.tsx:60`, e o modal inline `PartidaEditar.tsx:509-631`
Tab atravessa para o conteúdo atrás do overlay; `ConfirmDialog.tsx:60-79` tem o trap completo para copiar.
**Refatoração**: extrair `useModalA11y(open, onClose)` (Escape + scroll lock + foco inicial + trap) e `<ModalBase>` — resolve também a duplicação P2-11.

### P1-14. `Push`/`Sessao`: estado desativado silencia falhas e jogador inativo mantém sessão

**Onde**: `src/lib/pwa.ts:140-153` (`statusPush` converte **qualquer** erro em `'desativado'`, induzindo "reativar" desnecessário); `src/context/SessaoContext.tsx:66` (`!data || !data.is_ativo` faz `return` silencioso — sem logout/limpeza, admin inativado continua navegando com dado stale)
**Refatoração**: propagar erro no `statusPush`; no contexto, `setJogador(null)` + limpar `localStorage` quando `is_ativo = false`.

## Banco (P1)

### P1-15. `chave_pix`/`telefone` legíveis por anon (PIX costuma conter CPF)

**Onde**: `084_grant_select_pix_telefone_jogadores.sql:1-10`
**Refatoração**: revogar e expor via RPC `obter_dados_contato_jogador(p_jogador_id, p_solicitante_id)` com gate (próprio ou admin), como já faz `atualizar_dados_pix_telefone`.

### P1-16. `confirmar_presenca` permite agir como qualquer jogador

**Onde**: `057_confirmacoes_presenca.sql` (`aplicar_tudo.sql:1764-1826`) — `p_jogador_id` vem do client sem qualquer gate.
**Refatoração**: enquanto não houver sessão server-side, unificar com `admin_definir_confirmacao` no client e revogar o grant da versão sem gate.

### P1-17. Loops PL/pgSQL com INSERT por elemento

**Onde**: `registrar_votos` (`aplicar_tudo.sql:562-571`), `criar_partida` (`:1993-2007`), `salvar_edicao_partida` (`:4085-4108`), `salvar_times_e_goleiros_partida` (`:4569-4575`)
`FOR elem IN jsonb_array_elements LOOP INSERT` executa N statements com EXCEPTION/ROLLBACK manual.
**Refatoração**: `INSERT INTO ... SELECT ... FROM jsonb_array_elements(p_participantes) ON CONFLICT ...` — 1 comando atômico.

### P1-18. Cron jobs disparam Edge Functions sem verificar resposta — falha silenciosa acumulável

**Onde**: `077` (`aplicar_tudo.sql:3481-3515`) e `agendar-partida-semanal` (`:2119-2126`) — `net.http_post` 2x/min sem `net.http_collect_response` e sem gravar status. Se o secret girar ou a função entrar em loop de 401/500, nenhum push sai e nada registra.
**Refatoração**: `net.http_collect_response` com timeout + tabela `cron_execucoes (job, status, body, created_at)` alertando entradas repetidas com erro.

---

# 🔄 P2 — Eliminação de Duplicação, Tokens e Performance

## Pacote de componentes compartilhados (frontend)

### P2-1. `BotaoVoltar` — markup replicado 11x com divergência

`PartidaDetalhe.tsx:186-191`, `Administrador.tsx:373-379`, `Notificacoes.tsx:208-214`, `PartidaVotar.tsx:247-252`, `PartidaNova.tsx:155-160`, `NovoJogador.tsx:76-81`, `PartidaAoVivo.tsx:210-216` etc. → `components/BotaoVoltar.tsx` (fallback via prop, `voltar()` interno, `min-h-[44px]`).

### P2-2. `BarraAcaoInferior` — barra fixa inferior duplicada 6x

`PartidaEditar.tsx:484-506`, `PartidaNova.tsx:275-297`, `PartidaAoVivo.tsx:346-362/364-382` (as duas últimas quase idênticas entre si), `PartidaVotar.tsx:342-361`, `PartidaConfirma.tsx:90-111` → children + legenda opcional, com o `paddingBottom: calc(... + env(safe-area-inset-bottom))` interno.

### P2-3. `AbasEstatisticas` — barra de abas triplicada

`Estatisticas.tsx:193-230`, `EstatisticasRacha.tsx:146-183`, `Comparador.tsx:260-270` (mesmos 3 `NavLink` com ~30 linhas de classes; `Comparador` já tem `classeAba` em `:53-58`).

### P2-4. `StatBox` + fetcher de `stats_jogador` triplicados

Componente idêntico em `Perfil.tsx:393-404` e `Estatisticas.tsx:410-421`; interface `Stats` + query em `Perfil.tsx:18-25/60-64`, `Estatisticas.tsx:15-22/104-109`, `Comparador.tsx:26-33/141-147` → `components/StatBox.tsx` + `lib/jogadores.ts → carregarStatsJogador(ids)`.

### P2-5. `useSnackbar` — estado+helper de snackbar duplicado 5x

`Administrador.tsx:74-88`, `Notificacoes.tsx:80-90`, `GestaoJogadores.tsx:60-64`, `GestaoGoleiros.tsx:56-59`, `Jogos.tsx:62-70` → hook com haptics padronizados (hoje só `Notificacoes` vibra).

### P2-6. `CampoBusca` — campo de busca com botão limpar duplicado 4x

`GestaoJogadores.tsx:400-418`, `GestaoGoleiros.tsx:227-246`, `PartidaNova.tsx:221-238`, `PartidaEditar.tsx:532-552`.

### P2-7. `Toggle` — switch triplicado no mesmo arquivo

`Notificacoes.tsx:243-255, 366-378, 452-462` → `components/Toggle.tsx` (checked/onChange/label).

### P2-8. `CabecalhoTime` + `BadgeTime` — cabeçalho/badge de time com hex inline triplicado

`PartidaDetalhe.tsx:349-356`, `PartidaVotar.tsx:300-308`, `PartidaEditar.tsx:323-343` (cabeçalho com `TIMES[t].cor` + regra de contraste repetida); `ModalSelecionarGoleiro.tsx:94-98` e `EscalacaoTimesEditor.tsx:150-154/258/272` (badge com `style` hex). Tokens `bg-preto-time`/`bg-branco-time` já existem.

### P2-9. `PainelPlacar` — painel LED triplicado com hex hardcodado

`PartidaDetalhe.tsx:216-262`, `Jogos.tsx:210-249`, `PartidaEditar.tsx:264-298` — três implementações com `bg-[#000000]`, `bg-[#0d0d0e]`, `border-[#35302a]`, `text-[#f4f1e8]` (viola AGENTS 4.2). Extrair componente e promover os hex a tokens (`--cor-led-fundo`) em `index.css`.

### P2-10. Motor de listbox duplicado (~200 linhas): `SelectSumula` vs `SeletorNota`

`SelectSumula.tsx:29-213` e `SeletorNota.tsx:26-202` — mesmo combobox+listbox (estado, `opcaoRefs`, `scrollIntoView`, clique fora, teclado — inclusive o mesmo bug P0-14 duplicado). `SeletorNota` é um `SelectSumula` com opções 1-10 e `font-mono`.
**Refatoração**: hook `useListbox({ opcoes, value, onChange, disabled })`; os dois viram cascas de render.

### P2-11. Casca de modal duplicada em 4 arquivos

`ModalSelecionarAgendamento.tsx:42-63`, `ModalSelecionarGoleiro.tsx:35-54`, `ModalSelecionarOpcao.tsx:37-55`, `ModalNovoGoleiro.tsx:18-27` — mesmo `useEffect` Escape+lock, backdrop, cabeçalho e rodapé. Qualquer correção precisa ser replicada 4x.
**Refatoração**: `useModalA11y` + `<ModalBase>` (junto com P1-13).

## Queries e estado (frontend)

### P2-12. Select de colunas de `jogadores` copiado 4x + pós-processamento superadmin triplicado

`lib/jogadores.ts:58-60, 74-76, 430-432` + `SessaoContext.tsx:59-64` (string literal de 9 colunas); `{ ...j, is_admin: j.is_admin || isSuperAdmin(j.username) }` em `jogadores.ts:65-68, 82-85, 438-441` + `SessaoContext.tsx:70-72`.
**Refatoração**: `COLUNAS_JOGADOR_LISTA` + `aplicarSuperAdmin(j)`; as listagens nascem de um builder comum (documentar a intenção de `listarJogadoresAtivos` incluir randoms — hoje implícita, ver `jogadores.ts:55-69` vs `:71-86`).

### P2-13. Queries de `dividas` duplicadas

`lib/dividas.ts:56-74` e `:143-164` — mesmo select de 12 colunas + join + mapeamento `natureza ?? 'receita'` + cast duplo.
**Refatoração**: `SELECT_DIVIDA` + `mapearLinhaDivida(row)`; idealmente migrar a coluna para `NOT NULL DEFAULT 'receita'` e remover a normalização espalhada (`:115`).

### P2-14. Chaves de cache como strings mágicas + `'resumo'` sem ano

`Jogos.tsx:108/122`, `Resumo.tsx:85` (não inclui o `ano` do `buscar` — na virada do ano numa sessão aberta serve dado do ano anterior), `Ranking.tsx:117-119`, `Comparador.tsx:163-165` inline.
**Refatoração**: `lib/chavesCache.ts` com constantes/factories (`chaveRanking(filtro)`) usadas no `useCache` e no `invalidarCache`.

### P2-15. `LIMITE_POR_TIME` vive num componente (inversão de camadas)

`components/EscalacaoTimesEditor.tsx:8` (importado por `hooks/useEscalacaoTimes.ts:2` e `routes/PartidaTimes.tsx:23`) vs `CAPACIDADE_PARTIDA = 14` em `lib/partidas.ts:271`. O acoplamento 14 = 7×2 é implícito.
**Refatoração**: mover para `lib/times.ts` e derivar `CAPACIDADE_PARTIDA = LIMITE_POR_TIME * 2`.

### P2-16. Regra do placar (gol contra soma para o adversário) reimplementada no cliente

`PartidaEditar.tsx:105-118` duplica a fórmula da view `partida_placar` e de `placarDeEventos` (`lib/partidas.ts`, usada por `PartidaAoVivo.tsx:88`).
**Refatoração**: `calcularPlacarDeParticipantes(participantes)` em `lib/partidas.ts` — única implementação testável.

### P2-17. Ordenações/filtros recomputados a cada render (sem `useMemo`)

`Ranking.tsx:167-178` (sort da tabela inteira) e `:124`; `EstatisticasRacha.tsx:115-127`; `Estatisticas.tsx:154-170`; `GestaoJogadores.tsx:100-111`; `PartidaDetalhe.tsx:638-644/725-735`; `DialogoEvento.tsx:76-77` (filtros a cada toque no ao-vivo).
**Refatoração**: envolver em `useMemo` com dependências explícitas.

### P2-18. `PullToRefresh` dispara `setState` a cada touchmove

`components/PullToRefresh.tsx:50` — re-render da rota inteira ~60x/s durante o gesto; `getScrollTop` caminha a árvore a cada move.
**Refatoração**: acumular distância em `ref` + aplicar `style.transform` direto (ou rAF); cachear `getScrollTop` no touchstart; só setar estado ao cruzar o threshold.

### P2-19. Cores genéricas Tailwind e hex fora de token

`text-neutral-600` em `PartidaDetalhe.tsx:253`; `text-white` em `Administrador.tsx:536,719`, `PartidaAoVivo.tsx:332`, `PartidaEditar.tsx:729`, `GestaoJogadores.tsx:571`, `CampoPartida.tsx:235-240`, `DialogoEvento.tsx:163`, `ErrorBoundary.tsx:29-39`; `accent-[#ffb300]` em `Ranking.tsx:294`, `Estatisticas.tsx:283`, `NovoJogador.tsx:204,234` (#ffb300 é exatamente o `destaque`); paleta hex de `CampoPartida.tsx:21-22/36-37/128-159` (tokens existem no `index.css`).
**Refatoração**: substituir por tokens (`text-giz`, `text-destaque-tinta`, `accent-destaque`, `bg-preto-time`...).

### P2-20. `TIMES[t].cor` divergente dos tokens — cor de time diferente entre telas

`lib/times.ts:8-9` define `#111827`/`#f9fafb` (cinzas Tailwind), mas os tokens canônicos são `#0d0d0e`/`#f4f1e8` — o chip de time em `CampoPartida.tsx:40` fica com cor **diferente** do badge em `EscalacaoTimesEditor.tsx:151`/`ModalSelecionarGoleiro.tsx:95`.
**Refatoração**: alinhar `TIMES` aos valores canônicos (ou expor classes tokenizadas em vez de hex).

### P2-21. `@utility text-destaque` sombreia o utilitário gerado por token

`index.css:172-178` redefine `text-destaque` para `var(--cor-destaque-texto)` (#92400e), enquanto `--color-destaque` (#ffb300) geraria `text-destaque` claro. Se alguém apagar a `@utility`, **234 usos** mudam de cor sem erro de build. O nome coerente `text-destaque-texto` tem 0 usos.
**Refatoração**: codemod `text-destaque` → `text-destaque-texto` (onde a semântica for texto escuro sobre claro) e deletar as `@utility` de sobreposição — eliminar a armadilha.

### P2-22. Tema: flash claro no boot + `theme-color` ignora escolha manual

`lib/tema.ts:21-29` (classe `.dark` só no `useEffect`), `index.html:7-8` (`prefers-color-scheme`), `public/manifest.webmanifest:10-11` (fixo dark).
**Refatoração**: script inline no `<head>` lendo `localStorage.racha_tema` antes do primeiro paint; atualizar `meta[name=theme-color]` no `useTema`.

## Banco (P2)

### P2-23. Mestre carrega 2-3 versões históricas das mesmas funções

`aplicar_tudo.sql`: `confirmar_presenca` 3x (`:1764, 4199, 4748`), `adicionar_participante` 3x, `abrir_partida` 3x, `salvar_configuracoes_notificacoes` 2x (90 linhas idênticas duplicadas), `criar_partida` 2x, `finalizar_partida`/`publicar_partida` 2x — 63 `SECURITY DEFINER` para 59 `SET search_path` por causa das recriações.
**Refatoração**: mestre com só o estado final (1 versão por assinatura), na ordem de dependência.

### P2-24. Média aparada implementada em 2+ lugares no SQL

View `partida_notas` (`067:19`/`076:15`, mestre `:224/2541`) e RPC `070` (mestre `:2183`) — fórmula `(SUM-MIN-MAX)/(COUNT-2) WHEN COUNT>=3` duplicada textualmente.
**Refatoração**: função `IMMUTABLE media_aparada(sum, min, max, count)` usada pelos dois (ou a RPC derivar da view).

### P2-25. Fórmula V/E/D + pontos replicada em 5-6 objetos SQL

Views `ranking`, `stats_jogador`, `parcerias_jogador`, `pares_racha`, `confronto_direto`, `resumo_ano` repetem o trio `COUNT(*) FILTER (vencedor/time/empate)`.
**Refatoração**: view `v_levantamento(partida_id, jogador_id, time, resultado)` e as demais apenas agregam dela — um só ponto para mudar a regra de pontuação.

### P2-26. RPCs de leitura `LANGUAGE sql` sem `STABLE`

`resumo_ano` (mestre `:2735`), `parcerias_jogador` (`:2924`), `pares_racha` (`:3105`), `parcerias_destaque_jogador` (`:3015`) — VOLATILE à toa; `confronto_direto` e `obter_medias_notas_jogadores` já mostram o padrão correto.
**Refatoração**: adicionar `STABLE` nas leituras puras (permite inline pelo planner).

### P2-27. N+1 nas Edge Functions

`send-voting-reminders/index.ts:73-131` (4 queries por partida + 2 por jogador); `send-confirmation-requests/index.ts:113-150` idem.
**Refatoração**: RPC `STABLE SECURITY DEFINER listar_pendentes_votacao()` devolvendo candidatos+endpoints num único round-trip; o loop Deno fica só no envio Web Push.

### P2-28. View `partida_placar` recalculada em cascata por todas as telas

`partida_placar` (mestre `:168-198`) agrega **todas** as partidas sem filtro; `ranking`, `stats_jogador`, `partidas_com_placar`, `parcerias_*`, `confronto_direto`, `resumo_ano` fazem join com ela. Cresce linearmente com o histórico.
**Refatoração**: `MATERIALIZED VIEW` + `REFRESH` no job de 1 min existente, ou índice `partidas_participantes (partida_id, time) INCLUDE (gols, gols_contra)` + filtro por ano no mural.

### P2-29. Comentário diz "capacidade 16" mas o código aplica 14

`aplicar_tudo.sql:1726-1731` (comentário do bloco 057) vs `v_ocupadas >= 14` (`:1813, 1890, 4246, 4297, 4788, 4837`). A regra 14/7+1 está hardcoded em 8 funções.
**Refatoração**: corrigir o comentário e extrair função `capacidade_partida()` (ou constante única) usada pelas contagens.

## Infra/Tooling (P2)

### P2-30. Scripts npm sem `typecheck`/`test` e sem CI

`package.json:6-14` — `lint` acopla `tsc -b` ao ESLint (loop lento); zero arquivos de teste em `src`; sem `.github/`.
**Refatoração**: `"typecheck": "tsc -b"`, `"lint": "eslint src"`, `"test": "vitest"` (smoke tests das libs puras: `escalacao.ts`, `times.ts`, `formatacao.ts`) + workflow mínimo de CI.

### P2-31. ESLint: react-hooks sem preset recommended; regras que poderiam ser `error`

`eslint.config.js:15-29` — plugin registrado manualmente com 2 regras; `no-explicit-any`/`no-unused-vars` em `warn` (grep: zero `any` explícito em `src` — subir para `error` não quebra nada hoje); `public/sw.js` nunca lintado.
**Refatoração**: `reactHooks.configs['recommended-latest']`, promover as duas regras, bloco de lint para `sw.js` com `globals.serviceworker`.

### P2-32. Strict mode do TypeScript incompleto + `vercel.json` sem headers de cache do SW

`tsconfig.app.json:16-21` (faltam `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes` gradual); `vercel.json:1-3` (sem `Cache-Control: no-cache` para `/sw.js` — causa clássica de "PWA preso na versão antiga", que o `GUIA/SETUP_FRONTEND_LOCAL.md:109-110` tenta contornar com Ctrl+Shift+R).
**Refatoração**: adicionar as flags + headers para `sw.js`/`index.html`/`offline.html`.

### P2-33. Registro do service worker dividido entre arquivos + comentário mentiroso

`main.tsx:19-29` vs `lib/pwa.ts:49-61` — comentário afirma que `initPWA` "registra o service worker", mas o registro está inline no `main.tsx`; `initPWA` acumula listeners em HMR sem guard.
**Refatoração**: mover `registrarServiceWorker()` para `pwa.ts`, flag `let iniciado = false`.

### P2-34. Inputs fora do padrão anti-zoom/foco do design-system

`Perfil.tsx:340,349,358` (senhas `text-sm` + `focus:outline-none`), `NovoJogador.tsx:122,141-151,165-169` (`text-sm`, sem altura mínima), `Estatisticas.tsx:244`.
**Refatoração**: `text-base` + `focus-visible:outline-destaque` (design-system 4.2, item 5).

### P2-35. Regras mensalista/admin/goleiro duplicadas entre telas

`NovoJogador.tsx:146-149,199-203,229-233` vs `GestaoJogadores.tsx:113-201` — "goleiro é isento", "admin exige mensalista", "superadmin imutável" implementadas duas vezes.
**Refatoração**: predicados em `lib/jogadores.ts` (`poderaSerAdmin(j)`, `isentoMensalidade(j)`).

### P2-36. Template de cobrança WhatsApp + detecção de migration embutidos na UI

`Administrador.tsx:344-365` (montagem da mensagem) e `:139-141` (regex de migration ausente).
**Refatoração**: `lib/dividas.ts → montarLembreteWhatsApp(g)`; a detecção de migration é conhecimento de infra que vazou para a UI.

---

# 🧹 P3 — Limpeza, Código Morto e Polimento

## Frontend

### P3-1. Código morto (uso verificado por grep)

- `src/components/ListRow.tsx` — nenhum import no app inteiro (viola "Zero Code Slop")
- `lib/partidas.ts:261` `publicarPartida` — "caminho legado" sem referências
- `lib/partidas.ts:275` `vagaOcupada` — zero usos
- `lib/partidas.ts:21-26` `STATUS_COR` — zero usos (ou passe a usá-lo nos badges)
- `lib/erros.ts:6` `isErroConexao` exportado — só consumo interno
- `index.css:29,49,69` tokens `primaria` — 0 usos e alias quebrado
- `index.css:222-224` `@utility transition-slow` — 0 usos

**Refatoração**: deletar (ou adotar de fato).

### P3-2. Parâmetros mortos "por compatibilidade"

`partidas.ts:277-279, 285-287, 297-299` (`_closesAt`, `_agora`) e `:389-390` (`_participantesOriginais`, `_statusPartida`) — callers ainda passam os args (`PartidaDetalhe.tsx:635, 759`).
**Refatoração**: remover parâmetros e atualizar os call sites.

### P3-3. Tipagem fina

- `partidas.ts:44-56` vs `:96-109` — `Participante.posicao` não-nulo vs row anulável; `as Participante[]` silencia NULL do banco
- `partidas.ts:373-383` — `ParticipanteEdicao` é cópia quase literal → `Omit<Participante, 'confirmado_em'>`
- `SessaoContext.tsx:14-24` vs `lib/jogadores.ts:24-35` — `JogadorLogado` duplicado → `Omit<JogadorLista, ...>`
- `jogadores.ts:34-35` — `media_nota`/`partidas_ultimos_2_meses` nunca populados pelas queries (campos vestigiais)
- Asserções perigosas: `Administrador.tsx:791` (`d.jogadores!.chave_pix!` + `clipboard.writeText` sem `.catch`), `Perfil.tsx:86,94,95,157` (`jogador!` em closures), `GestaoJogadores.tsx:475`, `PartidaEditar.tsx:224`, `Notificacoes.tsx:596,616` (dupla asserção), `PartidaVotar.tsx:147`, `PartidaConfirma.tsx:20`/`PartidaNovaTimes.tsx:26` (`location.state as` sem validação honesta — tipar `unknown`)

### P3-4. setTimeout de navegação/feedback sem cleanup

`PartidaEditar.tsx:233-235`, `PartidaNovaTimes.tsx:111`, `PartidaTimes.tsx:190`, `PartidaVotar.tsx:236`, `GestaoGoleiros.tsx:170`, `Login.tsx:41-43` — `navigate`/`setState` disparam mesmo após unmount.
**Refatoração**: guardar o id do timer e limpar no cleanup.

### P3-5. Estado espelho via useEffect

`Ranking.tsx:126-128` — efeito que "clampa" `minimoPartidas`; derivar no render ou resetar no `onChange`.
**Refatoração**: remover o efeito.

### P3-6. Constantes grandes recriadas por render

`Notificacoes.tsx:473-497, 530-565` — arrays de buckets e templates inline no JSX → constantes de módulo (como `DIAS_DISPARO` já é).

### P3-7. `useEscalacaoTimes` não sincroniza com props + varredura O(n²)

`hooks/useEscalacaoTimes.ts:21` (`useState(initialTimes)` sem sync) e `:44-49` (`.find` dentro de `.some`).
**Refatoração**: `Map<number, JogadorLista>` via `useMemo`; sincronizar via adjust-state-during-render se o fluxo exigir. Exportar `NOTA_PADRAO` de `escalacao.ts:14` (hoje `6.0` inline em `:91,94` duplica a constante).

### P3-8. Diversos pequenos

- `ModalNovoGoleiro.tsx` — sem `createPortal`, sem lock de scroll, estado não resetado entre aberturas
- `useSwipeTabs.ts:161-170` — objeto `handlers` recriado por render → `useMemo`
- `DuplaCard.tsx:2` — importa tipo de `../routes/EstatisticasRacha` (inversão de camadas) → mover para `lib/partidas.ts`
- `DialogoEvento.tsx:92` — `rounded-t-[8px]` acima do máximo canônico `[6px]`
- `tema.ts:28` — `localStorage.setItem` sem try/catch (quebra em Safari privado)
- `dividas.ts:166-261` — `baixarExcelLancamentos` mistura camada de dados com DOM/XML → mover para `lib/exportacao.ts`
- `pwa.ts:140-153` — ver P1-14
- `Administrador.tsx:40-53` (`hojeStr`/`mesAtualStr`/`primeiroDiaMesStr`), `PartidaNovaTimes.tsx:19` + `PartidaNova.tsx:16` (`STORAGE_KEY` duplicada), `PartidaNova.tsx:13-14` (`LIMITE_LINHA=14` local vs `CAPACIDADE_PARTIDA`) → mover para `lib/formatacao.ts`/`lib/partidas.ts` (fonte única da regra de capacidade)
- Ordenação de candidatos por partidas recentes duplicada: `PartidaDetalhe.tsx:726-735` vs `PartidaNova.tsx:98-112` → helper em `lib/jogadores.ts`
- Elenco completo via `history.state` entre 3 telas (`PartidaNova.tsx:283`, `PartidaConfirma.tsx:97-104`, `PartidaNovaTimes.tsx`) — morre no refresh → persistir selecionados no rascunho/localStorage e passar só ids
- `sw.js:60-62` — `renotify: true` sem `tag` garantida (ignorado silenciosamente quando `payload.tag`/`id` indefinidos)
- Favicon ausente — sem `<link rel="icon">` nem `favicon.ico` em `public/` (404 + SW tenta cacheá-lo)
- `ErrorBoundary.tsx:29-39` — único componente com paleta `neutral-*`/`rounded-lg`/`shadow` fora do design system → reescrever com tokens

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
