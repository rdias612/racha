# 💡 Ideias de Novas Funcionalidades — Racha Gragoatá CBO

> **Data da análise**: 25/08/2026  
> **Fonte**: leitura completa do código (21 telas em `src/routes/`, libs em `src/lib/`, 86 migrations, 6 views, ~40 RPCs, 4 jobs `pg_cron` e 3 Edge Functions).  
> **Como ler**: cada ideia traz descrição, por que é interessante, esboço técnico (o que muda no banco e no frontend) e esforço estimado — **P** pequeno (horas), **M** médio (1–2 semanas de racha), **G** grande (3+ semanas).

---

## Estado atual (o que já existe e não precisa ser refeito)

O ciclo central do racha está completo: agendamento semanal automático (cron de segunda), confirmação de presença com capacidade 14 + prazo de quarta 16h, divisão de times balanceada com sorteio automático e goleiros dedicados, súmula ao vivo com gols/assistências/gols contra (polling de 10s), votação com média aparada e Craque da Partida, ranking histórico, parcerias/duplas, comparador head-to-head, boletim anual (`resumo_ano`), financeiro admin completo (mensalidade, avulso, diária de goleiro, eventos automáticos, Excel) e notificações push com painel admin de templates.

Os gaps abaixo são o que **não existe** hoje em nenhuma camada: extrato financeiro para o jogador comum, filtro de temporada no ranking / sala de troféus, notificação de resultado e craque, evolução histórica de notas e bolão de palpites.

---

## Tabela-resumo

| #   | Funcionalidade                             | Impacto esperado | Esforço | Área principal    |
| --- | ------------------------------------------ | ---------------- | ------- | ----------------- |
| 1   | Extrato "Minhas Dívidas" para o jogador    | Alto             | P       | Frontend          |
| 2   | Temporadas no Ranking + Sala de Troféus    | Alto             | M       | Banco + Ranking   |
| 3   | Notificação de resultado e Craque pós-jogo | Alto             | M       | Push              |
| 4   | Evolução de notas e histórico por partida  | Médio            | P/M     | Banco + Perfil    |
| 5   | Bolão de palpites (placar + craque)        | Alto             | M/G     | Banco + nova tela |

---

## Detalhamento

### 1. Extrato "Minhas Dívidas" para o jogador — `P`

**O que é**: hoje o financeiro é 100% admin (`routes/Administrador.tsx`); o jogador comum só cadastra PIX/telefone no Perfil e é cobrado por WhatsApp. Dar a cada atleta uma tela (ou seção do Perfil) com suas pendências, histórico de pagamentos e total devido.

**Por que é interessante**: cobrança deixa de ser opaca — o jogador consulta a qualquer momento, reduz ping-pong no grupo e o admin para de ser "gerente de cobrança". A memória de projeto já apontava "self-view" como pendência do roadmap financeiro.

**Esboço técnico**:

- Os dados e queries já existem: `dividas` é legível pelo client e `src/lib/dividas.ts` já tem `listarDividasEmAberto` — basta filtrar por `jogador_id` do logado (`useJogadorLogado`).
- Tela nova `/financas` (fora das abas) ou seção no `Perfil.tsx`; usar lista contínua com `divide-y` (não empilhar cards), valores em `font-mono` com `formatarReais`.
- Opcional: CTA "Já paguei, avisar admin" gerando notificação/Snackbar.

---

### 2. Temporadas no Ranking + Sala de Troféus — `M`

**O que é**: a view `ranking` agrega **todo o histórico** sem filtro temporal (só `resumo_ano` é por ano). Adicionar seletor de temporada ao Ranking e criar uma "Sala de Troféus" com os campeões de cada ano.

**Por que é interessante**: o racha já tem histórico importado de outras temporadas — o ranking eterno esmaga novatos com veteranos de 200 jogos. Ranking por ano reaquece a disputa a cada janeiro, e a Sala de Troféus vira o "museu" do grupo (artilheiro, maestro, craque mais votado de cada temporada).

**Esboço técnico**:

- Sem tabela nova obrigatória: o ano já é derivável de `data_jogo AT TIME ZONE 'America/Sao_Paulo'` (padrão do `resumo_ano`). Criar RPC `ranking_por_ano(p_ano)` STABLE ou function set-returning no lugar da view fixa; o `pares_racha`/`parcerias_*` podem seguir o mesmo parâmetro opcional.
- `Ranking.tsx`: seletor de ano (chip horizontal, `data-no-swipe`), chave de cache `ranking:${metrica}:${ano}` (invalidação já suporta).
- Tela "Sala de Troféus" (`/trofeus` ou seção do Resumo): por ano, campeão de pontos, artilheiro, maestro, craque mais votado — dados quase todos já saem de `resumo_ano`.

---

### 3. Notificação de resultado e Craque pós-jogo — `M`

**O que é**: hoje o push cobre confirmação de presença e lembretes de votação. Nada avisa "acabou o jogo". Disparar push ao finalizar a partida com placar e prazo da votação, e push opcional ao fechar a votação revelando o Craque.

**Por que é interessante**: é a notificação de maior taxa de abertura possível — todo mundo quer saber o placar. Puxa o time inteiro para a cédula de votação no mesmo minuto, aumentando adesão (hoje dependente do banner no app).

**Esboço técnico**:

- No `finalizar_partida` (ou hook pós-commit), inserir linha em tabela de disparos no padrão `push_reminder_deliveries` (reusar a arquitetura de claim idempotente) e chamar a Edge Function via `pg_net` como os crons fazem.
- Nova Edge Function `send-match-result` (clonar estrutura da `send-voting-reminders`): destinatários = participantes ativos com subscription; payload `{placar, url: /partida/:id}`.
- Template editável no painel `/notificacoes` (`notificacoes_config` ganha bloco "Resultado") com variáveis `{placar_a} {placar_b} {prazo_votacao}`.
- Bônus: push "Craque revelado" disparado pelo cron de fechamento quando `status → closed`.

---

### 4. Evolução de notas e histórico por partida — `P/M`

**O que é**: as notas existem por partida (`partida_notas`) mas ninguém vê a linha do tempo. Mostrar no Perfil/Estatísticas a curva de notas aparadas do atleta ao longo da temporada, com melhor/pior nota e média dos últimos 5 jogos.

**Por que é interessante**: "estou subindo ou caindo?" é a pergunta que todo jogador se faz; a curva dá assunto para a resenha de sexta e alimenta a rivalidade do Comparador (lado a lado das duas curvas).

**Esboço técnico**:

- RPC STABLE `historico_notas_jogador(p_jogador_id)` retornando `(data_jogo, nota_aparada, votos)` — agregação no servidor, seguindo o padrão da Migration 070; nunca baixar a tabela `votes` inteira.
- Frontend: sparkline SVG simples em `font-mono tabular-nums` (sem lib de gráficos, mantendo o bundle enxuto) no `Perfil.tsx`; no `Comparador.tsx`, duas curvas sobrepostas.

---

### 5. Bolão de palpites (placar + craque) — `M/G`

**O que é**: antes de cada partida abrir (`status = draft`), qualquer jogador logado palpita o placar exato e o Craque da Partida. Ao publicar, pontuação automática e ranking de palpiteiros.

**Por que é interessante**: dá o que fazer no app entre a confirmação de quarta e o jogo de quinta — engajamento no dia mais morto da semana. E o "vidente do racha" vira mais uma taça de resenha.

**Esboço técnico**:

- Migration: tabela `palpites (id bigserial, partida_id, jogador_id, gols_a smallint, gols_b smallint, craque_jogador_id, created_at, UNIQUE(partida_id, jogador_id))`; só aceita palpite com `status = 'draft'` (RPC `registrar_palpite` com gate).
- Pontuação sugerida: placar exato 3 pts · acerto do vencedor/empate 1 pt · craque certo 2 pts. RPC `apurar_palpites(p_partida_id)` chamada no `finalizar_partida` (transacional, tudo no banco).
- Tela própria em fluxo focado (`/partida/:id/palpite`, TabBar oculta) + ranking `palpiteiros` como nova métrica.
