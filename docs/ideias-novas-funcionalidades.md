# 💡 Ideias de Novas Funcionalidades — Racha Gragoatá CBO

> **Data da análise**: 25/08/2026
> **Fonte**: leitura completa do código (21 telas em `src/routes/`, libs em `src/lib/`, 86 migrations, 6 views, ~40 RPCs, 4 jobs `pg_cron` e 3 Edge Functions).
> **Como ler**: cada ideia traz descrição, por que é interessante, esboço técnico (o que muda no banco e no frontend) e esforço estimado — **P** pequeno (horas), **M** médio (1–2 semanas de racha), **G** grande (3+ semanas).

---

## Estado atual (o que já existe e não precisa ser refeito)

O ciclo central do racha está completo: agendamento semanal automático (cron de segunda), confirmação de presença com capacidade 14 + prazo de quarta 16h, divisão de times balanceada com sorteio automático e goleiros dedicados, súmula ao vivo com gols/assistências/gols contra (polling de 10s), votação com média aparada e Craque da Partida, ranking histórico, parcerias/duplas, comparador head-to-head, boletim anual (`resumo_ano`), financeiro admin completo (mensalidade, avulso, diária de goleiro, eventos automáticos, Excel) e notificações push com painel admin de templates.

Os gaps abaixo são o que **não existe** hoje em nenhuma camada: cartões disciplinares, estatísticas de goleiro, bolão, filtro de temporada no ranking, extrato financeiro para o jogador comum, cronômetro/tempo de jogo, substituições, comprovantes de pagamento, preferências de push por jogador e notificação de resultado.

---

## Tabela-resumo

| #   | Funcionalidade                                  | Impacto esperado | Esforço | Área principal        |
| --- | ----------------------------------------------- | ---------------- | ------- | --------------------- |
| 1   | Extrato "Minhas Dívidas" para o jogador         | Alto             | P       | Frontend              |
| 2   | Cronômetro e minuto dos eventos no ao-vivo      | Alto             | M       | Banco + Ao-vivo       |
| 3   | Cartões disciplinares e Ranking Fair Play       | Alto             | M       | Banco + Ao-vivo       |
| 4   | Estatísticas de goleiro (defesas, clean sheets) | Alto             | M       | Banco + Ao-vivo       |
| 5   | Temporadas no Ranking + Sala de Troféus         | Alto             | M       | Banco + Ranking       |
| 6   | Notificação de resultado e Craque pós-jogo      | Alto             | M       | Push                  |
| 7   | Push granular por jogador (preferências)        | Médio            | M       | Banco + Perfil + Push |
| 8   | Evolução de notas e histórico por partida       | Médio            | P/M     | Banco + Perfil        |
| 9   | Card de súmula compartilhável (imagem p/ grupo) | Alto             | P/M     | Frontend puro         |
| 10  | Realtime no ao-vivo (Supabase Channels)         | Médio            | P/M     | Ao-vivo               |
| 11  | Modo espectador público (link sem login)        | Médio            | P/M     | Frontend              |
| 12  | Bolão de palpites (placar + craque)             | Alto             | M/G     | Banco + nova tela     |
| 13  | Comprovantes de pagamento (Storage)             | Médio            | M       | Banco + Storage       |
| 14  | Reservas e substituições no dia do jogo         | Médio            | G       | Banco + fluxo inteiro |
| 15  | Conquistas e selos (hat-trick, ferro velho...)  | Médio            | M       | Banco + Perfil        |

---

## Detalhamento

### 1. Extrato "Minhas Dívidas" para o jogador — `P`

**O que é**: hoje o financeiro é 100% admin (`routes/Administrador.tsx`); o jogador comum só cadastra PIX/telefone no Perfil e é cobrado por WhatsApp. Dar a cada atleta uma tela (ou seção do Perfil) com suas pendências, histórico de pagamentos e total devido.

**Por que é interessante**: cobrança deixa de ser opaca — o jogador consulta a qualquer momento, reduz ping-pong no grupo e o admin para de ser "gerente de cobrança". A memória de projeto já apontava "self-view" como pendência do roadmap financeiro.

**Esboço técnico**:

- Os dados e queries já existem: `dividas` é legível pelo client e `src/lib/dividas.ts` já tem `listarDividasEmAberto` — basta filtrar por `jogador_id` do logado (`useJogadorLogado`).
- Tela nova `/financas` (fora das abas) ou seção no `Perfil.tsx`; usar lista contínua com `divide-y` (não empilhar cards), valores em `font-mono` com `formatarReais`.
- Opcional: CTA " Já paguei, avisar admin" gerando notificação/Snackbar.

