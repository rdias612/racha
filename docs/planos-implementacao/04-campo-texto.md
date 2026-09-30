# 04 · CampoTexto e CampoTextoLongo — Plano de Implementação

> Ref.: item **A3** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#4 (nota 8,0)**, Tier 1 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S–M · Risco: baixo · Prioridade global do plano: P1

## 1. Objetivo

Extrair o par `label + input/textarea` — a receita mais repetida dos formulários admin — para dois componentes: `CampoTexto` e `CampoTextoLongo`, eliminando ~120 LOC duplicadas em 5 arquivos (26 pares no total, 16 deles migráveis diretamente: 13 inputs + 3 textareas). A constante local `INPUT_CLASS` de `FormEventoAutomatico.tsx:19-20` — a prova de que o próprio código já sinalizou a duplicação — morre com a migração. O comportamento anti-zoom do teclado (16px em telas <sm) passa a ser invariante num único lugar, relevante nos formulários de notificações push, os mais editados do app.

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em 2026-09-30 (contagens do doc de origem confirmadas; nuance na SecaoNotificacaoConfirmacao corrigida):

- **`src/components/FormEventoAutomatico.tsx` — 9 pares** (confirmado). `INPUT_CLASS` declarada nas linhas **19-20**. Dos 9 pares, **4 são `<input>`** que usam a constante: Nome (`:160-166`), Valor (`:210-219`, `font-mono`), Descrição (`:258-264`), Referência (`:271-276`, `font-mono`). Os outros **5 são `SelectSumula`** (Quando, Natureza, Tipo, Destino, Jogador) com o mesmo wrapper de label — **não migram** (débito A10 / plano 34).
- **`src/components/FormLancamentoFinanceiro.tsx` — 7 pares** (confirmado). **4 `<input>`** com a fórmula de `INPUT_CLASS` colada inline, todos `font-mono`: Valor (`:166-175`, `type="number"` + `min/step/inputMode`), Data (`:182-187`, `type="date"`), Referência (`:194-200`), Descrição (`:207-217`). Não migram: Natureza (fieldset/botões, `:93-118`), Jogador e Tipo (`SelectSumula`, `:121-148` e `:154-159`).
- **`src/components/SecaoNotificacaoConfirmacao.tsx` — 6 grupos, dos quais 4 migráveis** (nuance: o doc contava 6 pares; 2 dos 6 são blocos `span + button` — "Dia e Horário do Disparo" `:80-99` e "Horas de Antecedência" `:178-192` — que **não são inputs** e ficam fora). Migráveis: Título (`:132-139`, `maxLength=120`), Mensagem (`:146-153`, `<textarea rows=2 maxLength=500>`), Título do Reforço (`:199-206`), Mensagem do Reforço (`:213-220`, textarea).
- **`src/components/SecaoNotificacaoVotacao.tsx` — 2 pares** (confirmado), dentro do acordeão mapeado por `TEMPLATES_VOTACAO` (`:158-211`): input Título (`:184-191`) e textarea Mensagem (`:198-205`) — renderizados **×5** pelo `map`.
- **`src/components/SecaoExportacaoFinanceira.tsx` — 2 pares** (confirmado): inputs `type="date"` "De" (`:63-68`) e "Até" (`:74-79`), fórmula inline idêntica à do `FormLancamentoFinanceiro`.
- **3 `<textarea>` com a mesma receita** (confirmado por grep): `SecaoNotificacaoConfirmacao.tsx:146` e `:213`, `SecaoNotificacaoVotacao.tsx:198` — todos `rows={2} maxLength={500}`.
- **Token anti-zoom `text-base sm:text-sm`** (grep confirmado) presente em `CampoBusca.tsx:98` e nos 4 arquivos de notificação/financeiro... **exceto** na constante `INPUT_CLASS` e nas cópias inline de `FormLancamentoFinanceiro`/`SecaoExportacaoFinanceira`, que usam só `text-base` — a cópia já **divergiu** no ponto exato que o componente deve tornar invariante.
- **Drifts já visíveis entre as cópias**:
  - Foco: `INPUT_CLASS` e FLF/SEF têm `focus-visible:outline-offset-2`; as cópias de SNC/SNV (`:138, :152, :205, :219` e `:190, :204`) **não têm** o offset.
  - Fundo: SNV usa `bg-superficie` (`:190, :204`); todas as outras cópias usam `bg-superficie-2`.
  - Rótulo: SNV usa `text-[11px]` (`:181, :195`); todas as outras usam `text-xs`.
