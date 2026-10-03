---
description: Review anti-slop da branch atual com subagentes anti-slop paralelos por área
argument-hint: [branch-base, padrão: main]
allowed-tools: Bash(git *), Agent
---

Revise as mudanças da branch atual caçando code slop de IA, com subagentes `anti-slop` paralelos por área. A rubrica de caça é a própria do agente (código morto, abstrações de uso único, comentários que narram o óbvio, duplicação, política de comentários lean) — não replique a lista aqui.

## Preparação

1. Defina a base: "$1" se informado, senão `main`. Rode `git diff --stat <base>...HEAD`.
2. Se a branch atual for a própria base ou o diff vier vazio, avise que não há mudanças para revisar e pare.
3. Liste os arquivos alterados e agrupe por área (ex.: UI/componentes, hooks/lógica, SQL/migrations, config/docs). Use o diff completo de cada arquivo (`git diff <base>...HEAD -- <arquivo>`) como material de review.

## Execução (somente review)

4. Abra um subagente `anti-slop` por área, todos em paralelo. Em cada prompt:
   - informe os arquivos da área e os diffs correspondentes;
   - deixe explícito que a fase é **somente review** — o agente tem Edit, mas aqui não pode editar arquivo nenhum;
   - peça os achados no formato `arquivo:linha — severidade (alta/média/baixa) — descrição curta`; sem achados, devolver "limpo".
5. Recolha a lista de achados de cada área.

## Consolidação

6. Monte um relatório único agrupado por severidade, cada linha com `arquivo:linha — descrição`. Destaque os 3 achados mais importantes.
7. Pergunte se devo corrigir. Se confirmado, abra de novo um subagente `anti-slop` por área, agora no modo de limpeza natural do agente (edita, valida com lint/build e reporta o que removeu), restrito aos itens consolidados da área dele.