---

### 2. Cronômetro e minuto dos eventos no ao-vivo — `M`

**O que é**: hoje o modo ao vivo não tem noção de tempo — só polling de 10s. Adicionar cronômetro de jogo no placar LED e registrar o minuto de cada gol/assistência.

**Por que é interessante**: o placar ganha cara de placar de LED de verdade ("Preto 2 × 1 Branco — 34'"); abre a porta para estatísticas ricas (gol mais cedo da temporada, finalização no minuto 89, rendimento por período).

**Esboço técnico**:

- Migration 087+: coluna `iniciada_em timestamptz` em `partidas` (setada no `abrir_partida`) e coluna `minuto smallint` em `partida_eventos` (default = minuto derivado de `now() - iniciada_em`).
- `PartidaAoVivo.tsx`: timer local calculado de `iniciada_em` (sem relógio do device), exibição no `CampoPartida`/placar.
- Depois: view de "gols por faixa de minuto" e destaques no `Resumo.tsx` ("gol mais tardio do ano").
- `salvar_edicao_partida` e `DialogoEvento` ganham edição de minuto.

---

### 3. Cartões disciplinares e Ranking Fair Play — `M`

**O que é**: registrar cartões amarelos e vermelhos na súmula ao vivo (o CHECK de `partida_eventos.tipo` hoje aceita só `gol`/`gol_contra`) e criar consequências: ranking fair play e suspensão automática por acumulação.

**Por que é interessante**: pelada sem cartão é festa até alguém romper o cristal. Disciplina registrada dá outra dimensão competitiva (premio "Atleta Fair Play" no Boletim) e a suspensão automática tira do admin o papel de policial.

**Esboço técnico**:

- Migration: ampliar CHECK para `('gol','gol_contra','amarelo','vermelho')`; contadores `cartoes_amarelos`/`cartoes_vermelhos` em `partidas_participantes` (seguindo o padrão de `sincronizar_contadores_partida`).
- `DialogoEvento`: nova etapa de tipo; haptic `vibrateWarning` no amarelo, `vibrateError` no vermelho.
- Regra de suspensão: `confirmar_presenca` valida "3 amarelos acumulados ou vermelho no último jogo = bloqueado nesta semana" (mensagem amigável via `formatarMensagemErro`).
- Ranking Fair Play: view `fair_play` (menos cartões por jogo) como 5ª métrica em `/ranking/:metrica`.

---

### 4. Estatísticas de goleiro (defesas, gols sofridos, clean sheets) — `M`

**O que é**: os goleiros hoje só entram na história pela diária de R$ 30 e pelas notas. Registrar defesas na súmula ao vivo e derivar gols sofridos/clean sheets por partida e por temporada.

**Por que é interessante**: cria a disputa "Luva de Ouro do Racha" — quem defende mais, melhor % de defesa, mais clean sheets. Valoriza a posição que hoje não aparece em ranking nenhum (nem vota, nem aparece na artilharia).

**Esboço técnico**:

- Migration: novo tipo `'defesa'` em `partida_eventos` (jogador = goleiro) ou contadores `defesas` em `partidas_participantes`; gols sofridos já são deriváveis do placar (`partida_placar` por time).
- View `stats_goleiros` (defesas, defesas/jogo, % defesa = defesas ÷ (defesas + gols sofridos), clean sheets) e/ou RPC STABLE no padrão de `obter_medias_notas_jogadores` (agregação no servidor, nunca no client).
- Ao-vivo: tocar no goleiro no `CampoPartida` registra defesa (um toque = 1); `PartidaEditar` ajusta no pós-jogo.
- Seção "Luvas" na aba Estatísticas ou card no `Resumo.tsx`.

---

### 5. Temporadas no Ranking + Sala de Troféus — `M`

**O que é**: a view `ranking` agrega **todo o histórico** sem filtro temporal (só `resumo_ano` é por ano). Adicionar seletor de temporada ao Ranking e criar uma "Sala de Troféus" com os campeões de cada ano.

**Por que é interessante**: o racha já tem histórico importado de outras temporadas — o ranking eterno esmaga novatos com veteranos de 200 jogos. Ranking por ano reaquece a disputa a cada janeiro, e a Sala de Troféus vira o "museu" do grupo (artilheiro, maestro, craque mais votado de cada temporada).

**Esboço técnico**:

- Sem tabela nova obrigatória: o ano já é derivável de `data_jogo AT TIME ZONE 'America/Sao_Paulo'` (padrão do `resumo_ano`). Criar RPC `ranking_por_ano(p_ano)` STABLE ou function set-returning no lugar da view fixa; o `pares_racha`/`parcerias_*` podem seguir o mesmo parâmetro opcional.
- `Ranking.tsx`: seletor de ano (chip horizontal, `data-no-swipe`), chave de cache `ranking:${metrica}:${ano}` (invalidação já suporta).
- Tela "Sala de Troféus" (`/trofeus` ou seção do Resumo): por ano, campeão de pontos, artilheiro, maestro, craque mais votado — dados quase todos já saem de `resumo_ano`.

---

### 6. Notificação de resultado e Craque pós-jogo — `M`

**O que é**: hoje o push cobre confirmação de presença e lembretes de votação. Nada avisa "acabou o jogo". Disparar push ao finalizar a partida com placar e prazo da votação, e push opcional ao fechar a votação revelando o Craque.

**Por que é interessante**: é a notificação de maior taxa de abertura possível — todo mundo quer saber o placar. Puxa o time inteiro para a cédula de votação no mesmo minuto, aumentando adesão (hoje dependente do banner no app).

**Esboço técnico**:

- No `finalizar_partida` (ou hook pós-commit), inserir linha em tabela de disparos no padrão `push_reminder_deliveries` (reusar a arquitetura de claim idempotente) e chamar a Edge Function via `pg_net` como os crons fazem.
- Nova Edge Function `send-match-result` (clonar estrutura da `send-voting-reminders`): destinatários = participantes ativos com subscription; payload `{placar, url: /partida/:id}`.
- Template editável no painel `/notificacoes` (`notificacoes_config` ganha bloco "Resultado") com variáveis `{placar_a} {placar_b} {prazo_votacao}`.
- Bônus: push "Craque revelado" disparado pelo cron de fechamento quando `status → closed`.

---

### 7. Push granular por jogador (preferências) — `M`

**O que é**: o opt-in atual é tudo-ou-nada (botão no Resumo). Cada jogador deveria escolher o que quer receber: confirmação semanal, reforço, lembretes de votação, resultado (ideia 6), cobrança financeira.

**Por que é interessante**: notificação irrelevante é a receita para o usuário desativar o push inteiro — e aí perde até os lembretes de votação que importam. Granularidade retenha a inscrição ativa.

**Esboço técnico**:

- Migration: tabela `push_preferencias (jogador_id PK, confirmacao bool, reforco bool, votacao bool, resultado bool, financeiro bool)` com defaults ligados.
- Edge Functions leem as preferências antes de enviar (JOIN simples); `CardNotificacoes` vira painel de toggles no Perfil (respeitando `min-h-[44px]`).
- Corrige de passagem uma inconsistência atual: a tela `/notificacoes` manda o jogador ativar push "no seu Perfil", mas o toggle hoje mora no Resumo.

---

### 8. Evolução de notas e histórico por partida — `P/M`

**O que é**: as notas existem por partida (`partida_notas`) mas ninguém vê a linha do tempo. Mostrar no Perfil/Estatísticas a curva de notas aparadas do atleta ao longo da temporada, com melhor/pior nota e média dos últimos 5 jogos.

**Por que é interessante**: "estou subindo ou caindo?" é a pergunta que todo jogador se faz; a curva dá assunto para a resenha de sexta e alimenta a rivalidade do Comparador (lado a lado das duas curvas).

**Esboço técnico**:

- RPC STABLE `historico_notas_jogador(p_jogador_id)` retornando `(data_jogo, nota_aparada, votos)` — agregação no servidor, seguindo o padrão da Migration 070; nunca baixar a tabela `votes` inteira.
- Frontend: sparkline SVG simples em `font-mono tabular-nums` (sem lib de gráficos, mantendo o bundle enxuto) no `Perfil.tsx`; no `Comparador.tsx`, duas curvas sobrepostas.

---

### 9. Card de súmula compartilhável (imagem para o grupo) — `P/M`

**O que é**: botão "Compartilhar súmula" na `PartidaDetalhe` que gera uma imagem PNG no estilo súmula de mesa / placar LED — escudo, placar, times com gols, Craque da Partida e notas — pronta para colar no grupo do WhatsApp.

**Por que é interessante**: hoje quem quer mostrar o resultado tira print da tela. Um card bonito e oficial vira o ritual pós-jogo do grupo, é marketing gratuito do app para os avulsos e reforça a identidade "Súmula de Quinta" (fonte Barlow Condensed, sombra-carimbo, âmbar de destaque).

**Esboço técnico**:

- 100% client-side: Canvas API desenhando o card (as fontes já são carregadas pelo app) + Web Share API (`navigator.share` com arquivo) com fallback de download.
- Nenhuma migration; componente `CardSumula` reutilizando dados já carregados na tela.
- Respeitar tema (versão clara e escura do card) e o design system (cantos 4px, tokens de cor — nada de gradiente).

---

### 10. Realtime no ao-vivo (Supabase Channels) — `P/M`

**O que é**: substituir (ou complementar) o polling de 10s do `PartidaAoVivo.tsx` por `postgres_changes` do Supabase Realtime em `partida_eventos` e `partidas`.

**Por que é interessante**: gol aparece no mesmo segundo para todos os espectadores (hoje: até 10s de atraso + risco de perder o momento), economiza bateria/dados móveis no campinho e reduz carga de queries no banco (o polling roda para cada espectador a cada 10s).

**Esboço técnico**:

- `supabase.channel('partida:${id}').on('postgres_changes', ...)` para INSERT em `partida_eventos` e UPDATE em `partidas` (status/placar); manter polling como fallback (conexão instável é premissa do projeto) — ex.: revalidar a cada 30s em vez de 10s.
- Habilitar realtime nas tabelas na migration (`ALTER TABLE ... REPLICA IDENTITY` + publication) e ajustar grants de leitura do realtime.

---

### 11. Modo espectador público (link sem login) — `P/M`

**O que é**: uma rota pública de visualização da partida ao vivo (`/partida/:id/espectador` ou reutilizando a detalhe em modo read-only) que funcione sem login, para compartilhar no grupo do WhatsApp com avulsos e curiosos.

**Por que é interessante**: hoje todos os fluxos exigem sessão; o avulso que ainda não tem login não consegue acompanhar nada. Um link direto do placar ao vivo engaja quem está decidindo se vai na próxima quinta.

**Esboço técnico**:

- Views e tabelas de leitura (`partidas_com_placar`, `partida_placar`, `partida_eventos`) já são legíveis por `anon` — o custo de backend é próximo de zero.
- Frontend: variante do `PartidaDetalhe` sem ações (sem votar/confirmar/admin), CTA "Entra no racha — fala com o admin"; registrar rota no mapa do `Skeletons.tsx` e no `rotas.ts`.
- Avaliar: esconder notas/votos até `closed` (mesma regra da súmula oficial).

---

### 12. Bolão de palpites (placar + craque) — `M/G`

**O que é**: antes de cada partida abrir (`status = draft`), qualquer jogador logado palpita o placar exato e o Craque da Partida. Ao publicar, pontuação automática e ranking de palpiteiros.

**Por que é interessante**: dá o que fazer no app entre a confirmação de quarta e o jogo de quinta — engajamento no dia mais morto da semana. E o "vidente do racha" vira mais uma taça de resenha.

**Esboço técnico**:

- Migration: tabela `palpites (id bigserial, partida_id, jogador_id, gols_a smallint, gols_b smallint, craque_jogador_id, created_at, UNIQUE(partida_id, jogador_id))`; só aceita palpite com `status = 'draft'` (RPC `registrar_palpite` com gate).
- Pontuação sugerida: placar exato 3 pts · acerto do vencedor/empate 1 pt · craque certo 2 pts. RPC `apurar_palpites(p_partida_id)` chamada no `finalizar_partida` (transacional, tudo no banco).
- Tela própria em fluxo focado (`/partida/:id/palpite`, TabBar oculta) + ranking `palpiteiros` como nova métrica.

---

### 13. Comprovantes de pagamento (Supabase Storage) — `M`

**O que é**: anexar comprovante (print do PIX) ao quitar uma dívida — hoje a quitação é só uma flag `paga` marcada pelo admin, sem prova.

**Por que é interessante**: acaba o "poxa, juro que paguei semana passada" — o extrato vira rastro auditável (e o usuário é conhecido por preferir models rastreáveis com drill-down, não saldo opaco). Também permite o jogador marcar "paguei" anexando comprovante, com o admin só validando.

**Esboço técnico**:

- Criar bucket no Supabase Storage (`comprovantes`, privado) + coluna `comprovante_url` em `dividas`; migration 087+ registra a coluna (o bucket é infra, não migration).
- Upload no `quitar_divida` (admin) e nova RPC `solicitar_baixa(p_divida_id, p_url)` para o jogador (deixa a dívida em estado "aguardando validação" — nova coluna ou valor em `paga` tri-estado).
- Combina com a ideia 1: o extrato do jogador mostra o comprovante de cada pagamento quitado.

---

### 14. Reservas e substituições no dia do jogo — `G`

