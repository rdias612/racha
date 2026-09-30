# 05 — UX Funcional e Produto (mobile-first, PWA)

> Subagente: análise de UX funcional do app "Racha Gragoatá CBO" (PWA Android, uso 100% no celular).
> Data: 2026-09-29 · Método: percurso dos fluxos lendo o código (evidências `caminho:linha`) + alinhamento com `docs/ideias-novas-funcionalidades.md`.
> Escopo: UX FUNCIONAL — o que o usuário consegue fazer, em quantos passos, com que feedback. Não é análise visual (ver `03-design-system.md`) nem técnica (ver `02-pwa-tecnico.md`).

---

## 1. Resumo executivo (top 5)

1. **A tarefa nº 1 da semana (confirmar presença) exige 3 toques + scroll.** A home mostra o card "PRÓXIMA QUINTA" que leva ao detalhe, onde o botão "Vou jogar" vive no fim da lista de confirmações. Não existe confirmação em 1 toque na home — e é a ação que todo jogador faz toda semana.
2. **A cédula de votação dá um sinal falso de progresso.** As notas já vêm pré-preenchidas com 6 (`PartidaVotar.tsx:174-179`), então a barra "x/y avaliados" nasce em 100% e o estado "Avalie todos (n restantes)" nunca aparece. O jogador não entende o que falta fazer — ou pior, acha que precisa tocar em tudo.
3. **Falha de rede trava a tela sem saída.** `MensagemEstado` não tem botão de retry; Detalhe/Ao Vivo/Votar carregam sempre da rede e, sem sinal no campo, o usuário fica preso numa mensagem morta. E essas 3 telas são justamente as únicas sem pull-to-refresh.
4. **Feedback de sucesso inconsistente no mesmo fluxo.** Confirmar presença vibra + atualiza otimista (`ConfirmacoesPartida.tsx:184-203`); enviar votos não vibra e usa `MensagemEstado`; finalizar partida não vibra; excluir partida usa `Snackbar`. Três padrões diferentes para a mesma etapa emocional ("deu certo").
5. **A navegação e a ergonomia de base são boas — o ganho está em "menos passos", não em "mais telas".** TabBar de 5 abas coerente, fluxo focado com `BotaoVoltar` + `BarraAcaoInferior`, alvos de 44px globais, skeletons por rota. As propostas abaixo são incrementos pequenos sobre essa base, não redesenho.

---

## 2. Estado atual dos fluxos (com evidências)

### 2.1 Abrir o app → Resumo (os 10 segundos)

- O que a home mostra, em ordem: cabeçalho editorial → `BotaoInstalar` → `CardNotificacoes` → card da próxima partida → grid de 6 destaques → rodapé (`src/routes/Resumo.tsx:119-168`).
- O card da próxima partida diz "Toque para confirmar presença ou consultar a súmula" (`Resumo.tsx:217-219`), mas levar a `/partida/:id` — a confirmação real está no componente `ConfirmacoesPartida`, dentro da lista de participantes, depois de rolar (`src/components/ConfirmacoesPartida.tsx:36-75`). **Caminho real: Home → Detalhe → scroll até Confirmações → "Vou jogar" = 3 toques + scroll.**
- Ponto forte: o `BannerLembrete` global já cobre a votação aberta em todas as telas, com link direto para `/partida/:id/votar` (`src/components/BannerLembrete.tsx:103-114`). Esse padrão "ação da semana flutuante" funciona e pode ser estendido.
- Cache-first com revalidação (`useCache`) faz a home abrir instantânea em revisitas (`Resumo.tsx:58`). Excelente para PWA.

### 2.2 Fluxo da partida (nova → times → ao vivo → votar → detalhe)

**PartidaNova (admin)** — `src/routes/PartidaNova.tsx`
- Seleção dos 14 de linha com busca, cota visual e persistência em localStorage (`PartidaNova.tsx:87-94`) — retomar rascunho funciona. CTA fixo na `BarraAcaoInferior` desabilitado até 14/14 (`:263-279`): bom.
- Falha: erro de criação aparece no **topo** da página (`:197`) enquanto o dedo está no **rodapé** — no celular o usuário não vê o erro.

**PartidaTimes (admin)** — `src/routes/PartidaTimes.tsx`
- Auto-escalar com haptics de aviso (`src/hooks/useEscalacaoTimes.ts:74-102`), salvar → feedback → navegação automática em 600ms (`PartidaTimes.tsx:212-219`). Fluxo maduro.
- Aviso de confirmados faltantes claro antes de permitir escalação (`:239-247`).

