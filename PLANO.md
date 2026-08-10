# Racha — Plano de Implementação (MVP)

**Site** (racha-gragoata-cbo) para o grupo de futebol: histórico de partidas, gols/assistências, votação 24h (nota 0–10 + craque derivado) e ranking por pontos. Uma URL acessível em qualquer celular (Android ou iPhone) pelo navegador. Deploy na Vercel.

---

## 1. Stack técnica (mínima)

- **Vite + React + TypeScript** (template `react-ts`)
- **Tailwind CSS**
- **React Router** (navegação entre telas)
- **@supabase/supabase-js** (cliente do banco)
- **Estado/sessão:** React Context + localStorage

**Sem bibliotecas extras no início.** Se alguma facilitar muito uma parte específica depois, adiciona pontualmente.

---

## 2. Modelo de dados (Postgres / Supabase)

> **Zero UUID.** PKs/FKs são `bigint` (sequence). Sem Supabase Auth por usuário.
> **Gols, assistências e gols contra são contadores por participante.** Gol contra soma no placar do time adversário; resultado compara os placares.
> **Times fixos:** `a` = Preto, `b` = Branco.
> **Sem RLS, sem triggers, sem policies.** Segurança só no app, baseada em `is_admin`.

### `jogadores`

- `id` bigint PK (sequence)
- `username` text unique
- `senha_hash` text ← senha exata definida pelo jogador (default `"123"`)
- `nome` text, `posicao` (`gk|def|mid|fwd`)
- `is_admin` bool, `is_ativo` bool, `created_at` timestamptz
- **Sem avatar.** Exibição é sempre o nome como texto.

### `partidas`

- `id` bigint PK (sequence)
- `data_jogo` timestamptz (a quinta)
- `status` (`draft|published|closed`)
- `voting_closes_at` timestamptz (setado em publish = now()+24h)
- `criado_por` bigint → jogadores
- `created_at` timestamptz
- `draft`: admin montando. `published`: votação aberta + conta no ranking + editável. `closed`: travada.

### `partidas_participantes` (16 linhas/partida — 8 por time)

- `partida_id` bigint → partidas
- `jogador_id` bigint → jogadores
- `time` (`a|b`)
- `posicao` (`gk|def|mid|fwd`)
- `gols` int default 0
- `assistencias` int default 0
- `gols_contra` int default 0
- PK composta (partida_id, jogador_id)

### `votes` (acesso normal — confiança no client)

- `id` bigint PK (sequence)
- `partida_id` bigint → partidas
- `voter_id` bigint → jogadores
- `target_id` bigint → jogadores
- `rating` int check 0..10
- `created_at` timestamptz
- `UNIQUE (partida_id, voter_id, target_id)` + `CHECK (voter_id <> target_id)`
- Anonimato é propriedade da UX (a UI só expõe próprios votos + médias), não do servidor.

### Constante no site (não no DB)

```ts
export const TIMES = {
  a: { id: "a", nome: "Time Preto", cor: "#111827" },
  b: { id: "b", nome: "Time Branco", cor: "#f9fafb" },
} as const;
```

### Funções RPC (PostgreSQL, senha em texto puro)

- **`fazer_login(p_username text, p_senha text)`** → compara a senha exata e retorna `jogadores` (sem `senha_hash`) ou NULL.
- **`criar_jogador(p_username, p_nome, p_posicao, p_is_admin)`** → insere jogador com `senha_hash = '123'` (default `"123"`). Admin-only (oculto na UI para não-admin).
- **`trocar_senha(p_jogador_id, p_senha_atual, p_senha_nova)`** → valida a senha atual e atualiza o texto salvo. `p_jogador_id` vem do client (sem sessão server-side). **Risco aceito:** um jogador técnico pode invocar com ID alheio + senha default `"123"` e assumir conta de terceiros (postura de segurança relaxada, coerente com a regra 6).
- **`criar_partida(p_data_jogo, p_criado_por, p_participantes jsonb)`** → **transacional** (`BEGIN/EXCEPTION`): insere em `partidas` + as 16 linhas em `partidas_participantes` atomicamente. Retorna o `id` da partida. O payload `p_participantes` é um array de `{jogador_id, time, posicao, gols, assistencias}`.
- **`registrar_votos(p_partida_id, p_voter_id, p_votos jsonb)`** → **transacional + UPSERT**: para cada voto no array `{target_id, rating}`, faz `INSERT ... ON CONFLICT (partida_id, voter_id, target_id) DO UPDATE SET rating = EXCLUDED.rating`. Valida, antes de gravar, que `status='published'` e `voting_closes_at > now()` (bloqueio server-side duplo, independente do pg_cron). Permite editar votos dentro da janela de 24h.

### Views derivadas (read-only)

- **`partida_placar`**: placar (soma de gols por time `a`/`b`) e vencedor.
- **`partida_notas`**: `partida_id, target_id, avg_rating, vote_count, nome` + coluna **`is_craque bool`** resolvida via `RANK() OVER (PARTITION BY partida_id ORDER BY avg_rating DESC, vote_count DESC, nome ASC) = 1` (desempate: mais votos → alfabético). **Sem `voter_id`** — única fonte de notas/craque na UI.
- **`ranking`**: por jogador — `pontos, vitorias, partidas, gols, assistencias`, ordenado por `(pontos desc, vitorias desc, partidas desc, gols desc, assistencias desc, nome asc)`. Inclui `published`+`closed`.
- **`stats_jogador`**: por `jogador_id` — `partidas, gols, assistencias, vitorias` (vitória = pertencia ao time vencedor da partida). Fonte única para a tela de Perfil.

---

## 3. Regras de negócio confirmadas

