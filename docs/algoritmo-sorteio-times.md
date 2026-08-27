# Algoritmo de Sorteio de Times — "Equilibrar" (Súmula de Quinta)

> Fonte: `src/lib/escalacao.ts` → `gerarEscalacaoAutomatica()`, orquestrado por `src/hooks/useEscalacaoTimes.ts` (`autoEscalar`).
> Este doc explica **passo a passo como o algoritmo decide** quem vai para o Time Preto (`a`) e Branco (`b`), e ao final traz sugestões de melhoria.

---

## 1. Entradas

| Entrada                    | Origem                                | Uso                                             |
| -------------------------- | ------------------------------------- | ----------------------------------------------- |
| `jogadores`                | Lista dos confirmados (14 de linha)   | Quem participa do sorteio                       |
| `mediasNotas`              | RPC `obter_medias_notas_jogadores()`  | Nível técnico de cada atleta                    |
| `j.media_nota`             | Fallback no próprio jogador           | Idem                                            |
| `j.posicao` (primária)     | Cadastro do atleta / papel na partida | Agrupamento de pares e balanceamento posicional |
| `j.posicao_b` (secundária) | Cadastro do atleta                    | Desempate posicional nas sobras                 |

**Pré-condição**: `jogadores.length >= limitePorTime * 2` (garantida pelo hook `autoEscalar`, que bloqueia com erro caso contrário).

---

## 2. Constantes do algoritmo

| Constante               | Valor                                   | Significado                                |
| ----------------------- | --------------------------------------- | ------------------------------------------ |
| `NOTA_PADRAO`           | `6.0`                                   | Nota atribuída a quem nunca recebeu votos  |
| `JITTER_NOTA`           | `±0.1`                                  | Ruído aleatório aplicado à nota (ver §3.2) |
| `limitePorTime`         | `Math.ceil(n/2)` → 7                    | Vagas de linha por time                    |
| Peso scorePosA/B        | `×2.0` (posição) `−0.5` (diff de notas) | Combinação na fase das sobras              |
| Peso posição secundária | `×0.5` da primária                      | `posicao_b` vale metade                    |

---

## 3. Fase 0 — Preparação

### 3.1 Nota base

Para cada jogador: `nota = (j.media_nota ?? mediasNotas?.[id] ?? 6.0)` arredondada a 2 casas.

### 3.2 Nota efetiva (jitter)

`notaEfetiva = nota + random(-0.1, +0.1)`, sorteada **uma única vez por jogador**, antes de qualquer ordenação.

**Por quê**: o jitter dá variedade entre sorteios idênticos (não é 100% determinístico). O sorteio único prévio é obrigatório: ruído **dentro** do comparador do `sort` viola o contrato da ordenação (pares podem inverter entre comparações → ordem não especificada).

### 3.3 Separação e embaralhamento

- `goleiros` = quem tem `posicao === 'goleiro'`
- `linha` = o restante, **embaralhado** (Fisher–Yates) para quebrar viés de ordem de chegada

> ⚠️ Ponto importante: no fluxo atual (pós-migração 093), os goleiros da partida são escalados **fora** dessa tela, em seletores dedicados. A lista passada ao gerador normalmente contém **só os 14 de linha**, então a fase de goleiros (§4) raramente roda — mas continua lá como reserva de segurança caso um goleiro apareça na lista.

---

## 4. Fase 1 — Distribuição de goleiros alternada

Se houver goleiros na lista:

1. Ordena por `notaEfetiva` decrescente (melhor primeiro).
2. Para cada goleiro, em ordem: vai para o time com **menor soma de notas** (e que tenha vaga). Empate `somaA <= somaB` favorece o time A.

Efeito: os dois melhores goleiros ficam em times opostos.

---

## 5. Fase 2 — Pares por posição primária (espinha dorsal do método)

1. Agrupa os 14 de linha por `posicao` (zagueiro com zagueiro, meia com meia…).
2. Dentro de cada grupo, ordena por `notaEfetiva` decrescente.
3. **Emparelha o grupo de 2 em 2** (melhor com pior do grupo):

```text
Grupo meia ordenado: [7.8, 7.2, 6.5, 5.9]
Pares formados: (7.8 ⇄ 5.9)  e  (7.2 ⇄ 6.5)
```

4. Para cada par, quando ambos os times têm vaga:
   - Se `somaA <= somaB`: o mais forte do par (`p1`) vai para **A**, o mais fraco (`p2`) para **B**;
   - Caso contrário, o inverso.

**Intuição**: cada par tem soma de notas quase constante (~13.7 no exemplo). O algoritmo decide só _para qual lado_ entregar o extra do par, sempre compensando o time que está atrás na soma acumulada. Isso já equilibra força **e** espelha posições.

5. Sobrando 1 jogador ímpar no grupo → vai para a **pilha de sobras**.
6. Par formado quando um dos times já está cheio → também vira **sobras**.

---

## 6. Fase 3 — Sobras: score posicional + técnico

Sobras são re-embaralhadas e alocadas uma a uma. Para cada jogador `j` restante, com ambos os times ainda com vaga:

### 6.1 Score posicional (escassez de posição)

`contarPosicao(time, pos)` conta quantos do time já têm aquela posição (primária **ou** secundária).

