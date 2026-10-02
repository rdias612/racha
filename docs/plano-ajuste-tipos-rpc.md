# Plano · Ajuste de tipos RPC após regeneração de `database.types.ts`

> Ref.: regeneração de `src/lib/database.types.ts` (comando de `docs/MIGRATE.md:25`) · Trap histórico documentado em `docs/MIGRATE.md:30` (commit `74d08f7`) e na Task 3 da Fase 1 do plano 35 (`docs/planos-implementacao/35-fases/fase-1-tasks.md:154`)
> Esforço estimado: S (2 passos, 1 arquivo de código) · Risco: baixo · Prioridade: P0 (build quebrado)

## 1. Objetivo

Fazer `npm run build` voltar a passar com o `src/lib/database.types.ts` **recém-gerado** (sem patch manual), adaptando o único consumidor que passa `null` explícito para args de RPC tipados como estritos. **Nenhuma alteração de comportamento funcional**: a RPC `registrar_divida` deve continuar recebendo os mesmos valores/NULLs que recebe hoje (comprovado na seção 2 via migration).

## 2. Estado atual (evidências verificadas)

### 2.1 Os 5 erros (reproduzidos em 2026-10-02)

`npm run build` (`package.json:8`, `tsc -b && vite build`) falha com exatamente 5 erros, todos em `src/lib/dividas.ts`:

```
src/lib/dividas.ts(119,5): error TS2322: Type 'number | null' is not assignable to type 'number | undefined'.
src/lib/dividas.ts(122,5): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
src/lib/dividas.ts(123,5): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
src/lib/dividas.ts(124,5): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
src/lib/dividas.ts(125,5): error TS2322: Type 'number | null' is not assignable to type 'number | undefined'.
```

- `npm run lint` (`package.json:10`, `tsc -b && eslint src public/sw.js`) tem **o mesmo gate** de tipos — falha nos mesmos 5 pontos.
- O novo gerado tipa os args de `registrar_divida` como estritos, sem `| null`: `p_data_divida?: string`, `p_descricao?: string`, `p_jogador_id?: number`, `p_natureza?: string`, `p_partida_id?: number`, `p_referencia?: string`, `p_tipo?: string`, `p_valor?: number` (`src/lib/database.types.ts:1334-1345`).
- O consumidor passa `null` explícito: `src/lib/dividas.ts:118-127` (`p_jogador_id: input.jogador_id ?? null` em :119, `p_data_divida ?? null` em :122, `p_descricao ? ... : null` em :123, `p_referencia ? ... : null` em :124, `p_partida_id ?? null` em :125). Linhas 120-121 (`p_tipo`, `p_valor`) não erram porque são sempre preenchidas (obrigatórias na interface de `registrarDivida`, `dividas.ts:108-117`).

### 2.2 Contrato real da RPC (conferido na migration)

Assinatura vigente em `supabase/migrations/092_fix_rpcs_e_defaults.sql:14-23` (precede a `078_dividas_natureza_despesa.sql:61-70`, que não tinha defaults):

```sql
CREATE OR REPLACE FUNCTION registrar_divida(
  p_jogador_id  bigint DEFAULT NULL,
  p_tipo        text DEFAULT NULL,
  p_valor       numeric DEFAULT NULL,
  p_data_divida date DEFAULT current_date,
  p_descricao   text DEFAULT NULL,
  p_referencia  text DEFAULT NULL,
  p_partida_id  bigint DEFAULT NULL,
  p_natureza    text DEFAULT 'receita'
)
```

**Todos os 8 parâmetros têm `DEFAULT`** — nenhum é obrigatório nem rejeita NULL. O corpo da função (`092:33-65`) ainda reforça a semântica:
- `092:33-35`: rejeita `p_valor` nulo/≤ 0 (nunca ocorre — sempre enviado).
- `092:46-48`: exige `p_jogador_id` para receita.
- `092:57`: `COALESCE(p_data_divida, current_date)` — NULL explícito e omissão (DEFAULT `current_date`) produzem o **mesmo resultado**.
- `092:58-59`: `NULLIF(trim(p_descricao), '')` / `NULLIF(trim(p_referencia), '')` — NULL e omissão produzem o **mesmo resultado** (NULL na coluna).

