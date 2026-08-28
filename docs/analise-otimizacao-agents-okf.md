# 📄 Análise Técnica: Otimização do AGENTS.md e Adoção da Arquitetura OKF (Google)

> **Data da Análise**: 28 de Agosto de 2026  
> **Projeto**: Racha Gragoatá CBO  
> **Autor da Análise**: Antigravity (Google DeepMind)  
> **Status**: Proposta Arquitetural / Estudo de Viabilidade

---

## 📑 Sumário

1. [Objetivo do Usuário](#1-objetivo-do-usuário)
2. [A Ideia Inicial (Arquitetura OKF do Google)](#2-a-ideia-inicial-arquitetura-okf-do-google)
3. [Análise Aprofundada da Ideia Inicial](#3-análise-aprofundada-da-ideia-inicial)
   - [3.1 Diagnóstico do Cenário Atual (O Problema do Monolito)](#31-diagnóstico-do-cenário-atual-o-problema-do-monolito)
   - [3.2 Prós da Aplicação do OKF](#32-prós-da-aplicação-do-okf)
   - [3.3 Contras e Desafios Práticos do OKF](#33-contras-e-desafios-práticos-do-okf)
   - [3.4 Conclusão: Vale a pena implementar?](#34-conclusão-vale-a-pena-implementar)
4. [Outras Alternativas para Alcançar o Objetivo](#4-outras-alternativas-para-alcançar-o-objetivo)
   - [Alternativa 1: Arquitetura Hub-and-Spoke Híbrida (Lean AGENTS.md + OKF Bundles) — Recomendada](#alternativa-1-arquitetura-hub-and-spoke-híbrida-lean-agentsmd--okf-bundles--recomendada)
   - [Alternativa 2: Customização Nativa por Skills sob Demanda (`.agents/skills/`)](#alternativa-2-customização-nativa-por-skills-sob-demanda-agentsskills)
   - [Alternativa 3: Regras Baseadas em Caminho/Contexto (Path-based Rules)](#alternativa-3-regras-baseadas-em-caminhocontexto-path-based-rules)
   - [Alternativa 4: LLM Wiki com Indexação Semântica Leve](#alternativa-4-llm-wiki-com-indexação-semântica-leve)
5. [Matriz Comparativa das Abordagens](#5-matriz-comparativa-das-abordagens)
6. [Plano de Ação e Estrutura Sugerida para o Repositório](#6-plano-de-ação-e-estrutura-sugerida-para-o-repositório)

---

## 1. Objetivo do Usuário

O objetivo principal consiste em:

- **Reduzir o tamanho e a complexidade do arquivo `AGENTS.md`** (atualmente com ~40 KB e 533 linhas);
- **Otimizar o consumo de contexto das LLMs e Agentes de IA**, permitindo que o modelo carregue e processe **apenas as informações estritamente necessárias** para a tarefa em execução (ex: não carregar regras de migrations SQL quando a tarefa for um ajuste de layout React/CSS, e vice-versa);
- **Evitar o truncamento de regras e perda de atenção (_lost-in-the-middle_)**, garantindo que as diretrizes canônicas críticas sejam 100% lidas e respeitadas sem desperdício de tokens.

---

## 2. A Ideia Inicial (Arquitetura OKF do Google)

A proposta inicial é aplicar a especificação **OKF (Open Knowledge Format)**, criada pelo Google Cloud (disponibilizada no repositório `GoogleCloudPlatform/knowledge-catalog`).

### O que é o OKF?

O **OKF** é uma especificação aberta, vendor-neutral e baseada em arquivos para organizar conhecimento corporativo e técnico em formato altamente legível por humanos e navegável por agentes autônomos de IA.

### Características fundamentais do OKF:

1. **Conceito de Knowledge Bundles**: Em vez de um documento monolítico, o conhecimento é decomposto em pequenos arquivos Markdown atômicos e especializados.
2. **YAML Frontmatter Estruturado**: Cada arquivo possui metadados formais no topo para indexação rápida:
   ```yaml
   ---
   type: concept | guide | reference | decision | api | schema
   title: Regras de Negócio do Módulo Financeiro
   description: Diretrizes de cálculo de mensalidade (R$ 90), avulso (R$ 20), isenção e diárias de goleiros (R$ 30).
   tags: [financeiro, dividas, goleiros, mensalistas]
   related: [./regras-goleiros.md, ./banco-supabase.md]
   ---
   ```
3. **Navegabilidade por Grafo (Links Markdown)**: Os documentos são interconectados por links relativos (`[Nome](file:///path/to/file.md)`), permitindo que o agente faça _graph traversal_ (leia um nó e navegue para o próximo nó relacionado conforme a necessidade).
4. **Resolução do Problema de _Context-Assembly_**: O agente não recebe uma "bíblia" inteira de uma vez; ele consulta um catálogo/índice leve e puxa sob demanda apenas os nós relevantes.

---

## 3. Análise Aprofundada da Ideia Inicial

### 3.1 Diagnóstico do Cenário Atual (O Problema do Monolito)

Ao analisar a injeção do `AGENTS.md` no ambiente de desenvolvimento, constatou-se um problema grave:

> [!CAUTION]
> **Truncamento Ativo de Contexto**:  
> O `AGENTS.md` atual possui **39.585 bytes**. Em ferramentas de IA e IDEs agênticas (Antigravity, Cursor, Gemini Code Assist, etc.), arquivos de regras que ultrapassam o limite de buffer do prompt do sistema são **truncados automaticamente**.  
> **Resultado real**: O sistema estava truncando os últimos **15.585 bytes** do `AGENTS.md`. Ou seja, a LLM **não estava lendo** as seções de regras de votação, módulo financeiro, diárias de goleiro, superadmins, jogadores randômicos, segurança em RPCs, a matriz "Faça Assim vs Não Faça Assim" e o checklist de qualidade!

Além disso:

- **Sobrecarga de Tokens**: Cada interação simples consome ~10.000 tokens apenas com o cabeçalho de regras antes mesmo de o usuário digitar sua dúvida.
- **Poluição Cognitiva da LLM**: Regras extensas de backend e de banco diluem a atenção do modelo em tarefas puras de interface (UI).

---

### 3.2 Prós da Aplicação do OKF

1. ✅ **Eliminação Imediata do Truncamento**: Ao quebrar o monolito em bundles de 3 KB a 8 KB, nenhum documento excede os limites de injeção ou leitura de arquivos.
2. ✅ **Indexação Eficiente por Frontmatter**: O agente pode inspecionar apenas os metadados (`description`, `tags`, `type`) de cada arquivo para decidir em milissegundos se precisa lê-lo ou não.
3. ✅ **Alta Modularidade e Facilidade de Manutenção**: Alterar as regras de escalação de goleiros afeta apenas `knowledge/escalacao-goleiros.md`, sem risco de corromper diretrizes de CSS ou Supabase.
4. ✅ **Aderência a Padrões de Mercado (Vendor-Neutral)**: O OKF não exige SDK proprietário nem runtime complexo; são arquivos Markdown puros com frontmatter YAML, portáveis em qualquer repositório Git.
5. ✅ **Economia Massiva de Janela de Contexto**: A janela de contexto da LLM fica limpa para focar no código real da tarefa, reduzindo alucinações e aumentando a precisão.

---

### 3.3 Contras e Desafios Práticos do OKF

1. ⚠️ **Round-Trip Extra de Leitura**: Se o agente não carregar o arquivo na largada, ele precisará fazer uma chamada de ferramenta (`view_file`) para ler o bundle específico antes de responder ou codificar.
2. ⚠️ **Risco de Descumprimento de "Regras de Sobrevivência"**: Se regras críticas (como _Regra Zero UUID_ ou _Strict Rules of Hooks_) ficarem isoladas em arquivos que o agente não julgou necessário abrir, ele pode cometer erros básicos antes de perceber.
3. ⚠️ **Manutenção de Múltiplos Arquivos**: Exige disciplina do desenvolvedor para manter o índice e os links relativos atualizados ao refatorar a base.

---

### 3.4 Conclusão: Vale a pena implementar?

**SIM, vale muito a pena**, mas com uma **adaptação estratégica**:

> [!IMPORTANT]
> **Conclusão Técnica**:  
> A adoção **pura e cega** do OKF (onde o `AGENTS.md` deixaria de existir e tudo viraria dezenas de arquivos avulsos) traria o risco de o agente ignorar diretrizes globais de segurança.  
> O modelo ideal é uma **Arquitetura Híbrida (Hub-and-Spoke baseada em OKF)**:
>
> 1. Um **`AGENTS.md` Router/Hub minimalista** (~80 a 120 linhas), contendo apenas a Stack, as 5 Golden Rules invioláveis de sobrevivência e um catálogo semântico de links OKF.
> 2. Uma pasta estruturada de **Knowledge Bundles OKF** (`docs/knowledge/` ou `.knowledge/`), onde cada especialidade (Backend, Frontend, Regras de Futebol, Financeiro, UX Mobile) vive como um arquivo Markdown padronizado com YAML Frontmatter.

---

## 4. Outras Alternativas para Alcançar o Objetivo

### Alternativa 1: Arquitetura Hub-and-Spoke Híbrida (Lean AGENTS.md + OKF Bundles) — ⭐ _Recomendada_

- **Como funciona**:
  - O arquivo `AGENTS.md` na raiz atua como o **Kernel/Router**. Ele lista brevemente a stack, as regras absolutas (Zero UUID, No Tailwind Genérico, Hooks no topo) e apresenta um **Mapa de Conhecimento OKF**.
  - O conhecimento detalhado é distribuído em nós no padrão OKF dentro de `docs/knowledge/`:
    - `01-frontend-react.md` (`type: guideline`, tags: `[react19, hooks, useCache, skeletons]`)
    - `02-backend-supabase.md` (`type: reference`, tags: `[supabase, postgresql, rpc, migrations, bigint]`)
    - `03-regras-negocio-racha.md` (`type: concept`, tags: `[partidas, presenca, times, goleiros, notas]`)
    - `04-modulo-financeiro.md` (`type: concept`, tags: `[mensalidades, avulsos, pix, superadmins]`)
    - `05-ux-mobile-pwa.md` (`type: guideline`, tags: `[haptics, safe-areas, touch-44px, pwa]`)
  - O arquivo `design-system.md` permanece como o bundle oficial de UI/UX.

### Alternativa 2: Customização Nativa por Skills sob Demanda (`.agents/skills/`)

- **Como funciona**:
  - Utiliza o sistema de **Skills** suportado pelo ecossistema Antigravity / Agentic IDEs.
  - Cria-se diretórios em `.agents/skills/` contendo um arquivo `SKILL.md` para cada domínio de especialidade (ex: `.agents/skills/racha-supabase/SKILL.md`, `.agents/skills/racha-financeiro/SKILL.md`).
  - O agente possui um seletor nativo de skills e só carrega a skill quando identifica que a instrução do usuário é sobre aquele assunto específico.
- **Vantagem**: Carregamento 100% nativo integrado ao ciclo de vida do agente sem precisar poluir o repositório principal com documentações extras se não desejar.
- **Desvantagem**: Menos portátil para outros editores que não conheçam o formato `.agents/skills/`.

### Alternativa 3: Regras Baseadas em Caminho/Contexto (Path-based Rules)

- **Como funciona**:
  - Divide as regras em arquivos vinculados aos paths dos arquivos que estão sendo editados (ex: `.cursorrules`, `.agents/rules/` com padrões `glob`).
  - Regras de SQL só entram no contexto se você abrir ou editar arquivos em `supabase/migrations/**`.
  - Regras de CSS/UI só entram no contexto se editar `src/components/**` ou `src/routes/**`.
- **Vantagem**: Zero consumo de contexto desnecessário.
- **Desvantagem**: Se o usuário fizer uma pergunta genérica no chat sem ter um arquivo aberto, a regra correspondente pode não ser injetada automaticamente.

### Alternativa 4: LLM Wiki com Indexação Semântica Leve

- **Como funciona**:
  - Uma estrutura similar à documentação do Obsidian ou wikis de IA, onde os conceitos são interligados exclusivamente por links Markdown `[[termo]]` ou `[termo](./arquivo.md)` com um glossário canônico central.
- **Vantagem**: Muito simples de escrever, sem necessidade de YAML frontmatter estrito.
- **Desvantagem**: Não possui a taxonomia estruturada e os metadados de busca do padrão OKF.

---

## 5. Matriz Comparativa das Abordagens

| Critério                               |    AGENTS.md Atual (Monolito)     |     OKF Puro (Google)      | Hub-and-Spoke Híbrido (OKF + Lean Hub) | Skills Nativas (`.agents/skills`) |
| :------------------------------------- | :-------------------------------: | :------------------------: | :------------------------------------: | :-------------------------------: |
| **Tamanho no Prompt Inicial**          |  🔴 Crítico (~40 KB - Truncando)  |     🟢 Mínimo (~0 KB)      |          🟢 Ótimo (~2 a 4 KB)          |    🟢 Ótimo (apenas catálogo)     |
| **Garantia de Regras Críticas**        | 🟡 Parcial (fim do doc é cortado) |  🟡 Depende da LLM buscar  |    🟢 Total (Regras Kernel no Hub)     |   🟢 Boa (ativadas por prompt)    |
| **Modularidade / Organização**         |      🔴 Péssima (tudo junto)      |        🟢 Excelente        |              🟢 Excelente              |           🟢 Excelente            |
| **Portabilidade (Git / Qualquer IDE)** |              🟢 Alta              |          🟢 Total          |                🟢 Total                | 🟡 Média (específica de agentes)  |
| **Overhead de Busca da LLM**           | 🟢 Zero (já está tudo no prompt)  | 🟡 Requer 1 leitura prévia |      🟢 Rápida via índice no Hub       |    🟢 Automática pelo ambiente    |
| **Prevenção de Truncamento**           |          ❌ Não previne           |      ✅ Previne 100%       |            ✅ Previne 100%             |          ✅ Previne 100%          |

---

## 6. Plano de Ação e Estrutura Sugerida para o Repositório

Caso você decida avançar com a implementação, a estrutura recomendada é:

```text
racha/
├── AGENTS.md                  # 🎯 Hub Central Enxuto (~100 linhas: Stack, Golden Rules, Índice de Conhecimento)
├── design-system.md           # 🎨 Guia Canônico de UI/UX (já modularizado)
├── docs/
│   └── knowledge/             # 📚 OKF Knowledge Bundles (Google Open Knowledge Format)
│       ├── frontend.md        # [type: guideline] React 19, useCache, Hooks, Skeletons, Feedback
│       ├── backend.md         # [type: reference] Supabase, Migrations, Zero UUID, RPCs, Security
│       ├── futebol-regras.md  # [type: concept] Ciclo de vida, Presença, Times, Goleiros, Notas
│       ├── financeiro.md      # [type: concept] Mensalidades, Avulsos, Diárias, Superadmins
│       ├── mobile-pwa.md      # [type: guideline] Toques 44px, Safe Areas, Haptics, Deep-links
│       └── checklist.md       # [type: task] Checklist obrigatório pré-PR / pré-entrega
```

### Exemplo de Cabeçalho OKF para os Novos Bundles:

```markdown
---
type: guideline
title: Padrões de Frontend e React 19
description: Regras invioláveis de Hooks, cache SWR em memória, prevenção de race conditions e skeletons.
tags: [react, hooks, useCache, skeletons, frontend]
related: [../../design-system.md, ./mobile-pwa.md]
---
```

---

> 💡 **Próximo Passo Recomendado**:  
> Se desejar aplicar essa reestruturação, podemos criar a pasta `docs/knowledge/` com os bundles OKF já separados e, em seguida, enxugar o `AGENTS.md` raiz para transformá-lo no Router de alta performance.