**O que é**: formalizar a fila de espera que hoje é informal: pendentes além dos 14 confirmados viram fila ordenada; desistência após o prazo dispara push "abriu vaga" para o próximo; durante o jogo, registrar substituição (sai/entra) na súmula.

**Por que é interessante**: é a dor real da quinta-feira — alguém desiste às 17h e o admin sai catando gente no grupo. Fila automática com push resolve; substituição registrada dá estatística honesta para quem entrou no 2º tempo (e evita o "joguei 10 minutos e levei nota 3").

**Esboço técnico**:

- Migration: coluna `posicao_fila` (ou ordenação por `confirmado_em`) em `partidas_participantes`; novo tipo `'substituicao'` em `partida_eventos` (`jogador_id` = entra, coluna nova `substitui_jogador_id` = sai).
- Push "vaga aberta" reaproveita a Edge Function de confirmação com novo modo.
- `abrir_partida`/`finalizar_partida` e o `EscalacaoTimesEditor` precisam lidar com time incompleto + reservas (maior complexidade de regra — por isso esforço G).
- Nota de alerta: mexe no coração das regras de capacidade (AGENTS.md §8.2) — exige decisão de negócio antes (reserva joga e é avulso? vota? recebe nota?).

---

### 15. Conquistas e selos — `M`

**O que é**: vitrine no Perfil com selos calculados a partir dos dados: Hat-trick, Assistência-triplo, Craque da Rodada, Ferro Velho (mais gols contra), Presença de Ferro (10 jogos seguidos), Vingador (venceu o ex-parceiro), Milésimo Gol do Racha...

**Por que é interessante**: gamificação barata e com o tom de resenha do grupo; cada selo é motivo de print no WhatsApp. Tudo é derivável de dados que já existem (eventos, votos, participantes).

**Esboço técnico**:

- RPC STABLE `conquistas_jogador(p_jogador_id)` retornando selos com data de conquista — cálculo no servidor (nada de varrer eventos no client).
- Frontend: carrossel de selos no `Perfil.tsx` com ícones Lucide e tooltip da condição; selos "da temporada" reiniciam com o ano.
- Começar com 6–8 selos objetivos e sem exceção subjetiva (regra clara, sem julgamento).

---

## Priorização sugerida

**Quick wins primeiro** (valor alto, esforço pequeno, zero mudança de regra):

1. **#1 Minhas Dívidas** — dados prontos, só frontend.
2. **#9 Card compartilhável** — frontend puro, alto alcance no grupo.
3. **#8 Evolução de notas** — uma RPC + sparkline.
4. **#10 Realtime** e **#11 Espectador** — melhoram a experiência do jogo ao vivo imediatamente.

**Segunda onda** (mudanças de média envergadura no banco): 5. **#2 Cronômetro**, **#3 Cartões**, **#4 Stats de goleiro** — todas ampliam o mesmo núcleo (`partida_eventos`/`partidas_participantes`); podem sair juntas numa "temporada de súmula". 6. **#6 Notificação de resultado** + **#7 Push granular** — mesmo ecossistema push. 7. **#5 Temporadas no Ranking** — reaquece a disputa anual com dados que já existem.

**Grandes** (exigem decisão de negócio antes de codar): 8. **#12 Bolão**, **#15 Conquistas**, **#13 Comprovantes**, **#14 Reservas/substituições**.

> **Observação**: já existe plano escrito (não implementado) para o "Histórico de Confronto entre Elencos Exatos" em `docs/plano-historico-contronto-semana.md` — não duplicado nesta lista, mas é forte candidato a entrar na segunda onda.

---

## Regras a lembrar ao implementar qualquer ideia daqui

- Migrations sequenciais de 3 dígitos, próximas a partir da **087** (`supabase/migrations/`); sincronizar `aplicar_tudo.sql`.
- **Zero UUID** — apenas `bigserial`/`bigint`.
- RPCs: português infinitivo, parâmetros `p_`, `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE ... TO anon, authenticated`.
- Agregação no PostgreSQL, nunca no client (views/RPCs STABLE).
- Operações compostas em RPC transacional única (padrão `salvar_edicao_partida`).
- Frontend: seguir `design-system.md` (listas contínuas, tokens semânticos, cantos 4px, `shadow-carimbo`, tríade tipográfica), hooks no topo, flag `ativo` em `useEffect` assíncrono (ou `useCache`), `min-h-[44px]`, `voltar(navigate, fallback)`, zero `window.confirm/alert`.
- Notificações: manter o padrão de idempotência via `push_reminder_deliveries` e templates editáveis em `notificacoes_config`.
