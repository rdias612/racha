# Racha — Tasks de Implementação

Tasks derivadas do `PLANO.md`. Divididas pelas 8 etapas do plano. Marque `- [x]` ao concluir cada uma.

> **Convenção de migrations:** arquivos numerados em `supabase/migrations/`, nome no formato `NNN_nome.sql` (ex.: `001_create_jogadores.sql`). A ordem numérica importa.

---

## Etapa 0 — Scaffold

- [ ] **0.1** Inicializar projeto Vite com template `react-ts`: `npm create vite@latest . -- --template react-ts` (na raiz do repo)
- [ ] **0.2** Instalar dependências base: `npm install @supabase/supabase-js react-router-dom`
- [ ] **0.3** Instalar e configurar Tailwind CSS **v4** (CSS-first, **sem** `tailwind.config.js`): diretiva `@import "tailwindcss";` + `@custom-variant dark (&:where(.dark, .dark *));` no `index.css` (toggle de tema aplica classe `dark` no `<html>`)
- [ ] **0.4** Criar arquivo `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` + `.env.example` (sem valores reais) + adicionar `.env` ao `.gitignore`
- [ ] **0.5** Criar `src/lib/supabase.ts` inicializando o cliente Supabase a partir das env vars
- [ ] **0.6** Criar `src/lib/times.ts` exportando a constante `TIMES` (a = Preto, b = Branco)
- [ ] **0.7** Tokenizar cor de destaque: definir `--cor-destaque: #2563eb` no `index.css` (variável CSS) e usar em classes utilitárias (`bg-[var(--cor-destaque)]`, etc.)
- [ ] **0.8** Criar estrutura de pastas `src/routes/` (vazia, telas entram nas próximas etapas)
- [ ] **0.9** Configurar `index.html` com `<title>racha-gragoata-cbo</title>` e meta viewport mobile-first
- [ ] **0.10** Deploy inicial na Vercel (conectar repo, setar env vars em produção)
- [ ] **0.11** Validar: `npm run dev` sobe o site sem erros e tema dark/light toggle já funciona (placeholder)

---

## Etapa 1 — Login & Sessão

- [ ] **1.1** Migration `001_create_jogadores.sql`: tabela `jogadores` (id bigint PK sequence, username text unique, senha_hash text, nome text, posicao check gk/def/mid/fwd, is_admin bool default false, is_ativo bool default true, created_at timestamptz default now())
- [ ] **1.2** Migration `002_enable_pgcrypto.sql`: `create extension if not exists pgcrypto;`
- [ ] **1.3** Migration `003_rpc_fazer_login.sql`: função `fazer_login(p_username text, p_senha text)` que valida `senha_hash` via `crypt()` e retorna a linha sem `senha_hash`, ou NULL. **Decisão de risco aceita:** o sistema não tem sessão server-side; o `jogador_id` retornado é confiado pelo servidor em todas as requests seguintes (Regra 6).
- [ ] **1.4** Seed manual: criar você como admin direto no Supabase com `senha_hash = crypt('sua_senha', gen_salt('bf'))` e `is_admin = true`
- [ ] **1.5** Criar `src/context/SessaoContext.tsx`: estado do jogador logado, lê/escreve em localStorage (chave `racha_sessao`), expõe `{ jogador, setJogador, logout }`
- [ ] **1.6** Criar hook `src/hooks/useJogadorLogado.ts` consumindo o SessaoContext
- [ ] **1.7** Criar hook `src/hooks/useAdmin.ts` retornando boolean a partir de `jogador.is_admin`
- [ ] **1.8** Implementar `src/routes/Login.tsx`: formulário username + senha, chama RPC `fazer_login`, em sucesso salva no Context e redireciona para `/`
- [ ] **1.9** Implementar `src/routes/Layout.tsx`: auth gate (redirect pra `/login` se não logado), `<Outlet/>`, navegação inferior e toggle de tema light/dark
- [ ] **1.10** Implementar `src/lib/tema.ts` + hook `useTema()`: lê localStorage `racha_tema` (default `'dark'`), aplica classe `dark` no `<html>`
- [ ] **1.11** Configurar rotas em `src/App.tsx` com React Router (`/login`, `/` protegido, etc.)
- [ ] **1.12** Validar: fluxo de login funcional, sessão persiste após reload, logout limpa estado

---

## Etapa 2 — Schema completo

