---
description: Verifica se os planos em docs/plano-*.md já foram implementados no código
argument-hint: [nome-do-plano opcional]
allowed-tools: Read, Glob, Grep, Bash(git log:*), Bash(git diff:*)
---

Verifique o status dos planos do projeto contra o código atual (HEAD).

## Passos

1. Liste `docs/plano-*.md`. Se "$1" foi informado, verifique apenas o plano cujo nome contém "$1" (correspondência parcial, sem exigir nome exato). Se nenhum arquivo combinar, diga isso e liste os disponíveis.
2. Para cada plano, leia o doc e extraia os itens verificáveis: migrations (número/nome), componentes, rotas, RPCs, regras de negócio, decisões fechadas.
3. Confirme cada item no código — busque arquivos, componentes e migrations e, quando necessário, o histórico (`git log`) para detectar algo que foi implementado e depois removido.
4. Classifique o plano:
   - **FEITO** — todos os itens verificados no código.
   - **PARCIAL** — parte implementada; liste exatamente o que falta (itens do doc ausentes no código).
   - **NÃO FEITO** — nada implementado; resuma em 1–2 linhas o que o doc prescreve.

## Formato da resposta

Um bloco por plano: veredito, divergências doc vs código (o doc diz X, o código faz Y) e evidência mínima (`arquivo:linha` ou arquivo ausente).

## Regras

- O veredito vem do código, não do doc — docs envelhecem e premissas mudam.
- Não ofereça atualizar o status no doc; responda de forma conclusiva.
- Plano FEITO: diga que o doc pode ser deletado, mas não delete sem confirmação explícita.
- Não implemente nada nesta verificação.