Logo: **omitir o argumento == passar `NULL`** para todos os casos em que o código hoje passa `null`. Não há divergência que bloqueie o plano.

### 2.3 Quem chama e de onde vem os inputs

Único consumidor de `registrarDivida`: `src/components/FormLancamentoFinanceiro.tsx:67-75`.
- `jogador_id: fJogador ? Number(fJogador) : null` (:68) — `null` = despesa sem jogador, "Caixa do racha" (o form valida que receita exige jogador em :56-59; o banco reforça em `092:46-48`). `null` e "campo ausente" são **semanticamente equivalentes** aqui.
- `descricao`/`referencia` chegam como `undefined` quando vazios (:73-74) — o `?? null` em `dividas.ts:123-124` só converte ausência em `null` explícito.
- `partida_id` e `data_divida` não são enviados pelo form — sempre `undefined` → hoje viram `null`. Omitir é equivalente (seção 2.2).

### 2.4 Histórico do trap

- Fase 1 do plano 35, Task 3 (`docs/planos-implementacao/35-fases/fase-1-tasks.md:154`) regenerou o types e, para manter o build, a seção `registrar_divida` do arquivo gerado foi restaurada verbatim com `?: T | null` nos args com `DEFAULT NULL`.
- O trap está documentado em `docs/MIGRATE.md:30` (commit `74d08f7`, "docs: nota de regeneracao de database.types.ts e trap de tipos de RPC"): testado com CLIs 1.100 a 2.119 — **nenhum** reproduz o arquivo versionado; toda regeneração re-quebra o build.

### 2.5 Outros consumidores de RPC (varredura)

- `grep` por `.rpc(` em `src/` encontra ~40 call sites em `src/lib/dividas.ts`, `jogadores.ts`, `notificacoes.ts` e `partidas.ts`. Como `tsc -b` analisa o projeto inteiro e só reporta os 5 erros de `dividas.ts`, **nenhum outro consumidor passa `null` para arg estrito do novo gerado**.
- `atualizar_dados_pix_telefone` (args estritos em `database.types.ts:1062-1068`): o consumidor `src/lib/jogadores.ts:496-501` passa `''`, números e strings — nunca `null`. Seguro (a própria nota de `MIGRATE.md:30` já o classificava como "hoje seguro, mesmo foot-gun").
- O padrão **omitir arg opcional com `?? undefined` já é o estilo estabelecido do projeto**: `src/lib/partidas.ts:332` (`abrir_partida`), `:350` (`registrar_evento`), `:369` (`editar_evento`).

## 3. Opções consideradas

### (A) Adaptar `dividas.ts` para omitir campos opcionais — **RECOMENDADA**

Trocar os 5 `?? null` / `: null` por `?? undefined` / `: undefined` no objeto de args (`dividas.ts:118-127`). Com `undefined`, a chave é omitida do JSON enviado pelo supabase-js e o PostgREST aplica o `DEFAULT` do banco — que é `NULL` (ou `current_date` via `COALESCE`, mesmo resultado) conforme a seção 2.2.

- **Prós**: diff de 5 linhas em 1 arquivo; segue padrão já usado em `partidas.ts:332,350,369`; comprovadamente sem mudança de comportamento; mata o trap de vez — regenerações futuras passam a ser plug-and-play; alinha o versionado com o que o gerador realmente produz.
- **Contras**: nenhum relevante. (Obs.: `p_tipo`/`p_valor` continuam sendo sempre enviados, sem mudança.)

### (B) Patch manual no types de novo (status quo)

Restaurar verbatim a seção `registrar_divida` do arquivo gerado, como na Fase 1.