- [ ] **2.1** Migration `004_create_partidas.sql`: tabela `partidas` (id bigint PK sequence, data_jogo timestamptz, status check draft/published/closed default 'draft', voting_closes_at timestamptz null, criado_por bigint → jogadores, created_at)
- [ ] **2.2** Migration `005_create_partidas_participantes.sql`: tabela `partidas_participantes` (partida_id bigint → partidas, jogador_id bigint → jogadores, time check a/b, posicao check gk/def/mid/fwd, gols int default 0, assistencias int default 0, gols_contra int default 0, PK composta)
- [ ] **2.3** Migration `006_create_votes.sql`: tabela `votes` (id bigint PK sequence, partida_id bigint, voter_id bigint → jogadores, target_id bigint → jogadores, rating int check 0..10, created_at, UNIQUE (partida_id, voter_id, target_id), CHECK voter_id <> target_id)
- [ ] **2.4** Migration `007_view_partida_placar.sql`: view somando gols por time, gols contra no adversário e derivando vencedor
- [ ] **2.5** Migration `008_view_partida_notas.sql`: view agregando `avg_rating` e `vote_count` por (partida_id, target_id), com coluna `nome` (join em jogadores) e **`is_craque bool`** resolvida via `RANK() OVER (PARTITION BY partida_id ORDER BY avg_rating DESC, vote_count DESC, nome ASC) = 1`. **Sem expor `voter_id`.**
- [ ] **2.6** Migration `009_view_ranking.sql`: view com pontos 3/1/0, vitorias, partidas, gols, assistencias por jogador; ordenada por (pontos desc, vitorias desc, partidas desc, gols desc, assistencias desc, nome asc); inclui partidas published+closed
- [ ] **2.7** Migration `010_view_stats_jogador.sql`: view por `jogador_id` com `partidas, gols, assistencias, vitorias` (vitória = pertencia ao time vencedor da partida — join com `partida_placar`). Fonte única para a tela de Perfil.
- [ ] **2.8** Migration `011_rpc_criar_jogador.sql`: função `criar_jogador(p_username, p_nome, p_posicao, p_is_admin)` inserindo com `senha_hash = crypt('123', gen_salt('bf'))`. Admin-only (oculto na UI para não-admin).
- [ ] **2.9** Migration `012_rpc_trocar_senha.sql`: função `trocar_senha(p_jogador_id, p_senha_atual, p_senha_nova)` validando a atual e atualizando o hash. **Risco aceito:** `p_jogador_id` vem do client; combinado com a senha default `"123"`, um jogador técnico pode assumir conta alheia antes dela ser trocada (postura coerente com a Regra 6).
- [ ] **2.10** Migration `013_rpc_criar_partida.sql`: função **transacional** `criar_partida(p_data_jogo, p_criado_por, p_participantes jsonb)` — `BEGIN/EXCEPTION`: insere em `partidas` (com `criado_por = p_criado_por` = admin logado) + as 16 linhas em `partidas_participantes` atomicamente; retorna o `id` da partida. Payload: array `{jogador_id, time, posicao, gols, assistencias}`.
- [ ] **2.11** Migration `014_rpc_registrar_votos.sql`: função **transacional + UPSERT** `registrar_votos(p_partida_id, p_voter_id, p_votos jsonb)` — para cada `{target_id, rating}` faz `INSERT ... ON CONFLICT (partida_id, voter_id, target_id) DO UPDATE SET rating = EXCLUDED.rating`. **Bloqueio server-side duplo:** valida `status='published' AND voting_closes_at > now()` antes de gravar (independente do pg_cron). Permite editar votos dentro da janela.
- [ ] **2.12** Migration `015_pg_cron_fechar_votacao.sql`: habilitar `pg_cron` e agendar job rodando **a cada 1 minuto**: `UPDATE partidas SET status='closed' WHERE status='published' AND voting_closes_at < now()`. (Bloqueio efetivo já garantido por `registrar_votos`; o cron só sincroniza o status pra UI.)
- [ ] **2.13** Seed dos jogadores iniciais via RPC `criar_jogador` (todos com senha default `"123"`)

---

## Etapa 3 — Partida (admin)

- [ ] **3.1** Implementar `src/routes/PartidaNova.tsx`: formulário de data do jogo
- [ ] **3.2** Seletor de 16 jogadores ativos (checkboxes ou pick multi), validar que exatamente 16
- [ ] **3.3** Distribuição em times: 8 no Preto (a) e 8 no Branco (b), com edição manual da alocação
- [ ] **3.4** Atribuição de `posicao` (gk/def/mid/fwd) por participante
- [ ] **3.5** Lançamento de `gols`, `assistencias` e `gols_contra` (int) por participante
- [ ] **3.6** Botão "Salvar rascunho" → chama RPC `criar_partida` (transacional) com `criado_por` = id do admin logado, status inicial `draft`, e os 16 participantes no payload jsonb. Validar atomicidade (tudo ou nada).
- [ ] **3.7** Botão "Publicar" → seta `status='published'` e `voting_closes_at = now()+24h`
- [ ] **3.8** Implementar `src/routes/PartidaEditar.tsx`: carrega partida+participantes, permite editar times/gols/assists/gols contra apenas se `status='published'`
- [ ] **3.9** Bloquear UI de criar/editar para não-admins (ocultar entradas de navegação + redirect na rota)
- [ ] **3.10** Adicionar entradas de navegação para `Nova`/`Editar` só visíveis se `is_admin`