**PartidaDetalhe** — `src/routes/PartidaDetalhe.tsx`
- Ações por status bem separadas (Escalar Times / Iniciar Ao Vivo em draft `:224-241`; Acompanhar/Registrar em live `:243-252`; Editar em published/closed `:254-263`; votar em `:265-297`).
- Carregamento sempre via rede com skeleton (`:53-98`, sem cache-first): revisitar o detalhe sempre pisca skeleton — custo aceitável, mas sem pull-to-refresh e sem retry, offline = beco.
- `ConfirmDialog` para descartar votos com tom perigo (`:299-307`): correto.

**PartidaAoVivo** — `src/routes/PartidaAoVivo.tsx`
- Melhor ergonomia do app: tocar jogador no campo → `DialogoEvento`; eventos com Editar/Desfazer de 44px (`:316-365`); polling de 10s cobre espectador e admin (`:90-96`); erros em `Snackbar` (`:47`, `:414`).
- Finalizar com `ConfirmDialog` mostrando o placar que será gravado (`:426-433`): excelente prevenção de erro. Mas **não há `vibrateSuccess`** ao finalizar nem ao registrar gol com sucesso.

**PartidaVotar** — `src/routes/PartidaVotar.tsx`
- **Bug de sinal**: notas pré-preenchidas com 6 (`:174-179`) fazem `avaliadosCount === alvos.length` logo no mount, então a barra "Progresso da cédula" nasce 100% (`:222-223`, `:302-318`) e o rótulo alternativo do botão, "Avalie todos (n restantes)" (`:378-380`), é código morto.
- Proteções exemplares: guard de `beforeunload` (`:64-73`), rascunho em localStorage (`:207-220`), `ConfirmDialog` ao sair com modificações (`:384-395`).
- Custo de interação: cada nota é um dropdown de 1-10 (`SeletorNota.tsx`, listbox acessível). Para ~12 atletas são ~36 toques no pior caso. O default 6 mitiga — mas o app não *comunica* esse atalho.

### 2.3 Ranking / Jogos / Estatísticas (consumo)

- **Ranking** (`src/routes/Ranking.tsx`): swipe de abas com haptics (`src/hooks/useSwipeTabs.ts:148`), filtros com chips removíveis e contador (`:302-363`), destaque do próprio jogador na tabela (`:471-480`), sort por coluna com alvos de 44px. Lacuna: com 30+ atletas, achar a própria posição exige rolar uma tabela com scroll horizontal (`:429-431`) — não há "você está em 8º" nem jump-to-me.
- **Jogos** (`src/routes/Jogos.tsx`): mural com LED compacto, link contextual (live → ao-vivo, resto → detalhe, `:176-179`), exclusão admin com `ConfirmDialog` + `Snackbar` (`:78-98`). Lacuna: lista única cresce sem filtro de status/temporada; com ~50 partidas/ano a rolagem fica longa.
- **Estatísticas/EstatisticasRacha** (`src/routes/Estatisticas.tsx:157-208`): `PullToRefresh` + abas com swipe + `StatBox`. Estado sólido, sem lacuna funcional relevante.

### 2.4 Perfil e financeiro

- **Perfil** (`src/routes/Perfil.tsx`): cartão de identidade + 5 `StatBox` (`:177-193`), formulários de username (`:195-226`) e senha (`:232-274`) com haptics de erro/sucesso (`:80`, `:96`, `:131`, `:139`). Lacunas: (a) os formulários de acesso dominam a tela antes das estatísticas; (b) **zero visão financeira para o jogador comum** — exatamente o gap nº 1 do roadmap ("Minhas Dívidas", `docs/ideias-novas-funcionalidades.md:31-41`); (c) sem pull-to-refresh.
- **Financeiro admin** (`src/routes/Administrador.tsx`): completo, com `PullToRefresh`. Fora do escopo do jogador.

### 2.5 Navegação

