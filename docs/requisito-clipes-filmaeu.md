# Requisito · Clipes do Filma Eu no app

> **Status**: requisito fechado com o dono (02/10/2026) · Esforço estimado: **G** · Risco: **médio**
> **Plano de implementação**: esqueleto em `docs/planos-implementacao/35-clipes-filmaeu.md`
> Idioma: português.

## 1. Contexto e problema

O site [filmaeu.com.br](https://filmaeu.com.br/) publica clipes de ~30s das partidas do racha (gravados pela câmera da quadra **Society Gragoatá**). Hoje, para assistir, é preciso entrar no site (ou app do Filma Eu), buscar a quadra, selecionar o dia da partida, escolher o horário (19:00) e assistir os clipes lá — fora do nosso app.

O requisito é: **baixar automaticamente os clipes de cada partida do racha e disponibilizá-los dentro do app do racha**, dentro do detalhe da partida e com um link na página inicial.

### Reconhecimento técnico do Filma Eu (feito em 02/10/2026)

- A área de vídeos **exige login** (a busca quadra → data → horário fica atrás de `/login`).
- Site server-rendered clássico (jQuery/Bootstrap), **sem API pública detectável**; mídia hospedada em bucket S3 (`filmaeustorage`).
- Download é feature oficial do produto (site e app), mas a automação exige **automação de browser com uma sessão autenticada** (Playwright) — não há caminho de API direta conhecido.
- Consequência: uma Edge Function do Supabase **não** consegue rodar o browser headless. A automação vive fora do Supabase.

## 2. Decisões fechadas com o dono

| #  | Decisão                                        | Escolhido                                                                                                                                  |
| -- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 | Onde a automação roda                          | **GitHub Action agendada** com browser headless (Playwright)                                                                               |
| D2 | Gatilho                                        | **Automático semanal** (após cada partida) **+ manual pelo app** (botão admin, com opção de importar um dia específico)                    |
| D3 | Quais clipes baixar                            | **Todos os clipes do horário da partida** (slot 19:00 da Society Gragoatá na data da partida)                                              |
| D4 | Onde guardar + retenção                        | **Bucket `clipes` no Supabase Storage**, organizado por partida, com **limpeza automática por tamanho** (ordem de deleção pela **data da partida**, não da data de upload) — ver RF09 |
| D5 | Onde aparecem no app                           | **Bloco dentro do detalhe da partida** + **link na home (Resumo), acima dos cards de destaque dos jogadores**, quando a última partida tem clipes |
| D6 | Quem vê / quem gere                            | **Todos os jogadores logados veem**; **admin gere** (disparar/reexecutar importações)                                                       |
| D7 | Credenciais do Filma Eu                        | **1 conta (do dono) em segredo no Supabase Vault**, lida pela Action; quadra fixa Society Gragoatá                                          |
| D8 | Notificação                                    | **Push quando os clipes ficarem prontos**; **avisar admins** quando a importação falhar ou não achar clipes                                |
| D9 | Histórico                                      | **Só a partir de agora** (sem backfill automático); histórico antigo entra via **gestão admin por dia específico**                          |

## 3. Visão geral da solução

```
┌──────────────────────────── GitHub Action (agendada) ────────────────────────────┐
│  cron semanal (sexta)  +  workflow_dispatch (manual, com inputs data/horário)     │
│  1. Busca no Supabase a partida alvo (data_jogo, quadra Society Gragoatá, 19h)    │
│  2. Lê credenciais Filma Eu do Supabase Vault (service key)                       │
│  3. Playwright: login → quadra → data → slot 19:00 → baixa todos os clipes        │
│  4. Upload no Storage bucket `clipes/{partida_id}/`                                │
│  5. Registra importação + insere linhas na tabela `clipes` (idempotente)           │
│  6. Push "clipes prontos" OU aviso de falha para admins                            │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ Supabase (Storage + Postgres) │
                    └───────────────┬───────────────┘
                                    │
┌────────────────────────── App (PWA React) ───────────────────────────────────────┐
│  Resumo.tsx: link "Clipes da última partida" acima dos cards de destaque          │
│  PartidaDetalhe.tsx: grade de clipes com player <video> nativo                    │
│  Administrador.tsx: gestão de importação (disparar por dia específico)            │
│  lib/clipes.ts: nova camada de serviço (padrão das demais libs)                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

O gatilho manual do app segue: **botão admin → Edge Function `disparar-importacao-clipes` → GitHub API (`workflow_dispatch`) → Action roda**. O token do GitHub (PAT com permissão de disparar o workflow) fica no Supabase Vault, no mesmo padrão dos outros segredos.

## 4. Requisitos funcionais

- **RF01** — Toda sexta-feira (horário a definir no plano, sugerido manhã BRT), a Action importa automaticamente os clipes da partida da semana anterior (quinta 19h, Society Gragoatá).
- **RF02** — Deve baixar **todos os clipes** presentes no slot de horário da partida; clipes duplicados (mesma partida já importada) não devem ser rebaixados nem duplicados (idempotência por partida + arquivo).
- **RF03** — Admin pode disparar importação manual **por um dia específico** (para recuperar atraso ou importar histórico pontual), a partir do painel admin.
- **RF04** — Jogador logado vê, no **detalhe da partida**, a grade de clipes daquela partida, com player de vídeo nativo do browser e opção de baixar/compartilhar o clipe.
- **RF05** — Na **home (Resumo)**, quando a partida mais recente publicada tiver clipes, aparece um **link acima dos cards de destaque dos jogadores** levando ao detalhe da partida (ou à grade de clipes).
- **RF06** — Ao concluir uma importação com sucesso, os participantes recebem **push** "clipes da partida de {data} disponíveis" (reusar a infraestrutura de push existente).
- **RF07** — Quando a importação **falha** ou **não encontra clipes**, os **admins** são avisados (push e/ou registro visível no painel admin), para poderem reexecutar manualmente.
- **RF08** — Cada importação (automática ou manual) fica registrada com origem, status e detalhe do resultado, consultável pelos admins.
- **RF09** — **Limpeza por retenção**: após cada importação bem-sucedida, se o total armazenado no bucket `clipes` ultrapassar um limite configurável (default: **800 MB**, folga sob o teto free de 1 GB), a Action deleta **partidas inteiras mais antigas primeiro**, ordenadas por `data_jogo` — a data do jogo, **não** a data em que o clipe foi salvo no Storage (ex.: clipes de uma partida de 02/02 importados hoje são deletados antes dos de 02/09 importados ontem). A limpeza é por partida (prefixo `clipes/{partida_id}/` + linhas na tabela `clipes`) e fica registrada no ledger de importações; nunca deleta a partida recém-importada.

## 5. Requisitos não funcionais e restrições

- **RNF01** — Seguir `AGENTS.md`: sem novas libs no frontend do PWA (player é `<video>` nativo); Playwright fica isolado no diretório da Action.
- **RNF02** — Credenciais (Filma Eu e PAT do GitHub) só no Supabase Vault; nunca no repositório, no client ou em logs.
- **RNF03** — Leitura dos clipes: bucket público de leitura **ou** URLs assinadas geradas na camada de serviço — a recomendação é **bucket público de leitura** (conteúdo é do próprio racha e o app não usa Supabase Auth, então RLS por usuário não se aplica); escrita **somente** via service key (Action). Decisão final no plano.
- **RNF04** — A automação é **frágil por natureza** (depende do HTML do Filma Eu): seletores resilientes, execução logada e aviso de falha ao admin são requisitos, não extras.
- **RNF05** — Uso pessoal dos próprios clipes do racha (download é feature oficial do Filma Eu); sem redistribuição externa pelo app.
- **RNF06** — Sem testes automáticos novos (AGENTS.md); validação manual conforme plano.

## 6. Componentes novos (inventário)

| Componente                                   | Tipo            | Notas                                                              |
| -------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| `.github/workflows/` + script Playwright      | GitHub Action   | Cron semanal + `workflow_dispatch` com inputs (data, horário, partida); ao final, executa a limpeza por retenção (RF09) |
| Tabela `clipes`                              | Migration       | `partida_id`, caminho no Storage, horário/ordem, `UNIQUE(partida_id, caminho)` |
| Tabela `clipes_importacoes`                  | Migration       | Ledger de execuções (origem, status, detalhe) — padrão `cron_execucoes` |
| Bucket `clipes`                              | Storage         | Escrita só via service key; leitura pública ou assinada (RNF03)     |
| Segredos no Vault                            | Migration/manual| Credenciais Filma Eu + PAT do GitHub                                |
| Edge Function `disparar-importacao-clipes`   | Edge Function   | Chama GitHub API `workflow_dispatch`; valida admin                  |
| `src/lib/clipes.ts`                          | Frontend        | Camada de serviço nova, padrão das libs existentes                  |
| Bloco de clipes no `PartidaDetalhe`          | Frontend        | Grade de vídeos, `<video>` nativo                                   |
| Link no `Resumo`                             | Frontend        | Acima dos cards de destaque, condicional à existência de clipes     |
| Gestão de importação no `Administrador`      | Frontend        | Disparar por dia específico + ver status das importações            |
| Push "clipes prontos" / aviso de falha       | Backend         | Reusar padrão push/`notificacoes_config` existente                  |

## 7. Riscos e mitigação

| Risco                                                        | Mitigação                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| Filma Eu muda o layout/DOM e quebra a automação              | Log de execução + aviso ao admin (RF07) + correção pontual no script |
| Credenciais vazaram                                          | Vault-only (RNF02), sem echo em logs, PAT com escopo mínimo      |
| Custo de Storage estourar o free tier (1 GB)                 | Limpeza automática por tamanho com deleção pela data da partida mais antiga primeiro (RF09), limite configurável (default 800 MB) |
| Site fora / clipes ainda não publicados na hora do cron      | Reexecução manual (RF03); horário do cron ajustável              |
| GitHub Action sem rede de saída para o S3/filmaeu            | Runners padrão têm saída livre; sem restrição conhecida          |
| Limpeza deletar partida que o pessoal ainda quer rever        | Sempre resta folga (default 800 MB); limpeza registrada no ledger e auditável no painel admin |

## 8. Fora de escopo

- Backfill automático do histórico completo de partidas anteriores.
- Múltiplas contas do Filma Eu ou múltiplas quadras.
- Edição/trimming de clipes dentro do app.
- Streaming adaptativo (HLS) ou transcodificação.
- Compartilhamento público fora do app (links abertos para não-logados).