---

## Etapa 4 — Detalhe + Histórico

- [ ] **4.1** Implementar `src/routes/Jogos.tsx`: lista de partidas `published`+`closed` ordenadas por `data_jogo desc`, com card mostrando data, placar (Preto x Branco) e badge de status
- [ ] **4.2** Implementar `src/routes/PartidaDetalhe.tsx`: times Preto/Branco, placar derivado (view `partida_placar`), gols e assists por jogador
- [ ] **4.3** Badge de status da votação: "Aberta — fecha em Xh" / "Encerrada" / "Você já votou"
- [ ] **4.4** Destaque do craque da partida (linha com `is_craque=true` da view `partida_notas`) quando `status='closed'`
- [ ] **4.5** Botão "Votar" (levar pra `/partida/:id/votar`) visível só se `status='published'`, dentro da janela, e o usuário ainda não votou

---

## Etapa 5 — Ranking

- [ ] **5.1** Implementar `src/routes/Ranking.tsx`: tabela consumindo a view `ranking`
- [ ] **5.2** Colunas: posição, nome, pontos, vitórias, partidas, gols, assists
- [ ] **5.3** Destaque visual da 1ª colocada com a cor de destaque `--cor-destaque` (azul #2563eb)
- [ ] **5.4** Ordenação já garantida pela view (sem ordenar no client)

---

## Etapa 6 — Votação

- [ ] **6.1** Implementar `src/routes/PartidaVotar.tsx`: carrega participantes da partida, esconde o próprio jogador (não vota em si)
- [ ] **6.2** Slider ou seletor 0–10 por participante, com estado local
- [ ] **6.3** Botão "Enviar votos" → chama RPC `registrar_votos` (transacional + UPSERT) com `partida_id`, `voter_id` = jogador logado, e array `{target_id, rating}`. Bloqueio server-side duplo já garantido pela RPC.
- [ ] **6.4** Pré-carregar votos existentes do jogador (SELECT em `votes WHERE voter_id` = logado) — mostra "você já votou" e permite editar dentro da janela (UPSERT lida com a re-edição)
- [ ] **6.5** Bloquear UI de voto se `status <> 'published'` ou `voting_closes_at < now()` (desabilita o botão "Enviar")
- [ ] **6.6** Após `status='closed'`, tela `PartidaDetalhe` revela notas e craque (linha `is_craque=true`) a partir da view `partida_notas`
- [ ] **6.7** Validar: CHECK `voter_id <> target_id` impede auto-voto no DB; UI também esconde o próprio jogador

---

## Etapa 7 — Perfil + Troca de senha

- [ ] **7.1** Implementar `src/routes/Perfil.tsx`: dados do jogador logado (nome, username, posição, is_admin)
- [ ] **7.2** Stats pessoais do jogador consumindo a view `stats_jogador` (partidas, gols, assistencias, vitorias)
- [ ] **7.3** Formulário "Editar senha": campos senha atual + senha nova + confirmação
- [ ] **7.4** Chamar RPC `trocar_senha(jogador_id_logado, senha_atual, senha_nova)` e tratar erro de senha atual incorreta
- [ ] **7.5** Botão de logout no perfil

---

## Etapa 8 — Cadastro de jogadores (admin)

- [ ] **8.1** Implementar `src/routes/NovoJogador.tsx`: formulário (username, nome, posição gk/def/mid/fwd, checkbox is_admin) chamando RPC `criar_jogador` (senha default `"123"` é setada pela RPC)
- [ ] **8.2** Validar username único (tratar erro de constraint vinda da RPC)
- [ ] **8.3** Bloquear rota para não-admins (ocultar + redirect), adicionar entrada de navegação só visível se `is_admin`
- [ ] **8.4** Mensagem de sucesso após criar ("Jogador X criado com senha padrão 123")

## Etapa 9 — Banner de lembrete + Polish

- [ ] **9.1** Implementar componente `BannerLembrete.tsx` global no `Layout`: detecta partidas `published` abertas onde o usuário ainda não votou
- [ ] **9.2** Countdown até `voting_closes_at` no banner ("Faltam 3h12m para a votação fechar")
- [ ] **9.3** Link direto do banner pra tela de votação
- [ ] **9.4** Revisar acessibilidade mobile (tamanhos de toque, contraste no light/dark)
- [ ] **9.5** Estados de loading e erro nas telas principais (spinners/mensagens)
- [ ] **9.6** Revisão geral de UX: fluxo completo de criar partida → publicar → votar → ver craque → ver ranking
- [ ] **9.7** Testes com o grupo real: distribuir URL, coletar feedback, ajustar