- TabBar: Resumo · Jogos · Ranking · Estatísticas · Perfil (`src/routes/Layout.tsx:261-334`), com prefixo mantendo a aba acesa e prefetch por toque (`:63-77`). **Faz sentido; nada recorrente está a mais de 1 aba.** Não propomos mudar abas.
- Fluxo focado sem TabBar coberto por regex (`Layout.tsx:106`) e sempre com `BotaoVoltar` + fallback (`PartidaDetalhe.tsx:168`, `PartidaNova.tsx:186`, `PartidaAoVivo.tsx:241`, `PartidaVotar.tsx:284`). Claro para voltar.
- Admin vive num dropdown no header (`Layout.tsx:155-234`) — uso esporádico, posição aceitável.
- Haptics **ausente** no toque de aba (Layout) e nos CTAs de partida (Iniciar, Finalizar, Enviar votos) — o `vibrateLight`/`vibrateSuccess` existe e é barato (`src/lib/haptics.ts`).

### 2.6 Estados: loading, vazio, erro, offline

- **Loading**: skeletons espelhados por rota no boundary do Outlet (`Layout.tsx:44-61`) — CLS 0. Rotas focadas caem no `CarregandoGeral` genérico (aceitável).
- **Vazio**: tom de voz consistente em Resumo (`Resumo.tsx:143-151`), Jogos (`Jogos.tsx:130-138`), Ranking (`Ranking.tsx:366-384`), grupos da PartidaNova (`PartidaNova.tsx:327-330`), eventos ao vivo (`PartidaAoVivo.tsx:311-314`). Bem resolvido.
- **Erro**: `MensagemEstado` é informativa mas **sem ação de retry** (`src/components/Estado.tsx:68-89`). Nas telas cache-first o erro só aparece sem cache (padrão correto, `Jogos.tsx:100-104`); nas telas de partida (rede sempre) o erro bloqueia tudo.
- **Offline**: banner global vermelho (`Layout.tsx:118-127`) + cache stale. Ressalva: o texto "exibindo dados locais salvos" não é verdade em Detalhe/Ao Vivo/Votar, que não usam cache — offline nelas é erro, não dados locais.

### 2.7 Feedback e ergonomia

- Haptics bem aplicado em 21 arquivos (confirmações, sortear times, swipe, listbox, tema, push, formulários do Perfil). Faltando: TabBar, CTAs de partida, envio de votos/finalização.
- `Snackbar` em 8 rotas; Detalhe e Votar usam `MensagemEstado` inline — dois padrões de "resultado de operação" no mesmo fluxo.
- Confirmações destrutivas: 100% cobertas (excluir partida `Jogos.tsx:194-204`, descartar votos `PartidaDetalhe.tsx:299-307`, desfazer evento `PartidaAoVivo.tsx:416-424`, finalizar `:426-433`, sair da cédula `PartidaVotar.tsx:384-395`).
- Pull-to-refresh: 7 telas (`Resumo, Jogos, Ranking, Estatisticas, EstatisticasRacha, Comparador, Administrador`); **faltam as 3 telas de partida e Perfil**.

---

## 3. Propostas priorizadas (P0 → P3)

> Critério: impacto real no uso semanal ÷ esforço. Todas respeitam a arquitetura atual (sem nova lib, sem nova camada) e a filosofia do AGENTS.md (KISS/YAGNI).

### P0-1 · Painel da Semana: confirmar presença em 1 toque na home

- **Problema**: a tarefa que todo jogador faz toda semana (confirmar) exige 3 toques + scroll (evidência `Resumo.tsx:194-222` → `ConfirmacoesPartida.tsx:36-75`).
- **Proposta**: o card "PRÓXIMA QUINTA" vira um *Painel da Semana* contextual: mostra o estado do próprio jogador (confirmado/pendente/recusado/não convocado), as vagas `x/14` e um botão inline **"Vou jogar"** que chama `confirmarPresenca` direto da home (haptics `vibrateSuccess` + atualização otimista já implementadas em `ConfirmacoesPartida.tsx:181-211`, é reuso). Quando a votação está aberta, o painel assume o CTA "Votar no Craque" (complementando o `BannerLembrete`, sem duplicar).
- **Benefício**: tarefa semanal nº 1 cai para 1 toque na tela inicial; tende a subir a adesão de confirmação (o insumo de todo o resto do ciclo).
- **Esforço**: **S/M** (1 card novo + estados; guards de vaga/prazo já existem em `podeConfirmar`).
- **Risco**: baixo. Cuidado com lotação e prazo (usar os mesmos guards da lista) e evitar estado mentiroso se o cache estiver velho (revalidar na confirmação).

### P0-2 · Cédula de votação: sinal honesto + ajuste rápido

