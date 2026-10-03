# Proposta de novos agentes

Análise do projeto (03/10/2026) com propostas de agentes para `.zcode/agents/`.
Formato de referência: mesmo padrão do `anti-slop.md` — um `.md` com frontmatter
(`name`, `description`, `tools`) e o corpo como system prompt.

## Cenário atual

Agentes existentes:

- **Do projeto** (`.zcode/agents/`): `anti-slop`, `code-reviewer`, `react-frontend-engineer`, `technical-writer`
- **Globais** (`~/.zcode/agents/`): `postgres-optimizer`, `postgres-reviewer`

Cobertura por área do projeto:

- **Frontend** (69 componentes, ~20 módulos em `src/lib`, 8 hooks): bem coberta pelo `react-frontend-engineer` + `code-reviewer`
- **Postgres/revisão de SQL**: coberta pelos agentes globais de postgres (apenas revisão/otimização, não implementação)
- **Backend Supabase** (118 migrations, RPCs com regras de negócio, RLS, 5 edge functions Deno, crons): **sem agente dedicado**
- **Fluxo de planos** (planejador → validador → executor): executado com prompts ad-hoc reescritos a cada sessão, sem agente nomeado

## Propostas (em ordem de valor)

### 1. `supabase-backend-engineer` — recomendação: criar

Responde à lacuna real: não existe nenhum agente que **implemente** backend Supabase.
O `postgres-reviewer` só revisa; migrations e RPCs são escritas sem referência de convenções.

Conhecimento que o agente deve carregar (específico deste projeto):

- Migration sempre numerada incremental; nunca reescrever migration já aplicada — fix forward com nova migration
- Produção segue a cadeia de migrations, não `aplicar_tudo` (validar schema real via REST antes de fixar RPCs)
- `verify_jwt` ativo em toda edge function, salvo exceção explícita
- Grants explícitos para `anon`/`authenticated`; RLS por padrão em toda tabela nova
- Ordem de deploy: migration primeiro, frontend depois
- Funções SQL com alias para evitar ambiguidade (`elem`), tratarem ausência de valor explicitamente

Tools sugeridas: `Read, Grep, Glob, Bash, Edit, Write`

### 2. `validador-de-planos` — recomendação: criar

Codifica o validador que já é disparado manualmente em quase todo fluxo de plano.
Ganho: prompt consistente em vez de reescrito a cada sessão.

Regras que o agente deve fixar:

- READ-ONLY: não modifica nenhum arquivo
- Reauditar premissas do plano contra o código em HEAD (planos envelhecem)
- Veredito por item com severidade (bloqueante / importante / sugestão)
- Divergências doc vs código explicitadas

Tools sugeridas: `Read, Grep, Glob, Bash` (sem Edit/Write — reforça o read-only)

### 3. `planejador` — opcional

Codifica o planejador com janela limpa: lê o repositório, gera doc de plano com
commit-base e metas medidas, não implementa, não comita. Vale mais como par do
validador (#2) do que isolado; se os dois forem criados, mantê-los simétricos.

### 4. `executor-de-planos` — opcional

Executor que implementa um plano aprovado **sem commitar** (regra já estabelecida:
commit só sob pedido). Menos valor que os anteriores porque a execução varia muito
de plano para plano; o ganho principal é só fixar a regra de não commitar.

## O que NÃO criar

- **Agente de frontend adicional**: já há cobertura suficiente
- **Agente de segurança separado**: RLS/grants já são cobertos pelo `postgres-reviewer` em revisão
- **Qualquer coisa de testes**: o AGENTS.md decide explicitamente não criar testes automaticamente

## Decisão pendente

Criar os itens 1 e 2 (recomendação). Itens 3 e 4 são conforto, não lacuna.