- **`src/components/CampoBusca.tsx`**: referência de estilo de componente de campo já existente (props pt-BR, `min-h-[44px]`, `text-base sm:text-sm`, foco âmbar). **Permanece separado** — ícone de lupa, botão de limpar, `aria-label` sem rótulo visível; papel e API diferentes.

## 3. Pré-condições e dependências

- **Plano 17 (pasta `ui/`)**: conforme o README ("custa ~zero se aplicado no commit de criação"), o Passo 1 já adota a convenção — os dois componentes **nascem em `src/components/ui/`** (`CampoTexto.tsx` e `CampoTextoLongo.tsx`). Nunca depois como mudança separada.
- Sem dependência dos planos 01 (`CabecalhoSumula`), 02 (`Botao`) e 03 (invalidação). Na onda anti-slop (README: 03 → 01 → 02 → **04**), este é o último do Tier 1 — mas é independente e pode executar fora dessa ordem.
- **Decisões do dono**: nenhuma pendente para este item (README lista decisões só para 02, 24, 26 e 08). As normalizações deliberadas de migração estão registradas nos passos 4 e 5 e devem ser validadas visualmente, não decididas caso a caso.
- Restrição de janela: nenhuma. Todos os 5 arquivos são formulários admin (Gestão/Notificações), sem relação com partida ao vivo.

## 4. Plano de execução (1 passo = 1 commit)

Cada passo é pequeno, reversível por `git revert` isolado e revisável isoladamente. **Ordem de migração: arquivo com mais pares primeiro** (`FormEventoAutomatico` 4 → `FormLancamentoFinanceiro` 4 → `SecaoNotificacaoConfirmacao` 4 → `SecaoNotificacaoVotacao` 2×5 → `SecaoExportacaoFinanceira` 2). Sem biblioteca nova, sem teste automático, sem `big-bang`.

### Passo 1 — Criar os dois componentes (adoção do plano 17 neste commit)

- Criar `src/components/ui/CampoTexto.tsx` e `src/components/ui/CampoTextoLongo.tsx` (diretório novo se o plano 17 ainda não criou — os 63 componentes existentes **não se movem**).
- Seguir o estilo de `CampoBusca.tsx`: interface de props explícita com JSDoc, props de dado/handler em pt-BR, sem helper de merge de classes.
- Um único commit autocontido: nenhum chamador muda neste passo, então o build não depende dos passos seguintes.

Assinaturas propostas:

```tsx
// src/components/ui/CampoTexto.tsx
import type { InputHTMLAttributes } from 'react';

export interface CampoTextoProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'> {
  /** Rótulo visível acima do campo (receita label > span do design system). */
  rotulo: string;
  valor: string;
  aoMudar: (novoValor: string) => void;
  /** 'text' (padrão), 'number', 'date'… */
  tipo?: InputHTMLAttributes<HTMLInputElement>['type'];
  placeholder?: string;
  maxLength?: number;
  /** font-mono para valores numéricos, datas e referências. */
  fonteMono?: boolean;
  obrigatorio?: boolean;
  /** Escape no container <label> (ex.: 'col-span-2'). */
  className?: string;
}
```

```tsx
// src/components/ui/CampoTextoLongo.tsx
import type { TextareaHTMLAttributes } from 'react';

export interface CampoTextoLongoProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className'> {
  rotulo: string;
  valor: string;
  aoMudar: (novoValor: string) => void;
  /** Altura em linhas. Padrão 2 (receita atual dos 3 textareas). */
  linhas?: number;
  placeholder?: string;
  maxLength?: number;
  obrigatorio?: boolean;
  className?: string;
}
```

O `Omit<...>` + spread de props nativas é o mesmo padrão previsto no A2 para `Botao`: mantém a API declarada pequena e deixa atributos raros (`min`, `step`, `inputMode` dos campos de valor) passarem sem virar prop dedicada.