- **Problema**: barra de progresso nasce em 100% e o estado "Avalie todos (n restantes)" é código morto (`PartidaVotar.tsx:174-179, 222-223, 378-380`); achar esse atalho é impossível para o usuário.
- **Proposta mínima** (sem mexer no `SeletorNota` acessível): (1) rastrear notas realmente *tocadas* e exibir "Você ajustou 3 de 12 — as demais ficam com 6" (a barra passa a medir engajamento, não existência); (2) botão principal continua habilitado e seu rótulo comunica a economia ("Enviar votos — 3 ajustes"); (3) `vibrateSuccess` ao enviar (`:260-261`).
- **Benefício**: o jogador entende em 2 segundos que pode votar ajustando só quem se destacou — a votação deixa de parecer tarefa longa.
- **Esforço**: **S** (estado derivado + rótulos; sem novo componente).
- **Risco**: baixo. Opcional (M): botões −/+ ao lado do gatilho do `SeletorNota` compacto para ajustar sem abrir dropdown.

### P1-3 · Recuperação de erro e consistência de feedback nas telas de partida

- **Problema**: sem sinal no campo, Detalhe/Ao Vivo/Votar ficam presos numa mensagem sem ação (`Estado.tsx:68-89`); `PartidaNova` mostra o erro longe do dedo (`PartidaNova.tsx:197`); sucesso alterna entre `Snackbar` e `MensagemEstado` no mesmo fluxo.
- **Proposta**: (1) prop opcional `acao` (botão "Tentar novamente") em `MensagemEstado`; (2) envolver `PartidaDetalhe`, `PartidaAoVivo` e `PartidaVotar` no `PullToRefresh` existente; (3) padronizar sucesso do fluxo de partida em `Snackbar` + `vibrateSuccess` (incluindo finalizar partida e enviar votos); (4) mover o erro de `PartidaNova` para junto da `BarraAcaoInferior`.
- **Benefício**: o app sobrevive ao 4G de quadra; feedback emocional consistente na hora que importa.
- **Esforço**: **S/M** (todas as primitivas já existem).
- **Risco**: baixo. Atenção ao polling do AoVivo (pull não deve brigar com o interval de 10s).

### P1-4 · Ranking: "sua posição" com jump

- **Problema**: com 30+ atletas, achar a própria linha exige rolar tabela com scroll horizontal (`Ranking.tsx:429-504`).
- **Proposta**: chip fixo acima da tabela "Você: 8º · 21 pts" que, ao toque, faz `scrollIntoView` na linha destacada (que já existe, `:473-479`).
- **Benefício**: a pergunta "onde estou?" — a mais comum no ranking — vira 0 rolagem.
- **Esforço**: **S**. **Risco**: baixo (respeitar `data-no-swipe` da tabela).

### P2-5 · Perfil reordenado + "Minhas Dívidas" (alinhado ao roadmap, ideia #1)

- **Problema**: formulários de acesso dominam o Perfil; o jogador não vê nada do financeiro (`Perfil.tsx:154-292`).
- **Proposta**: **apoiar a ideia #1 do roadmap** (`ideias-novas-funcionalidades.md:31-41`) — `listarDividasEmAberto` filtrado por `jogador_id` como seção do Perfil, com o total devido em `font-mono` em destaque no topo da seção — e mover username/senha para um bloco "Acesso" abaixo das estatísticas. A contribuição de ótica mobile: o total em dívida é o dado que precisa ser visível sem tocar em nada.
- **Benefício**: reduz ping-pong de cobrança no grupo; Perfil volta a ser "meus números" primeiro.
- **Esforço**: **S** (seguindo o esboço já feito no roadmap). **Risco**: baixo; não duplicar CTA de pagamento nesta fase.

### P2-6 · Jogos: filtro por status

- **Problema**: mural único cresce sem filtro (`Jogos.tsx:50-70`); ao vivo se perde no meio do histórico.
- **Proposta**: chips de status (Ao vivo · Encerradas · Rascunho) no cabeçalho do mural, padrão idêntico aos chips de filtro do Ranking (`Ranking.tsx:327-363`). Temporada fica para o roadmap #2 — não antecipar.
- **Esforço**: **S/M**. **Risco**: baixo.

### P3 · Micro-ajustes (fazer junto com qualquer P0/P1 que tocar a área)