- **Prós**: zero risco imediato; nenhuma linha de código tocada.
- **Contras**: insustentável — a própria `MIGRATE.md:30` registra que nenhuma toolchain disponível reproduz o arquivo versionado, então **toda regeneração re-quebra o build** e exige re Patch manual; o arquivo gerado deixa de ser gerado (contraria o pedido explícito do dono de fazer o build passar com o arquivo novo); mantém o alerta permanente no MIGRATE.md em vez de eliminá-lo.

### (C) Pin de versão antiga do CLI do Supabase

Fixar a versão do `supabase` CLI que gerava args com `| null`.

- **Prós**: teoricamente reproduziria o arquivo antigo sem tocar código.
- **Contras**: `MIGRATE.md:30` diz que CLIs de 1.100 a 2.119 **todos** emitem args sem `| null` — não há versão conhecida que reproduza o arquivo versionado, então o pin não entrega o benefício prometido; adiciona custo permanente (gerenciar versão de CLI global apenas para este comando) e não resolve a raiz (consumidor passando `null` onde o contrato é opcional).

**Recomendação: opção (A)** — mais simples (KISS), menor diff, mantém o padrão atual do projeto e elimina a causa do trap em vez de conviver com ele.

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Adaptar chamada de `registrar_divida` em `src/lib/dividas.ts`

**Arquivo**: `src/lib/dividas.ts` (apenas o corpo de `registrarDivida`, linhas 118-127).

**Diff conceitual** (não é código final — o executor não decide nada além disso):

- `p_jogador_id: input.jogador_id ?? null` → `p_jogador_id: input.jogador_id ?? undefined`
- `p_data_divida: input.data_divida ?? null` → `p_data_divida: input.data_divida ?? undefined`
- `p_descricao: input.descricao ? input.descricao.trim() : null` → `... : undefined`
- `p_referencia: input.referencia ? input.referencia.trim() : null` → `... : undefined`
- `p_partida_id: input.partida_id ?? null` → `p_partida_id: input.partida_id ?? undefined`
- `p_tipo`, `p_valor`, `p_natureza`: **inalterados** (sempre enviados; `p_natureza` mantém o fallback `?? 'receita'` do lado do cliente, `dividas.ts:126`, que é inócuo mas não é deste plano).
- A interface pública de `registrarDivida` (`dividas.ts:108-117`, com `| null`/opcionais no input) **não muda** — o chamador do form continua podendo passar `jogador_id: null`.

**Efeito no fio**: as chaves omitidas não saem no JSON; o PostgREST aplica os `DEFAULT` da `092:14-23` → mesmos valores gravados (seção 2.2/2.3).

**Gate**: `npm run build` e `npm run lint` passando (deve zerar os 5 erros; eslint não deve acusar nada novo — `?? undefined` é o padrão já lintado em `partidas.ts`).

### Passo 2 — Atualizar a nota de regeneração em `docs/MIGRATE.md`

**Arquivo**: `docs/MIGRATE.md` (seção "Regenerar types do banco", bloco "**Atenção (trap de tipos de RPC)**" da linha 30).

**Diff conceitual**:
- Remover a instrução de restaurar verbatim a seção `registrar_divida` com `?: T | null` (o trap deixa de existir após o Passo 1).
- Substituir por uma nota curta com o **padrão correto**: args de RPC com `DEFAULT` no banco são gerados como `?: T` (sem `| null`); consumidores devem **omitir** o argumento quando ausente (`?? undefined`), nunca passar `null` explícito — precedente `src/lib/partidas.ts:332,350,369` e `src/lib/dividas.ts` (pós-Passo 1).
- Manter: o aviso de rodar no Git Bash (`MIGRATE.md:28`), a observação sobre `PostgrestVersion` no cabeçalho (`MIGRATE.md:32`) e a "Verificação obrigatória pós-regeneração: `npm run build`".
- Remover/ajustar a menção ao ponto análogo `atualizar_dados_pix_telefone` (hoje o consumidor já passa `''`, sem risco — `jogadores.ts:496-501`).

