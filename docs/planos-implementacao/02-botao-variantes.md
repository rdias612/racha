# 02 · Extrair `Botao` com variantes — Plano de Implementação

> Ref.: item **A2** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#2 (nota 9,0)**, Tier 1 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: M · Risco: baixo-médio · Prioridade global do plano: P1

## ⚠️ Decisão do dono (obrigatória antes de executar)

Este plano tem **duas formas possíveis** e a escolha muda os passos 1–3. As duas eliminam os mesmos drifts; a diferença é quanto de API nova se cria.

### Opção A — Componente `Botao` (proposta completa)

`src/components/ui/Botao.tsx` (ou `src/components/Botao.tsx`, ver §3) encapsula a assinatura visual e o elemento `<button>`.

- **Prós**: captura de forma completa o par cancelar/confirmar e os 4 rodapés de modal (o caso de uso mais repetido); alvo de 44px, foco âmbar e `disabled` viram invariantes do elemento, não classes a copiar; cada botão futuro nasce correto sem ler DESIGN.md; `disabled` e o spread de props nativas tratam `cursor-not-allowed` num lugar só.
- **Contras**: cria um componente novo (mais uma API para conhecer); abstrai o `<button>` — casos raros (ícone puro, botão de lista de 48px) precisariam do escape `className` ou continuam com `<button>` cru; custo de migração por call site um pouco maior (trocar elemento por componente).

### Opção B — Apenas constantes de classe (alternativa menor, estilo `VARIANTE_CLASSES` do `Badge.tsx:56-63`)

Exportar de um módulo (ex.: `src/lib/botoes.ts` ou junto do `Badge`) um `Record<VarianteBotao, string>` com as classes de cada variante + a constante de assinatura comum; os call sites continuam escrevendo `<button className={...}>`.

- **Prós**: zero abstração nova — é exatamente o padrão já consagrado do `Badge`; mudança por call site é mínima (colar constante no `className`); segue ao pé da letra o AGENTS.md (KISS, sem componente sem demanda).
- **Contras**: não elimina o boilerplate estrutural (`flex-1 min-h-[44px] inline-flex items-center justify-center ...` continua copiado em cada botão); `disabled`, foco e `active:translate-y-px` seguem dependendo de cópia fiel em cada site; o par cancelar/confirmar e os rodapés continuam sendo 7 blocos de JSX repetidos — as constantes tiram o drift visual, mas não o volume.

### Como o resto do plano muda em cada caso