Receita canônica (cópia 1:1 das classes dominantes atuais — não inventar estilo novo):

- Container: `<label className={'block ' + (className ?? '')}>`.
- Rótulo: `<span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">`.
- Input: `w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2` + ` font-mono` se `fonteMono`.
- Textarea: igual ao input sem `min-h-[44px]`, com `rows={linhas}`.

A receita canônica incorpora **duas normalizações deliberadas**, alinhando todas as cópias ao padrão majoritário (e ao `CampoBusca`): token anti-zoom completo `text-base sm:text-sm` (hoje `INPUT_CLASS`, FLF e SEF têm só `text-base`) e foco com `focus-visible:outline-offset-2` (hoje ausente em SNC/SNV).

### Passo 2 — Migrar `FormEventoAutomatico.tsx` (4 pares; `INPUT_CLASS` morre aqui)

- Nome → `<CampoTexto rotulo="Nome" valor={form.nome} aoMudar={...} placeholder="ex.: Aluguel do campo" obrigatorio />`.
- Valor → `tipo="number"` + `min="0" step="0.01" inputMode="decimal" fonteMono obrigatorio` (props nativas via spread).
- Descrição (modelo) → `obrigatorio`.
- Referência → `fonteMono` (mantém rótulo condicional `(mês)`/`(opcional)` via prop `rotulo` em expressão).
- Containers com `col-span-2` → prop `className="col-span-2"`.
- **Neste commit a constante `INPUT_CLASS` (linhas 19-20) é removida** — não sobra nenhum uso.
- Os 5 `SelectSumula` mantêm o label manual atual (fora de escopo — plano 34).

### Passo 3 — Migrar `FormLancamentoFinanceiro.tsx` (4 pares)

- Valor → `tipo="number" min="0" step="0.01" inputMode="decimal" fonteMono obrigatorio`.
- Data → `tipo="date" fonteMono`.
- Referência → `fonteMono placeholder="ex.: 2026-08"`.
- Descrição → placeholder condicional (`fNatureza === 'despesa' ? ... : ...`) continua expressão passada ao `placeholder`.

### Passo 4 — Migrar `SecaoNotificacaoConfirmacao.tsx` (2 `CampoTexto` + 2 `CampoTextoLongo`)

- Título e Título do Reforço → `maxLength={120}` + `placeholder` com o texto padrão (`TEXTO_PADRAO_*`, já importado do próprio arquivo).
- Mensagem e Mensagem do Reforço → `<CampoTextoLongo linhas={2} maxLength={500} ... />`.
- **Normalização registrada**: as 4 cópias ganham `focus-visible:outline-offset-2` (divergência atual da `INPUT_CLASS`).

### Passo 5 — Migrar `SecaoNotificacaoVotacao.tsx` (1 `CampoTexto` + 1 `CampoTextoLongo`, renderizados ×5)

- Dentro do `map` de `TEMPLATES_VOTACAO`: Título → `CampoTexto` (`maxLength={120}`, `placeholder={b.placeholderTit}`); Mensagem → `CampoTextoLongo` (`linhas={2}`, `maxLength={500}`, `placeholder={b.placeholderMsg}`).
- **Normalizações registradas** (as mais visíveis do plano; validar lado a lado): fundo `bg-superficie` → `bg-superficie-2` (padrão das outras 11 cópias), rótulo `text-[11px]` → `text-xs`, foco ganha `outline-offset-2`. Se o dono preferir fidelidade total, estas duas cópias são o único caso que justificaria uma prop `variante` como a do `CampoBusca` — decidir na implementação, não criar a prop sem demanda.

### Passo 6 — Migrar `SecaoExportacaoFinanceira.tsx` (2 pares) e fechar

- De e Até → `<CampoTexto tipo="date" fonteMono ... />`.
- Conferência final: `grep -n "INPUT_CLASS" src/` vazio e nenhum resquício da fórmula inline (`grep -rn "focus-visible:outline-destaque-texto" src/components/` resta só em `ui/CampoTexto.tsx`, `ui/CampoTextoLongo.tsx`, `CampoBusca.tsx` e casos fora de escopo).

## 5. Validação manual

Sem testes automáticos (conforme AGENTS.md). A cada commit:

- [ ] `npm run build` passa (TypeScript sem erro de props).
- [ ] Formulário migrado aberto no navegador/aparelho: campos **visualmente idênticos** aos anteriores, exceto as normalizações registradas nos passos 1, 4 e 5 (comparar lado a lado com `git stash`/build anterior se necessário).
- [ ] **Anti-zoom**: em aparelho Android/iOS com largura <sm, focar cada campo e confirmar que o teclado não amplia a página (16px); em ≥sm, conferir o recuo para 14px nas cópias que hoje ficam em 16px (FEA/FLF/SEF).
- [ ] Foco via teclado (`Tab`): contorno âmbar visível em todos os campos, com offset nas cópias de notificações.
- [ ] Comportamento preservado por campo: `required` (Nome/Valor/Descrição do FEA e Valor do FLF bloqueiam submit vazio), `maxLength` (120/500 nas notificações), `min/step` no Valor, `type="date"` abre o seletor nativo.
- [ ] Grids preservados: campos de 2 colunas continuam lado a lado; `col-span-2` mantém largura total.
- [ ] Notificações (passos 4-5): editar título/mensagem, salvar e conferir persistência; no passo 5, abrir os 5 buckets do acordeão e conferir os 10 campos.
- [ ] Exportação (passo 6): gerar Excel de um período válido e conferir a validação "data inicial > final".
- [ ] Ao final: `grep -n "INPUT_CLASS" src/` não retorna nada.

## 6. Fora de escopo

- **`CampoBusca` permanece separado** — ícone de lupa, botão de limpar, `aria-label` sem rótulo visível; unificá-lo com `CampoTexto` exigiria props de exceção nos dois lados. (Sua limpeza de aliases bilíngues é o plano 14, A4.)
- **Selects não migram**: os 5 `SelectSumula` do `FormEventoAutomatico`, os 2 do `FormLancamentoFinanceiro` e o fieldset "Natureza" mantêm o label manual atual. Unificação de selects/labels de select é débito do **A10 / plano 34** (`SelectSumula` sem suporte a `optgroup` hoje).
- **Checkboxes não migram** ("Ativo" do `FormEventoAutomatico:279-287`, buckets de votação do `SecaoNotificacaoVotacao:130-149`) — receita diferente, volume baixo.
- **Blocos `span + button` das notificações não migram** (seletores de "Dia e Horário do Disparo" e "Horas de Antecedência") — não são inputs.
- **Outros inputs do app não migram** (`Login.tsx`, `Perfil.tsx`, `Estatisticas.tsx`, `ModalNovoGoleiro.tsx`, `LinhaGoleiro.tsx` usam o token anti-zoom mas fora dos 5 arquivos do A3) — migração cosmética ampla; entram "ao tocar o arquivo", consumindo o componente pronto.
- Não mover os 63 componentes existentes de `src/components/` para `ui/` (só o plano 17, por toque).
- Sem novas bibliotecas, sem helper de classes, sem testes automáticos.

## 7. Riscos e rollback

- **Risco principal: drift visual silencioso** — a receita canônica replicar as classes com pequena diferença e o erro se multiplicar por 16 campos. Mitigação: receita copiada 1:1 das cópias dominantes; normalizações registradas uma a uma (passos 1, 4 e 5); checklist de comparação visual por arquivo (seção 5).
- **Risco: API de props nativas mal tipada** — o `Omit<...>` + spread pode aceitar props que conflitam com as declaradas (`value`/`onChange`). Mitigação: os `Omit` do passo 1 bloqueiam exatamente os pares controlados; `npm run build` pega qualquer conflito.
- **Risco: regressão de validação HTML** — `required`/`maxLength` não reproduzidos = formulário aceita dado inválido. Mitigação: itens dedicados no checklist (seção 5) por arquivo migrado.
- **Rollback**: todo passo é 1 commit isolado → `git revert <commit>` restaura o arquivo para a receita inline sem afetar os demais. O Passo 1 (criação) só pode ser revertido sozinho se nenhuma migração aconteceu; caso contrário, reverter as migrações em ordem inversa (SEF → SNV → SNC → FLF → FEA) e por último os componentes. Nenhuma migração altera dados, rotas do roteador ou o service worker.