- `vibrateLight` no toque de aba da TabBar (`Layout.tsx:261-334`).
- Skeleton dedicado para os fluxos focados de partida (hoje `CarregandoGeral`, `Layout.tsx:39-43`).
- Ajustar o texto do banner offline quando a tela não usa cache ("sem conexão — tente novamente" vs. "dados locais salvos").

---

## 4. Alinhamento com `docs/ideias-novas-funcionalidades.md`

| Ideia do roadmap | Posição desta análise |
|---|---|
| #1 Minhas Dívidas (P) | **Apoiada** — entra como P2-5 acima, com o detalhe mobile do total sempre visível. Não duplicada: só acrescenta a reordenação do Perfil. |
| #2 Temporadas + Troféus (M) | Sem conflito. Quando existir o seletor de ano, usá-lo como chip com `data-no-swipe` (o doc já prevê); o P2-6 (filtro de status) é independente e antecede a temporada. |
| #3 Push de resultado/craque (M) | **Reforço mútuo**: o push termina no Detalhe da partida — que precisa do P1-3 (retry/pull) para não falhar justamente no pico de tráfego pós-jogo. O P0-1 (painel da semana) é o "lado puxar" do mesmo objetivo. |
| #4 Evolução de notas (P/M) | Sem conflito. A sparkline no Perfil reafirma o P2-5 (stats primeiro, acesso depois). |
| #5 Bolão de palpites (M/G) | A tela `/partida/:id/palpite` em fluxo focado reutiliza `BotaoVoltar` + `BarraAcaoInferior` e vira mais um estado do Painel da Semana (P0-1) — o mesmo slot que hoje alterna confirmar/votar. |
| Realtime/espectador (plano próprio) | Não tratado aqui para não duplicar; o polling de 10s do AoVivo (`PartidaAoVivo.tsx:90-96`) já atende o espectador hoje. |

---

## 5. O que NÃO fazer

- **Não trocar o `SeletorNota` por slider/control customizado.** O listbox é acessível (`useListbox` + haptics) e o default 6 resolve a fricção; o ganho de um control novo não paga o custo de a11y/testes.
- **Não redesenhar a TabBar nem trocar abas.** Não há evidência de dor; mudar navegação quebraria hábito consolidado de ~30 usuários por um ganho especulativo (YAGNI).
- **Não criar "dashboard" com widgets na home.** O boletim editorial é a identidade do produto; o P0-1 é um card, não um painel de administração.
- **Não mover o toggle de tema do header para dentro do Perfil** apenas para "limpar o header" — o custo de descoberta é maior que o ganho de espaço.
- **Não introduzir realtime na tela Ao Vivo fora do plano já existente** (`plano-escolha-times-realtime.md`) — seria duplicar decisão de arquitetura já tomada.
- **Não criar tela nova `/financas` agora** — o roadmap sugere seção do Perfil ou tela; começar pela seção (menos rota, menos cache, mesmo valor).
- **Não adicionar filtros avançados ao Ranking** (posição + mínimo já bastam); temporada é responsabilidade do roadmap #2.
- **Não transformar o fix de progresso da votação (P0-2) em obrigar "tocar em todos"** — o default 6 é uma decisão de produto boa; o problema é só a comunicação.

---

## 6. Visualização no canvas Superdesign

Projeto criado (1 projeto, 3 drafts mobile 390px, tema dark da "Súmula de Quinta"):

- **Canvas do projeto**: https://superdesign.dev/teams/26ebda17-47af-4cfd-ab18-99fcd594ac6a/projects/ea171285-6b2c-422c-8bfc-5b82c4209ffc
- Draft 1 — **Resumo · Painel da Semana** (P0-1): confirmação em 1 toque na home.
  Preview: https://p.superdesign.dev/draft/a95e261a-f89f-404a-845c-fdb2c87ea68e
- Draft 2 — **Cédula de Votação · Sinal Honesto** (P0-2): contador "ajustou x de y" + −/+ rápido.
  Preview: https://p.superdesign.dev/draft/6a14a50a-3612-4cf1-ba61-0ac5cd5ea21a
- Draft 3 — **Partida · Hub com Próxima Ação** (P1-3): trilha de etapas + CTA único + retry em erro.
  Preview: https://p.superdesign.dev/draft/744921f5-5eb9-4066-a527-b3d2a89e1003

> Nenhum código do projeto foi alterado; nenhum commit feito. Geração de imagem/vídeo não utilizada.
