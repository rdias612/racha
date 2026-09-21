# Plano: Remoção do Pódio Top 3 do Ranking

> **For agentic workers:** Implementar tarefa por tarefa com superpowers:executing-plans. Passos usam checkbox (`- [ ]`). Executor não commita por conta própria — commit apenas sob pedido do usuário (padrão de commit: título imperativo ≤72 chars, sem prefixos, descrição pt-BR).

**Goal:** Remover o bloco de pódio (Top 3) que aparece acima da tabela em todas as telas de ranking (`/ranking/pontos`, `/ranking/gols`, `/ranking/assistencias`, `/ranking/gols-contra`), deixando a tabela como único elemento de classificação.

**Architecture:** Mudança 100% frontend + docs. O pódio é um único componente local (`PodioTop3` dentro de `Ranking.tsx`), renderizado condicionalmente antes de `TabelaRanking`. A remoção limpa o componente, o campo `unidade` do config que só ele consumia, o bloco equivalente do skeleton (requisito CLS = 0), a utility CSS que só ele usava e as 3 menções em docs canônicos.

**Tech Stack:** React 19 + TypeScript, Tailwind v4 (utilities customizadas), sem SQL / sem migrations / sem mudança de rotas.

**Commit-base auditado:** `fffd2d2` (HEAD de `main` em 20/09/2026). Premissas verificadas contra o código atual:

- `PodioTop3` existe apenas em `src/routes/Ranking.tsx` (render condicional em `Ranking.tsx:330-337`, componente em `Ranking.tsx:356-425`).
- O pódio renderiza nas **4 métricas** (é o mesmo componente; nenhuma aba tem pódio próprio). Removê-lo uma vez remove de todas.
- O skeleton do ranking replica o pódio em `src/components/Skeletons.tsx:112-117` — precisa sair junto, senão o primeiro load mostra um bloco fantasma de ~160px antes da tabela (viola CLS = 0).
- A utility CSS `texto-vazado` (`src/index.css:236-239`) só é usada dentro de `PodioTop3` (`Ranking.tsx:376` e `407`) — fica órfã após a remoção.
- O campo `unidade` do Record `metricas` (`Ranking.tsx:35` e valores nas linhas 37/40/44/48) só é consumido pela prop `unidade` passada ao pódio (`Ranking.tsx:335`) — fica órfão.
- Fora do escopo (não alterar): o 🏆 da primeira linha da tabela (`Ranking.tsx:498`) está **dentro** da tabela, marcando o líder — não é o pódio. E os "Destaques do ano" de `EstatisticasRacha.tsx` são outra seção, sem relação com este pódio.

## Global Constraints

- Tokens semânticos obrigatórios; proibido hardcodar hex/Tailwind genérico no JSX (AGENTS.md §4.2).
- Zero code slop: nada de código morto órfão sobrando (utility CSS, campo de config, fragment desnecessário).
- Hooks no topo; nenhuma mudança de hooks é necessária aqui (remoção é só de JSX/presentação).
- Sem `window.confirm`/`alert`; sem testes no repositório (removidos a pedido do usuário) — validação via `npm run lint`, `npm run format` e `npm run build` + inspeção manual.
- Executor não commita; commit único no fim, sob pedido, com mensagem sugerida no final do plano.

---

### Task 1: Remover o pódio de `Ranking.tsx`

**Files:**

- Modify: `src/routes/Ranking.tsx`

**Interfaces:**

- Consumes: nada novo.
- Produces: `/ranking/:metrica` renderiza apenas `TabelaRanking` abaixo dos filtros. O prop `unidade` do Record `metricas` deixa de existir.

- [ ] **Step 1: Remover o render condicional do pódio e o fragment que o envolvia**

No ternário de estado vazio (hoje linhas 324-350), o fragment `<>...</>` envolvia pódio + tabela. Com o pódio fora, a tabela vira o único filho do ternário — substituir o bloco inteiro por:

```tsx
{
  linhasFiltradas.length === 0 ? (
    <MensagemEstado tipo="info">
      O ranking nasce no primeiro apito. Nada publicado com esses filtros ainda.
    </MensagemEstado>
  ) : (
    <TabelaRanking
      linhas={linhasFiltradas}
      colunasOrdenacao={colunasOrdenacao}
      colunaOrdenacao={colunaOrdenacao}
      direcaoOrdenacao={direcaoOrdenacao}
      selecionarOrdenacao={selecionarOrdenacao}
      valorOrdenacao={valorOrdenacao}
      jogadorLogadoId={jogadorLogado?.id}
    />
  );
}
```

- [ ] **Step 2: Remover a função `PodioTop3` por completo**

Apagar a definição inteira (hoje linhas 356-425), do `function PodioTop3({` até o `}` que a fecha, incluindo o separador `— classificação geral —` interno a ela.

- [ ] **Step 3: Remover o campo `unidade` do Record `metricas`**

Deixar o Record assim (só o pódio consumia `unidade`; `CampoMetrica` e as demais chaves continuam em uso pela tabela):

```tsx
const metricas: Record<Metrica, { titulo: string; coluna: string; campo: CampoMetrica }> = {
  pontos: { titulo: 'Classificação Geral', coluna: 'PTS', campo: 'pontos' },
  gols: { titulo: 'Artilharia da Temporada', coluna: 'GOLS', campo: 'gols' },
  assistencias: { titulo: 'Líderes de Assistências', coluna: 'ASSISTS', campo: 'assistencias' },
  'gols-contra': { titulo: 'Ranking de Gols Contra (Zoeira)', coluna: 'GC', campo: 'gols_contra' },
};
```

(O Prettier pode quebrar as linhas de objeto de outra forma — rodar `npm run format` no fim e aceitar o resultado.)

- [ ] **Step 4: Conferir que nada ficou órfão**

Run: `grep -n "PodioTop3\|unidade\|texto-vazado" src/routes/Ranking.tsx`
Expected: zero ocorrências.

### Task 2: Remover o bloco do pódio do skeleton

**Files:**

- Modify: `src/components/Skeletons.tsx:112-117`

**Interfaces:**

- Consumes: nada.
- Produces: `SkeletonRanking` espelha a nova estrutura real (header → abas → tabela), mantendo CLS = 0 no primeiro load.

- [ ] **Step 1: Apagar o bloco "Pódio Top 3" do `SkeletonRanking`**

Remover integralmente (com o comentário):

```tsx
{
  /* Pódio Top 3 */
}
<div className="grid grid-cols-3 gap-2 items-end pt-2">
  <div className="h-32 rounded-[4px] border border-borda bg-superficie p-2.5 shadow-carimbo" />
  <div className="h-40 rounded-[4px] border-2 border-destaque/50 bg-superficie p-3 shadow-carimbo -translate-y-1" />
  <div className="h-28 rounded-[4px] border border-borda bg-superficie p-2.5 shadow-carimbo" />
</div>;
```

Os demais blocos do skeleton (header, abas, tabela) permanecem intocados.

### Task 3: Remover a utility CSS órfã `texto-vazado`

**Files:**

- Modify: `src/index.css:236-239`

**Interfaces:**

- Consumes: nada.
- Produces: nenhum seletor morto no CSS global.

- [ ] **Step 1: Apagar a utility**

```css
@utility texto-vazado {
  -webkit-text-stroke: 1.5px var(--cor-giz);
  color: transparent;
}
```

- [ ] **Step 2: Conferir que não há mais usos no projeto**

Run: `grep -rn "texto-vazado" src/`
Expected: zero ocorrências.

### Task 4: Atualizar os docs canônicos

**Files:**

- Modify: `AGENTS.md:122`, `AGENTS.md:160`, `design-system.md:271`

**Interfaces:**