1. **Votação (24h):** ao publicar, `voting_closes_at = published_at + 24h`. Votante dá 0–10 para cada um dos outros 15. Craque = maior média (desempate: mais votos → alfabético). Não vota em si (CHECK + UI).
2. **Encerramento:** ao passar `voting_closes_at`, partida → `closed` via `pg_cron` rodando **a cada 1 minuto**. **Bloqueio server-side duplo:** além do cron, a RPC `registrar_votos` valida `status='published' AND voting_closes_at > now()` antes de gravar — garantindo que votos fora do prazo nunca sejam aceitos, mesmo com defasagem do cron. Sem mais votos; craque e médias revelados.
3. **Edição:** admin edita times/gols/assists enquanto `published`; ao virar `closed`, trava.
4. **Ranking:** pontos 3/1/0; desempate **vitórias → partidas → gols → assistências → alfabético**. Inclui `published`+`closed`.
5. **Times:** sempre `a` (Preto) e `b` (Branco). Fixo.
6. **Segurança:** sem RLS/triggers/policies. Admin = `is_admin` no perfil (oculta funções de admin na UI). Servidor confia no `jogador_id` enviado pelo site. **Aceito:** um amigo técnico, indo fora da UI, conseguiria ver votos alheios ou votar como outro.
7. **Sem push.** Lembretes (votação abriu, faltam 3h/2h/1h) viram banner dentro do site + aviso no WhatsApp do grupo.
8. **Senhas:** default `"123"` em todo jogador criado; jogador troca em "Editar senha" na tela de perfil (senha atual + nova).

---

## 4. Sessão & identidade no site

- **Login:** tela pede `username` + `senha` → chama RPC `fazer_login` → recebe `jogador` (sem `senha_hash`) → guarda em **localStorage** + Context.
- **Cada request:** site inclui o `jogador_id` logado no payload (ex.: `voter_id` ao votar). Servidor confia.
- **Logout:** limpa localStorage + Context.
- **Sessão persiste** entre aberturas (localStorage).

---

## 5. Telas (React Router)

```
src/
  routes/
    Layout.tsx               # auth gate + navegação + toggle de tema (light/dark)
    Login.tsx                # username + senha (RPC fazer_login)
    Jogos.tsx                # histórico (recente primeiro)
    PartidaDetalhe.tsx       # times (Preto/Branco), placar, gols/assists, craque, botão votar
    PartidaNova.tsx          # (admin) criar: pick 16, montar times, lançar gols/assists, publicar
    PartidaEditar.tsx        # (admin) editar enquanto published
    PartidaVotar.tsx         # nota 0–10 p/ cada um dos 15 (sem si)
    Ranking.tsx              # view ranking
    Perfil.tsx               # próprio perfil + stats + botão "Editar senha"
    NovoJogador.tsx          # (admin) cadastrar novo jogador (RPC criar_jogador)
```

- Rotas `Nova`/`Editar` protegidas por `is_admin` (ocultas + redirect).
- **Banner de lembrete** no topo (votação aberta / prestes a fechar) — visível só a quem ainda não votou.
- Badge de status da votação: "Aberta — fecha em Xh" / "Encerrada" / "Você já votou".
- **Sem avatares.** Apenas o nome do jogador como texto.
- Times sempre "Time Preto" (a) e "Time Branco" (b).
- **Mobile-first** (uso real é no celular); layout responsivo.

---

## 6. Visual

- **Nome do site:** racha-gragoata-cbo.
- **Tema:** light/dark alternável (toggle no cabeçalho). Preferência guardada em localStorage.
- **Cor de destaque:** azul (#2563eb) para botões/links/ações principais, badges de vitória, destaque do craque e do 1º do ranking. Tokenizada via variável CSS `--cor-destaque: #2563eb` aplicada em classes utilitárias Tailwind (ex.: `bg-[var(--cor-destaque)]`).
- **Implementação do tema (Tailwind v4):** CSS-first, sem `tailwind.config.js`. Diretiva `@import "tailwindcss";` + `@custom-variant dark (&:where(.dark, .dark *));` no `index.css`. Toggle aplica classe `dark` no `<html>`.

---

## 7. Distribuição

- Deploy na **Vercel** (repositório GitHub → auto-deploy).
- Amigos acessam a URL no navegador do celular.
- Atualizar = push no git; todos recebem a versão nova ao recarregar.

---

## 8. Ordem de implementação (fases)

0. **Scaffold:** `npm create vite@latest` template `react-ts` + Tailwind (com `darkMode: 'class'`) + React Router + `@supabase/supabase-js` + env (URL/anon key) + constante `TIMES`. Deploy inicial na Vercel.
1. **Login & sessão:** RPC `fazer_login`, tela de login, localStorage, Context, gate de rotas, hooks `useJogadorLogado()` + `useAdmin()` + toggle de tema. Seed de você como admin (senha via hash manual no Supabase).
2. **Schema:** migrations (tabelas, views, RPCs `fazer_login`/`criar_jogador`/`trocar_senha`). Seed dos jogadores iniciais (todos com senha default `"123"`).
3. **Partida (admin):** criar (draft), pick 16, montar times Preto/Branco de 8, lançar gols+assists, publicar (abre 24h). Funções de admin ocultas na UI.
4. **Detalhe + histórico:** lista de partidas + tela de detalhe (times Preto/Branco, placar derivado, gols/assists).
5. **Ranking:** tela consumindo a view `ranking`.
6. **Votação:** tela 0–10 (sem si), INSERT em `votes` (voter_id = logado), janela 24h, reveal do craque ao fechar. Cron de fechamento (pg_cron).
7. **Perfil + troca de senha:** stats pessoais + formulário "Editar senha" (RPC `trocar_senha`).
8. **Banner de lembrete** + polish + testes com o grupo.