**Gate**: `npm run build` + `npm run lint` (doc não afeta, mas o gate vale para todo passo, conforme AGENTS.md).

## 5. Validação manual (checklist do dono)

No app (Administrador → financeiro), criar lançamentos e comparar com registros criados **antes** da mudança (o padrão é o registro no banco equivalente):

- [ ] Receita com jogador (ex.: mensalidade 90, referência do mês) → grava `jogador_id` preenchido, `descricao`/`referencia` conforme digitado, `data_divida` = data escolhida, `natureza = receita`.
- [ ] Despesa **sem** jogador ("Caixa do racha") → grava `jogador_id = NULL` (antes também gravava NULL — conferir na tela Minhas Dívidas/mural ou via dashboard na tabela `dividas`).
- [ ] Despesa ou receita com descrição/referência **vazias** → grava `NULL` em `descricao`/`referencia` (não string vazia) — mesmo comportamento de antes, garantido pelo `NULLIF(trim(...))` (`092:58-59`).
- [ ] Lançamento sem mexer no campo Data → `data_divida` = hoje (`COALESCE(p_data_divida, current_date)`, `092:57`).
- [ ] Fluxos intocados seguem OK: quitar dívida (:134), quitar dívidas do jogador (:140), lembrete WhatsApp, resumo devedores.
- [ ] `npm run build` e `npm run lint` passam após a regeneração **sem nenhum patch manual** no `database.types.ts` (regenerar de novo, se quiser provar: o build deve continuar passando).

## 6. Fora de escopo

- Alterar a RPC `registrar_divida` ou qualquer migration.
- Tipos hand-written (padrão `ResumoAno`, `partidas.ts:585-616`) para substituir o gerado.
- Mudanças em `atualizar_dados_pix_telefone`/`jogadores.ts` (já seguras) ou em qualquer outro consumidor de RPC.
- Pin de versão do CLI do Supabase (opção C, descartada).
- O fallback `?? 'receita'` duplicado no cliente (`dividas.ts:126`) — inócuo, não tocar.
- Criar testes automáticos (AGENTS.md: sinalizar, não criar).

## 7. Riscos e rollback

- **Risco de divergência omitir vs. NULL**: refutado pela seção 2.2 — todos os parâmetros têm `DEFAULT` e o corpo da função normaliza (`COALESCE`/`NULLIF`). Se um dia a RPC mudar para um parâmetro sem `DEFAULT` nem aceitar NULL, esse parâmetro passa a ser obrigatório no gerado também (`p_x: T`, sem `?`) e o TypeScript volta a flagrar — o gate de build protege.
- **Risco de regressão funcional**: baixo — a única mudança de fio é a chave ausente no JSON, que o PostgREST resolve com o `DEFAULT` igual ao valor enviado hoje.
- **Rollback**: cada passo é 1 commit isolado e revertível por `git revert` (AGENTS.md). Reverter o Passo 1 sem o Passo 2 requebra o build com o types gerado — em caso de revert do Passo 1, restaurar também o patch do types (situação anterior a este plano) ou reverter ambos.
- **Risco documental**: se o Passo 2 for revertido sem o Passo 1, a nota do MIGRATE.md fica desalinhada com o código — reverter sempre na ordem inversa (Passo 2 antes do Passo 1).

## 8. Nota final — `docs/MIGRATE.md`

Após o Passo 2, o trap de tipos de RPC deixa de existir: a nota da seção "Regenerar types do banco" passa a apontar o padrão correto (`?? undefined` para args opcionais, nunca `null` explícito) e o checklist pós-regeneração se reduz a `npm run build` + `npm run lint`, sem patch manual no arquivo gerado. Nenhuma outra menção ao trap deve sobrar no repo (`grep -rn "trap\|?: T | null" docs/` para conferir).
