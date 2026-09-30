# Template de plano de implementação

> Estrutura obrigatória para todos os planos deste diretório. Cada plano cobre **um único item** do ranking em `docs/rank-melhorias-reuso-codigo.md`. Idioma: português.

```markdown
# <NN> · <Nome do item> — Plano de Implementação

> Ref.: item **<código>** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#<posição> (nota <nota>)**, Tier <N> (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: <S/M> · Risco: <baixo/médio> · Prioridade global do plano: <P0–P3>

## 1. Objetivo
Em 2–4 linhas: o que muda e qual duplicação/slop é eliminada.

## 2. Estado atual (evidências verificadas)
Bullets com `caminho:linha` **conferidos no código** na data do plano. Corrigir qualquer linha divergente do doc de origem.

## 3. Pré-condições e dependências
- Planos que devem vir antes (ou que reduzem o custo deste).
- Decisões do dono exigidas antes de executar (se houver).
- Restrições de janela (ex.: fora de partida ao vivo).

## 4. Plano de execução (1 passo = 1 commit)
Passo a passo numerado, cada passo pequeno, reversível e revisável isoladamente.
Incluir: arquivos a criar/tocar, assinaturas/props propostas, ordem de migração dos call sites.

## 5. Validação manual
Checklist objetivo de validação no aparelho/build (sem testes automáticos, conforme AGENTS.md).

## 6. Fora de escopo
O que explicitamente NÃO fazer neste plano (evitar migração cosmetica ampla).

## 7. Riscos e rollback
Riscos principais e como reverter cada passo (todos os passos devem ser revertíveis por `git revert` isolado).
```