- **Passo 1** cria o componente (Opção A) ou apenas o módulo de constantes (Opção B).
- **Passos 2–5** (3 pares duplicados + 4 rodapés) são os mesmos call sites, mas na Opção B a migração troca só as classes (commits menores, risco menor) e o resultado mantém a repetição de JSX; na Opção A os blocos de botão inteiros somem.
- **Passo 6** (migração oportunista) vale nos dois casos, mas o ganho por arquivo tocado é maior na Opção A.
- **Recomendação**: a Opção A é a que ataca o problema completo (volume + drift), e é a leitura do ranking (#2, nota 9,0 — "o componente captura o par cancelar/confirmar e os rodapés de forma mais completa"). A Opção B é defensável se o dono preferir zero componente novo. **Não executar nada antes desta decisão.**

## 1. Objetivo

Eliminar a maior duplicação do app em volume: **131 `<button>` estilizados à mão** (confirmado: 39 em `src/routes/`, 92 em `src/components/`), com a fórmula do primário âmbar colada em ~29 usos (25 `<button>` de 21 arquivos + 4 CTAs-Link) e drift visual já instalado (`disabled:opacity-40` vs `-50`, `shadow-carimbo` vs `-destaque` vs `shadow-xs`, `font-bold` vs `font-black`, `rounded-[3px]` vs `rounded-[4px]`). A extração cria um ponto único para a assinatura visual do botão, transformando alvo de 44px e foco âmbar em invariantes gratuitos para todo botão futuro.

## 2. Estado atual (evidências verificadas)

Conferidas no código em 2026-09-30. Números corrigidos em relação ao doc de origem estão marcados com **(corrigido)**.

- **Volume**: 131 `<button>` estilizados à mão (39 em `src/routes/`, 92 em `src/components/`) — recontado, bate com o plano.
- **Fórmula do primário âmbar** (`border-destaque bg-destaque text-destaque-tinta ... active:translate-y-px`): `Jogos.tsx:121-127` ("Nova partida", CTA-Link) e `PartidaDetalhe.tsx:272-277` **(corrigido; o doc de origem dizia 273-275)** ("Editar votos", CTA-Link). ~29 usos no total.
- **Par cancelar/confirmar duplicado**:
  - `ConfirmDialog.tsx:67-86` — cancelar com `shadow-carimbo`, confirmar âmbar com `font-black` + `shadow-carimbo-destaque` e `transition-fast` (drift intra-arquivo).
  - `ModalFiltrosRanking.tsx:90-112` **(corrigido; origem dizia 90-113)** — rodapé "Limpar"/"Aplicar Filtros": Limpar com `shadow-xs`, Aplicar com `font-black` + `shadow-carimbo-destaque`.
  - `FormLancamentoFinanceiro.tsx:221-236` — submit que muda de variante por natureza (`perigo`/`primario`), com `disabled:opacity-50`.
- **Rodapés "Fechar"/"Cancelar" de modal** (4 cópias quase iguais):
  - `ModalSelecionarOpcao.tsx:50-58` — Fechar, `shadow-xs`.
  - `ModalSelecionarGoleiro.tsx:67-75` — Fechar, `shadow-xs` (idêntico ao anterior, sem o `cursor-pointer`).
  - `ModalEscalarJogador.tsx:52-62` — Fechar com `rounded-[3px]`, **sem** `shadow` e sem `bg` (drift de forma).
  - `ModalSelecionarAgendamento.tsx:68-84` **(corrigido; origem citava 78-82, que é só o Cancelar)** — par Confirmar (`shadow-carimbo`, `font-bold`) / Cancelar (`shadow-xs`).
- **Drift `disabled:opacity`**: 16 usos de `disabled:opacity-40` (ex.: `DueloCard.tsx:29`, `PartidaVotar.tsx:372`, `DialogoEvento.tsx:130,142,173,190`, `ConfirmacoesPartida.tsx:38`) vs **20 usos** de `disabled:opacity-50` (ex.: `FormLancamentoFinanceiro.tsx:224`, `BotaoInstalar.tsx:48`, `CardNotificacoes.tsx:132`) — recontado, é pior do que os exemplos isolados do plano.
- **Drift de sombra no mesmo papel**: `shadow-carimbo` (fórmula majoritária do primário) vs `shadow-carimbo-destaque` (4 arquivos: `ConfirmDialog`, `ModalFiltrosRanking`, `BotaoInstalar`, `CardNotificacoes`) vs `shadow-xs` (rodapés secundários).
- **Drift de raio**: `rounded-[4px]` (majoritário) vs `rounded-[3px]` (`Jogos.tsx:123`, `ModalEscalarJogador.tsx:56`, `BarraRascunhoGestao.tsx:37,47`, `EscalacaoTimesEditor.tsx:255`).
- **Padrão de referência no repo**: `VARIANTE_CLASSES: Record<BadgeVariante, string>` em `Badge.tsx:56-63` — o modelo para a Opção B.
- **Pasta `ui/` ainda não existe** — será criada pelo plano 17 (`pasta-ui.md`), junto do primeiro componente novo.

## 3. Pré-condições e dependências

- **Decisão do dono: Opção A (componente `Botao`) vs Opção B (constantes de classe)** — ver bloco no topo. Nada é executado antes.
- **Plano 17 · A9 · Pasta `ui/`** (item #17 do ranking): executar no mesmo commit de criação — o `Botao.tsx` (Opção A) ou o módulo de constantes nasce direto em `src/components/ui/`. Se a pasta `ui/` for rejeitada, o artefato nasce em `src/components/` (Opção A) ou `src/lib/` (Opção B) e o resto do plano não muda.
- **Assinatura visual canônica** a adotar (forma majoritária do código hoje, para minimizar diffs visuais):
  `min-h-[44px]` (alvo de toque) · `rounded-[4px]` · `font-display font-bold uppercase tracking-wider text-xs` (sem `font-black`) · `inline-flex items-center justify-center gap-1.5` · `transition active:translate-y-px` · `disabled:opacity-50 disabled:cursor-not-allowed` (forma majoritária: 20 vs 16) · foco `focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2`.
  Variantes: `primario` = `border-destaque bg-destaque text-destaque-tinta shadow-carimbo hover:brightness-105` · `secundario` = `border-borda bg-superficie-2 text-giz shadow-xs hover:bg-superficie` · `perigo` = `border-perigo bg-perigo text-branco-time shadow-carimbo hover:brightness-110`.
  Call sites que divergem dessa canônica (ex.: `font-black`, `shadow-carimbo-destaque`) aceitam o ajuste visual mínimo ao migrar — validar em tela (§5).
- **Restrições de janela**: nenhum passo toca fluxo de partida ao vivo; `DialogoEvento.tsx` fica explicitamente fora da migração deste plano (escopo do plano 08 · A5), o que elimina a única restrição de janela.
- **Convenção de nomenclatura** (consolidada no plano 14 · A4): props de dado em pt-BR, handlers `ao*`, APIs nativas do DOM em inglês (`disabled`, `type`, `onClick` via spread).

## 4. Plano de execução (1 passo = 1 commit)

Cada passo é independente, revertível por `git revert` isolado e deixa o build funcionando. **Migração sem big-bang**: os passos 1–5 cobrem apenas os 7 blocos duplicados; o passo 6 é oportunista e não tem prazo.

**API proposta (Opção A)** — `src/components/ui/Botao.tsx`:

```tsx
type VarianteBotao = 'primario' | 'secundario' | 'perigo';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;      // default 'primario'
  larguraCompleta?: boolean;     // w-full (rodapés de modal, submits)
  className?: string;            // escape para casos raros; vence por último
}

export function Botao({ variante = 'primario', larguraCompleta, className, type = 'button', ...resto }: BotaoProps)
```

Sem `onClick` próprio, sem estado, sem ícone como prop (ícone vai como children, como hoje). Nota: na Opção B, o mesmo contrato vira `const CLASSES_BOTAO: Record<VarianteBotao, string>` + `ASSINATURA_BOTAO` exportados, e os passos abaixo trocam "usar `<Botao>`" por "usar as constantes no `className`".

1. **Criar o artefato** — Opção A: `src/components/ui/Botao.tsx` (ou constantes em `src/components/ui/botoes.ts`, Opção B), já com a assinatura canônica do §3, as 3 variantes, `larguraCompleta` e spread de props nativas. Nenhum call site migrado neste commit. Se ainda não existir, criar `src/components/ui/` no mesmo commit (plano 17).
2. **Migrar `ConfirmDialog.tsx`** (par cancelar/confirmar, linhas 67-86) — cancelar vira `secundario`, confirmar vira `primario` (tom perigo → `perigo`). Aceitar perda de `font-black` e `transition-fast` (canônica). Revisar os 10 chamadores visualmente.
3. **Migrar o rodapé de `ModalFiltrosRanking.tsx`** (linhas 90-112) — Limpar = `secundario` (mantém `disabled` via prop), Aplicar = `primario` + `larguraCompleta={false}` no flex do rodapé.
4. **Migrar o submit de `FormLancamentoFinanceiro.tsx`** (linhas 221-236) — `type="submit"`, variante condicionada a `fNatureza` (`perigo`/`primario`), `larguraCompleta`, `disabled={salvando}`.
5. **Migrar os 4 rodapés de modal** — um commit único, 4 arquivos, mesma troca mecânica: `ModalSelecionarOpcao.tsx:50-58`, `ModalSelecionarGoleiro.tsx:67-75`, `ModalEscalarJogador.tsx:52-62` (ganha a canônica: passa a ter `rounded-[4px]` e sombra), `ModalSelecionarAgendamento.tsx:68-84` (Confirmar = `primario` + `larguraCompleta`, Cancelar = `secundario` + `larguraCompleta`).
6. **Migração oportunista (sem prazo, um arquivo por commit)** — conforme cada arquivo for tocado por outra tarefa, migrar seus botões que encaixem nas 3 variantes. Ordem sugerida pelos mais carregados de cópias do primário: `PartidaVotar.tsx`, `NotificacoesVotacao.tsx`, `CardNotificacoes.tsx`, `ModalNovoGoleiro.tsx`, `BarraRascunhoGestao.tsx`. CTAs-Link (ex.: `Jogos.tsx:121-127`, `PartidaDetalhe.tsx:272-277`) **não migram** — `<Botao>` renderiza `<button>`; eles se beneficiam só se a Opção B for escolhida (troca de classes é válida em `<Link>`), e o alvo de 44px deles é escopo do plano 19 · C1.

## 5. Validação manual

Após cada passo (e obrigatoriamente após os passos 2–5, que mudam botões visíveis):

- [ ] `npm run build` passa (sem erro de TypeScript/lint).
- [ ] `ConfirmDialog`: abrir um diálogo com confirmação normal e um com `tomConfirmar="perigo"`; verificar contraste, sombra, foco por teclado (outline âmbar) e botão desabilitado (opacidade legível).
- [ ] Modal de filtros do Ranking: Limpar desabilitado até alterar filtro; Aplicar aplica e fecha.
- [ ] Formulário financeiro: submeter como receita (âmbar) e despesa (vermelho perigo); estado "Salvando…" desabilitado.
- [ ] Os 4 modais (Opção, Goleiro, Escalação, Agendamento): rodapé fecha o modal; botões têm 44px de altura no toque; Escalação valida o novo `rounded-[4px]`/sombra (única mudança visual intencional).
- [ ] Navegar em 1–2 telas migradas do passo 6 no aparelho: toque em botão primário, estado desabilitado, foco.

## 6. Fora de escopo

- **Big-bang de 131 botões**: expressamente proibido. Só os 7 blocos duplicados + migração oportunista.
- **CTAs-Link** (`<Link>` com cara de botão): não viram `<Botao>` (elemento diferente); 44px deles é o plano 19 · C1.
- **`DialogoEvento.tsx`**: fica para o plano 08 · A5 (migração para `ModalBase`).
- **Botões que não encaixam nas 3 variantes**: opções de lista de 48px (`ModalSelecionarOpcao.tsx:64+`), botões-ícone (`DueloCard`, `LinhaGoleiro`), chips/abas. Continuam com `<button>` cru.
- **Novas variantes** ("ghost", "link", tamanhos `sm`/`lg`): só quando existir demanda real (YAGNI).
- **Unificar `Toggle`, `CampoBusca`, `Badge`** ou qualquer outra primitiva: fora deste plano.
- **Novas bibliotecas**: nada de `class-variance-authority`, `cva`, headless UI ou similar — tudo com o que já existe (Tailwind + spread nativo).
- **Testes automáticos**: não criar (AGENTS.md); validação é manual, §5.

## 7. Riscos e rollback

- **Risco: regressão visual em `ConfirmDialog`** (10 chamadores, diálogos destrutivos). Mitigação: commit isolado (passo 2), inspeção dos fluxos que confirmam descarte/votação. Rollback: `git revert` do passo — nenhum outro arquivo é tocado nele.
- **Risco: mudança visual silenciosa nos 4 rodapés** (Escalação ganha sombra/raio). Mitigação: é a única divergência intencional da canônica; validar os 4 modais no passo 5. Rollback: revert do passo 5 (4 arquivos, sem dependência cruzada).
- **Risco: escape de `className` mal composto** (classe do call site perdendo para a canônica ou duplicando `rounded`). Mitigação: convenção explícita no componente — `className` do chamador entra por último; se um caso precisar de override frequente, é sinal de variante nova a discutir, não de escape.
- **Risco: Opção B perpetuar o JSX repetido** (drift visual resolvido, volume não). Não é regressão, é limite conhecido da escolha — registrado aqui para o dono decidir consciente.
- **Todos os passos são revertíveis por `git revert` isolado**: nenhum passo depende do anterior em runtime (o passo 1 só adiciona arquivo novo; os demais só trocam call sites).