```text
scorePosA = (ocorrências no time B − no time A) × 1.0     ← posicao primária
          + (idem para posicao_b) × 0.5                    ← posição secundária
scorePosB = simétrico
```

Interpretação: se o Time Branco já tem 3 meias e o Preto nenhum, um meia tem score mais alto indo para o Preto — o algoritmo corrige desequilíbrios posicionais.

### 6.2 Score de equilíbrio de notas

```text
diffSeColocarA = |somaA + nota(j) − somaB|
diffSeColocarB = |somaA − (somaB + nota(j))|
```

Quanto menor a diferença resultante, melhor. Penalizado com fator `−0.5`.

### 6.3 Combinação

```text
scoreTotalA = scorePosA × 2.0 − diffSeColocarA × 0.5
scoreTotalB = scorePosB × 2.0 − diffSeColocarB × 0.5
```

- `scoreTotalA > scoreTotalB` → joga no Preto
- `scoreTotalB > scoreTotalA` → joga no Branco
- Empate → time com **menos jogadores** (garante paridade de quantidade)

Se só um time tem vaga, o jogador vai direto para ele.

**Peso 2.0 vs 0.5**: posição pesa 4× mais que a nota na fase das sobras. Prioridade explícita do autor: times com formações parecidas primeiro, soma de notas como refinamento.

---

## 7. Exemplo numérico (resumido)

14 confirmados, notas:

```text
ZAG: 8.0, 7.5, 6.2, 5.8   → pares (8.0⇄5.8), (7.5⇄6.2)
LAT: 7.0, 6.4             → par  (7.0⇄6.4)
MEI: 7.8, 6.9, 6.5        → par (7.8⇄6.5), sobra 6.9
ATA: 8.5, 7.7, 6.0        → par (8.5⇄6.0), sobra 7.7
```

Cada par entrega ~13.8 de soma total; a entrega alterna para o time com menor soma. As duas sobras (6.9 e 7.7) passam pelo score `[posição ×2.0] − [diff notas ×0.5]`.

---

## 8. Complexidade e propriedades

- Complexidade: **O(n log n)** (sorts dominantes), trivial para n=14.
- **Não determinístico**: jitter + embaralhamentos produzem times diferentes a cada clique, mesmo com o mesmo elenco.
- Garantias duras: 7 por time (limite respeitado no par estouro final por `limitePorTime`).
- Garantias soft: soma de notas próxima e distribuição posicional parecida.

---

## 9. Sugestões de melhoria (para análise)

### Alta prioridade

1. **Suporte a `posicao_b` no agrupamento da Fase 2.** Hoje os pares usam só `posicao`. Um híbrido `meia/atacante` é agrupado apenas como meia. Fallback por `posicao_b` reduziria sobras os pares desiguais.
2. **Busca de mínimo local (2-opt / trocas).** Após o budget greedy, rodar um loop de refinamento: tentar trocar pares de jogadores entre os times e aceitar trocas que reduzam a função-custo `(diff_soma_notas × w1 + diff_posicoes × w2)`. Custo adicional quase zero (n=14 → no máx. 49 trocas por iteração). Tipicamente reduz o desequilíbrio em 30–50%.
3. **Deixar o algoritmo também sugerir os 2 goleiros** quando entrarem como lista mista — hoje a Fase 1 apenas distribui os que aparecem, sem considerar o impacto médio de quem sobra na linha.

### Média prioridade

4. **Balancear também a _nota ponderada por posição_.** Posições têm impacto real diferente; aplicar pesos (ex.: goleiro 1.2, zagueiro 1.1, atacante 1.0) deixa o equilíbrio mais fiel ao que acontece em campo.
5. **Histerese anti-repetição**: guardar a última divisão (por `partida_id` anterior) e penalizar duplas repetidas do último racha — atende ao desejo de variar parcerias semana a semana.
6. **Expor o desequilíbrio no feedback**: hoje mostra só `Preto 6.5★ vs Branco 6.4★`. Mostrar também `Δ posições: 1` ou um selo "equilíbrio ótimo/bom/aceitável" ajuda o admin a decidir se aceita ou sorteia de novo.
7. **Transformar em função pura determinística com seed** (parâmetro `seed`). Manter `Equilibrar` variado com seed = timestamp é fácil — e viabiliza desfazer/reexecutar e reproduzir bugs ("times do dia X").

### Baixa prioridade

8. **Partição via `Karmarkar–Karp` (differencing)**: heurística clássica para minimizar a diferença de somas em O(n log n). Só vale se o peso da nota subir de importância.
9. **Testes unitários**: cobrir propriedades invariantes do gerador (`escalacao.test.ts`): (a) 7×7 garantido; (b) Δ soma de notas ≤ ε; (c) nenhuma posição com diferença > 2 entre os times (dado que existem ≥ 2 por posição).
10. **Remover a Fase 1 (goleiros)** do gerador se a tela de times mantiver goleiros 100% fora da lista — menos código morto e menos ramos de teste.

---

## 10. Referências no código

- `gerarEscalacaoAutomatica()` — `src/lib/escalacao.ts`
- `autoEscalar()` — `src/hooks/useEscalacaoTimes.ts` (guard de 14 confirmados, feedback de médias)
- Linha de impacto com a Participação na partida (papel vs. perfil) — ver docs `docs/implementation_plan_gestao_goleiros.md` e migration `093_hibridos_goleiro_linha.sql`
