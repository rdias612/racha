---
name: criar-agente
description: Cria ou atualiza agentes (subagentes) do ZCode como .md em .zcode/agents/ ou ~/.zcode/agents/. Use sempre que o usuário pedir para criar um agente, subagente ou "um agente que faça X", mencionar .zcode/agents, quero transformar um fluxo recorrente em agente, ou pedir para atualizar/revisar um agente existente — mesmo sem usar a palavra "agente" de forma formal.
---

# Criar Agente (subagente do ZCode)

Um agente do ZCode é um único arquivo `.md` cujo frontmatter o registra como
`subagent_type` no tool `Agent` e cujo corpo vira o system prompt do subagente.
Não há schema, plugin nem build — o arquivo é a coisa inteira.

## Onde o agente vive

- `.zcode/agents/<nome>.md` — agentes específicos deste repositório (padrão aqui)
- `~/.zcode/agents/<nome>.md` — agentes úteis em qualquer projeto (ex.: `postgres-reviewer`)

Regra: se o corpo citar convenções deste repo (AGENTS.md, build gate, migrations),
o agente é do projeto. Só vá para `~/` se ele fizer sentido em qualquer codebase.

## Antes de escrever: não duplique

1. Liste os agentes existentes em `.zcode/agents/` e `~/.zcode/agents/` e leia as
   `description` deles.
2. Se existir `.zcode/proposta-novos-agentes.md`, leia-a — ela já traz análise de
   lacunas e decisões (criar / não criar) que se sobrepõem ao pedido.
3. Se um agente existente já cobre o pedido, diga isso e pergunte se é para
   estendê-lo em vez de criar outro.

## Formato do arquivo

Frontmatter com exatamente três campos; corpo em markdown = system prompt:

```markdown
---
name: nome-kebab-case
description: O que o agente faz e quando usá-lo. Use para ... — acione também quando ...
tools: Read, Grep, Glob, Bash
---

# Título

Você é ... (papel e expertise)

## Regras
- ...

## Regras deste repositório (quando aplicável)
- ...
```

### Frontmatter

- **name**: kebab-case, igual ao nome do arquivo sem `.md`. O mesmo arquivo em
  caminho diferente é uma instalação separada; para atualizar, edite o original
  mantendo o `name`.
- **description**: é o único gatilho de ativação — o modelo não vê o corpo antes
  de escolher o agente. Precisa responder "o que ele faz" E "quando acionar".
  Modelos sub-acionam skills e agentes: seja específico e um pouco insistente,
  listando situações e termos que o usuário usaria ("mesmo que não peça um agente").
  Escreva em português, no padrão dos agentes existentes.
- **tools**: lista separada por vírgulas, mínimo necessário. Agentes de revisão e
  análise ficam SEM `Edit`/`Write` (read-only por construção — não confie em
  "prometa que não edita"). Agentes implementadores recebem `Read, Grep, Glob,
  Bash, Edit, Write`. Não inclua tools que o corpo não usa.

### Corpo (system prompt)

Estrutura mínima, sem seção de enfeite:

1. **Papel**: 1–2 frases de expertise e domínio.
2. **Abordagem/Regras**: comportamento verificável (o que faz, o que nunca faz,
   formato da resposta final). Explique o porquê das regras não óbvias.
3. **Regras deste repositório** — só as que se aplicam ao domínio do agente:
   - AGENTS.md na raiz prevalece em conflito.
   - Build gate: se editou arquivos (`src/`, migrations, edge functions), rodar
     `npm run build` na raiz como último passo e reportar o resultado.
   - Migrations: nunca reescrever migration já aplicada — fix forward com nova
     migration numerada.
   - Nenhum teste novo automático (decisão explícita do AGENTS.md).
   - Commitar nunca; commit é só sob pedido do dono.

Não copie regras que o AGENTS.md já impõe a toda sessão — o subagente as herda
pelo contexto do repositório. Só duplique as que o subagente precisa ver mesmo
sem esse contexto, ou as que ele tende a violar.

## Depois de criar

1. Conferência: `name` = nome do arquivo; frontmatter parseia (3 campos, YAML
   válido); description menciona os gatilhos.
2. O agente fica disponível como `subagent_type` na próxima sessão — na sessão
   atual ele pode não aparecer na lista. Informe isso ao usuário.
3. Smoke test opcional: despache uma tarefa pequena e real para o agente via
   `Agent` e confira se o comportamento bate com a `description`.

## Erros comuns

- **Agente genérico** ("expert em código") — se a description não distingue o
  agente dos que já existem, ele nunca será escolhido.
- **Tools demais** — read-only com `Write` anula a garantia estrutural.
- **Corpo enciclopédico** — regras que ninguém violaria; corte até sobrar só o
  comportamento que difere do default.
- **Dois agentes com overlap** — o escolhidor fica confuso; prefira estender o
  existente.
