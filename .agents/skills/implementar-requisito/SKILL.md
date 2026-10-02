---
name: implementar-requisito
description: Orquestra a implementação de requisitos complexos do repo racha dividindo o plano em etapas sequenciais, cada uma concluída no ciclo de 3 agentes (implementa → valida gerando registro → corrige achados). Use sempre que o usuário pedir para implementar um requisito/plano com várias etapas ou fases (ex. "implementar o requisito X", "executar o plano NN", "implementar a etapa/fase N do plano 35"), ou quando um pedido de implementação for avaliado como complexo — múltiplas áreas (banco/backend/frontend), integração externa, risco relevante ou mais que poucos passos. Requisito simples (1-2 passos, uma área, baixo risco) NÃO passa por aqui — implemente direto.
---

# Implementar Requisito — Orquestrador de Etapas

Você é o orquestrador. Não implementa código diretamente: dispara subagentes (ferramenta Agent) e decide com base no que eles reportam. Um requisito é **complexo** — e portanto usa este fluxo — quando envolve múltiplas etapas/áreas, integração externa, migrações ou risco relevante de regressão. Na dúvida entre orquestrar e implementar direto, prefira implementar direto: a orquestração existe para controle de risco, não para cerimônia.

## Visão do fluxo

1. **Preparar**: requisito → plano dividido em etapas sequenciais (doc versionado).
2. **Por etapa, sempre nesta ordem**: executor → auditor (veredito/relatório) → corretor (somente se houver achados).
3. **Fechar a etapa**: registro em `registros/`, índice atualizado, plano corrigido na fonte.
4. Só então a próxima etapa solicitada começa. **Etapas jamais em paralelo.**

## 1. Preparar o plano

- Plano ainda não existe: escreva `docs/planos-implementacao/<NN>-<slug>.md` seguindo `docs/planos-implementacao/TEMPLATE.md` (objetivo; estado atual com evidências `arquivo:linha` conferidas no código; pré-condições; execução com 1 passo = 1 commit; validação manual; fora de escopo; rollback por `git revert` isolado). Numeração = próximo NN livre no diretório.
- Requisito grande: divida em etapas numeradas, cada uma com escopo, arquivos e critérios de conclusão próprios. Quando uma etapa precisar de tasks detalhadas, crie `<NN>-fases/etapa-N-tasks.md` no padrão do plano 35 (`35-fases/fase-N-tasks.md`).
- Antes de disparar qualquer etapa, leia o índice `docs/planos-implementacao/README.md` e os registros existentes: etapa já marcada `✅ executado` não se re-executa; retome da primeira etapa pendente.
- Se o plano já foi aprovado pelo dono, execute sem perguntar a cada etapa. Se você acabou de redigir o plano e o escopo não estava fechado, apresente as etapas e a ordem ao dono antes da primeira execução.

## 2. Ciclo da etapa (3 agentes, em sequência)

Antes de disparar o executor, anote o BASE: `git rev-parse --short HEAD`.

### 2.1 Executor

Dispare 1 subagente com prompt contendo:

- Caminho do plano e do doc de tasks da etapa (se houver) + aviso de que o `AGENTS.md` da raiz é obrigatório.
- Regras: 1 passo do plano = 1 commit; `npm run build` (e lint, quando existir) a cada passo; nada fora do escopo da etapa; **nunca push**; pendência de infra externa (secrets, dashboard, workflow, aparelho) vai para a lista de pendências — não buscar credenciais nem contornar; reportar divergências plano × código real encontradas no caminho.
- Bloqueio real (dependência ausente, API faltando): abortar a etapa relatando o bloqueio. O orquestrador resolve o desbloqueio e re-dispara **a mesma etapa** — nunca pula para a próxima.
- Erro de cota ao disparar o subagente: re-disparar a mesma chamada (funciona na prática).

### 2.2 Auditor (read-only)

1. Gere o review package num arquivo único — o auditor lê um arquivo, não roda git: `git log --oneline BASE..HEAD` + `git diff BASE..HEAD` (excluir lockfiles volumosos, ex. `-- . ':(exclude)scripts/clipes/package-lock.json'`) em `.superpowers/sdd/<slug-do-plano>/etapa-N-review-package.md`.
2. Dispare subagente **read-only** com o review package + plano + `AGENTS.md`. Ele valida: fidelidade ao plano, conformidade com o `AGENTS.md`, superfície do diff (nada fora de escopo), critérios de conclusão da etapa; pode reexecutar build/lint. Saída: veredito **aprovado / aprovado com ressalvas / reprovado** + achados classificados (Critical / Important / Minor) e divergência de push (`origin/main..main`) anotada como observação, não como achado de código.

### 2.3 Corretor (condicional)

- Há achados **Critical/Important** → dispare o 3º subagente com a lista de achados; correção em **commit próprio** (nunca amend).
- Achados **Minor** podem ser deferidos com decisão registrada — mas se forem triviais (1-2 linhas), acione o corretor mesmo assim (precedente do dono: "se tiver algum, dispare um 3º agente").
- Veredito "aprovado sem achados" dispensa o corretor.
- Imprecisão no próprio doc do plano (linha deslocada, critério de encerramento falso) é corrigida **na fonte**, no mesmo commit do registro.

## 3. Fechar a etapa

1. Materialize o registro em `docs/planos-implementacao/registros/<NN>-etapa-N-<slug>.md` (plano de etapa única: `<NN>-<slug>.md`), no formato dos registros existentes: cabeçalho com veredito; **Execução** (commits e validações); **Divergências plano × real / decisões** (incluindo Minor deferidos); **Observações operacionais**; **Pendente de validação humana (dono)**.
2. Atualize o índice (`docs/planos-implementacao/README.md` ou checklist de fases do próprio plano): `✅ executado` + link para o registro.
3. Commit próprio: `docs: registro de execução/validação da etapa N do plano NN`.
4. Reporte ao dono: veredito, commits gerados, achados e deferimentos, pendências.

Registro e marcação no índice são **parte da execução** — o dono não precisa pedir a cada vez. Só depois de fechar a etapa assim a próxima etapa solicitada pode começar.

## Regras invariantes

- Etapas em sequência, uma por vez; nunca em paralelo; nunca pular etapa bloqueada.
- Nenhum agente faz push — o dono empurra.
- Gate local: build/lint com exit 0. Validação visual/no aparelho fica sempre pendente para o dono e nunca é simulada.
- Mantenha o padrão do diretório: docs em português, `TEMPLATE.md` para planos, formato dos registros existentes para registros.