- Consumes: estado final do código (Tasks 1-3).
- Produces: documentação sem referências pendentes ao pódio.

- [ ] **Step 1: `AGENTS.md` — comentário do diretório (linha 122)**

```text
│       ├── Ranking.tsx        # Tabela de classificação
```

- [ ] **Step 2: `AGENTS.md` — lista de cards semânticos (linha 160)**

Remover a menção ao Pódio da lista de exemplos:

```text
... reservados **apenas para destaques semânticos reais** (ex: Próxima Partida, Craque da Partida, Banners Push/Offline).
```

- [ ] **Step 3: `design-system.md` — exceção contextual (linha 271)**

O padrão "âmbar preenchido" continua existindo em botões/banners (`BotaoInstalar`, `CardNotificacoes`, `ConfirmDialog`), mas o exemplo do Pódio morre. Reescrever o item 3 do NÍVEL 3, mantendo o alinhamento da caixa ASCII:

```text
│ 3. Destaque âmbar preenchido para ações prioritárias (botões e banners). │
```

- [ ] **Step 4: Conferir que os docs não citam mais o pódio do ranking**

Run: `grep -rn -i "pódio" AGENTS.md design-system.md docs/`
Expected: zero ocorrências (ou apenas menções que não sejam o pódio do ranking).

### Task 5: Validação final (checklist AGENTS.md §11.2)

- [ ] **Step 1: Lint e tipos**

Run: `npm run lint`
Expected: 0 erros.

- [ ] **Step 2: Formatação**

Run: `npm run format`
Expected: nenhum diff pendente relevante (aceitar o output do Prettier).

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: `dist/` gerada sem falhas.

- [ ] **Step 4: Inspeção manual**

Rodar `npm run dev` e verificar:

1. `/ranking/pontos`, `/ranking/gols`, `/ranking/assistencias` e `/ranking/gols-contra` mostram a tabela direto após os filtros, sem pódio e sem separador `— classificação geral —`.
2. Primeiro load (hard refresh): o skeleton não exibe o bloco do pódio e não há salto de layout (CLS = 0).
3. O estado com menos de 3 linhas (ex.: filtro de posição com poucos atletas) continua igual ao comportamento atual — a tabela sempre renderizou sem pódio nesse caso.
4. O 🏆 da primeira linha da tabela permanece (decisão do usuário: manter — ver "Decisões" abaixo).
5. Tema claro e escuro: tabela e skeleton íntegros nos dois temas.

---

**Commit (apenas sob pedido do usuário):**

```bash
git add src/routes/Ranking.tsx src/components/Skeletons.tsx src/index.css AGENTS.md design-system.md
git commit
```

Mensagem sugerida (padrão do repositório: imperativo, sem prefixo):

```text
Remove pódio do topo das telas de ranking

O pódio Top 3 acima da tabela saía nas quatro métricas
(/ranking/pontos, gols, assistencias e gols-contra). A tabela
passa a ser a única classificação, com o skeleton e os docs
canônicos (AGENTS.md, design-system.md) alinhados à nova
estrutura. Utility CSS texto-vazado e o campo "unidade" do
config de métricas, que só o pódio consumia, foram removidos.
```

## Decisões em aberto

1. **🏆 da primeira linha da tabela** (`Ranking.tsx:498`): **recomendação manter** — está dentro da tabela, marca o líder e não faz parte do pódio removido. Alternativa: trocar por "1" para ficar 100% numérico.
2. **Separador de seção**: o pódio levava embora o `— classificação geral —`. **Recomendação não repor nada** — quando havia menos de 3 linhas, a tabela já renderizava colada nos filtros sem separador; sem pódio, esse passa a ser o estado padrão (menos um elemento, sem visual novo inventado).

## Fora do escopo

- "Destaques do ano" em `EstatisticasRacha.tsx` (não é o pódio do ranking; se também deve sair, é um pedido separado).
- Qualquer mudança de dados, view `ranking` ou queries — nada é afetado.
