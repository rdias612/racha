# Plano: Remoção do @ e do Avatar dos Jogadores

> **For agentic workers:** Implementar tarefa por tarefa com superpowers:executing-plans. Passos usam checkbox (`- [ ]`). Executor não commita por conta própria — commit apenas sob pedido do usuário (padrão de commit: título imperativo ≤72 chars, sem prefixos, descrição pt-BR).

**Goal:** Remover o prefixo `@` que antecede o nome/identificador de todos os jogadores e remover o ícone/avatar (o quadrado colorido com as iniciais do nome e badge da posição) em toda a aplicação. O sistema deve exibir sempre e exclusivamente o `username` puro dos jogadores em todas as telas, componentes, diálogos, tabelas e templates.

**Architecture:** Mudança 100% frontend e documentação. A tabela `jogadores` do Supabase e todas as RPCs já armazenam o username puro (ex.: `'danilo'`, `'dico'`), sem `@` ou iniciais pré-formatadas. A exibição de `@` e o bloco de `Avatar` eram construções exclusivamente visuais do cliente React. O componente `src/components/Avatar.tsx` torna-se 100% órfão e deve ser excluído (princípio *Zero Code Slop* do `AGENTS.md`). Os skeletons estruturais (`SkeletonRanking`, `SkeletonComparador`, `SkeletonPerfil`) devem ser atualizados em conjunto para garantir **Cumulative Layout Shift (CLS) = 0**.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, Vite, PWA. Sem alterações em SQL, migrations ou RPCs do backend.

**Commit-base auditado:** `b1247b1` (HEAD de `main` em 21/09/2026). Premissas verificadas contra o código atual:

- O componente `Avatar` existe em `src/components/Avatar.tsx` e é importado diretamente em 15 arquivos:
  - Rotas: `Ranking.tsx`, `Estatisticas.tsx`, `EstatisticasRacha.tsx`, `Comparador.tsx`, `Perfil.tsx`.
  - Componentes: `CardCraquePartida.tsx`, `CartaoJogadorEdicao.tsx`, `ConfirmacoesPartida.tsx`, `DuplaCard.tsx`, `GridTimesPartida.tsx`, `LinhaJogadorGestao.tsx`, `ListaNotasPartida.tsx`, `ModalEscalarJogador.tsx`, `ModalSelecionarGoleiro.tsx`, `SecaoNotificacaoSaude.tsx`.
  - Comentário de tipagem em `src/lib/notificacoes.ts`.
- O prefixo `@` é interpolado manualmente no JSX e em strings de template em 30 ocorrências de atletas/jogadores (ex.: `@{l.username}`, `@{craque.username}`, `@${resumo.artilheiro_username}`, `placeholder="Buscar por @username..."`, etc.).
- Os skeletons estruturais em `src/components/Skeletons.tsx` reproduzem as caixas do avatar no ranking (`size-6`), no comparador (`size-12`) e no perfil (`size-14`). Devem ser ajustados para espelhar fielmente a nova geometria com CLS = 0.
- A regra de domínio do projeto (`AGENTS.md`) proíbe a criação de novos testes automáticos neste momento — validação estritamente via `npx tsc -p tsconfig.app.json`, `npm run format`, `npm run build` e inspeção manual.
- Documentação canônica (`DESIGN.md`) lista `Avatar.tsx` em sua árvore de componentes e cita avatares na regra de cantos duros (`rounded-[3px]`), necessitando sincronização.

## Global Constraints

- **Tokens semânticos obrigatórios:** Não introduzir cores hardcodadas ou estilos arbitrários; manter o design system "Súmula de Quinta" (`text-giz`, `text-giz-fraco`, `bg-superficie`, `font-display`, etc.).
- **Zero code slop:** Apagar `Avatar.tsx` e qualquer utility/estilo que fique órfão (ex: wrappers de avatar duplo `-space-x-1.5`, anéis decorativos ao redor do avatar no card do craque, props obsoletas como `posicao` em `LadoDuelo`).
- **CLS = 0:** Ajustar skeletons para que nenhum elemento salte no primeiro carregamento.
- **Acessibilidade preservada:** Atualizar `aria-label`, títulos e mensagens acessíveis retirando o `@`.
- **Sem testes automáticos:** Não criar novos arquivos de testes (regra explícita de `AGENTS.md`).
- **Commit único sob demanda:** Não commitar automaticamente; sugerir a mensagem no final.

---

### Task 1: Ranking de Atletas e Skeleton

**Files:**
- Modify: `src/routes/Ranking.tsx`
- Modify: `src/components/Skeletons.tsx`

**Interfaces:**
- Consumes: `l.username` diretamente.
- Produces: Linha da tabela de classificação contendo apenas a posição numérica (ou 🏆) e o username em texto puro, sem o bloco `Avatar` e sem o caractere `@`.

- [x] **Step 1: Remover import do `Avatar` e limpar célula de atleta em `Ranking.tsx`**

Na linha 12 de `src/routes/Ranking.tsx`, remover o import:
```tsx
import { Avatar } from '../components/Avatar';
```

Nas linhas 413-417 de `src/routes/Ranking.tsx`, substituir:
```tsx
{coluna.key === 'username' ? (
  <div className="flex items-center gap-2">
    <Avatar username={l.username} posicao={l.posicao} size="xs" />
    <span className="font-bold">@{l.username}</span>
  </div>
) : ...
```
Por:
```tsx
{coluna.key === 'username' ? (
  <span className="font-bold text-giz">{l.username}</span>
) : ...
```

- [x] **Step 2: Ajustar `SkeletonRanking` em `src/components/Skeletons.tsx`**

Nas linhas 116-120 de `src/components/Skeletons.tsx`:
```tsx
<div className="flex items-center gap-3">
  <div className="size-4 bg-superficie-2 rounded-[2px]" />
  <div className="size-6 bg-superficie-2 rounded-[3px]" />
  <div className="h-3.5 w-24 bg-superficie-2 rounded-[2px]" />
</div>
```
Remover o bloco `<div className="size-6 bg-superficie-2 rounded-[3px]" />` (avatar `size="xs"`):
```tsx
<div className="flex items-center gap-3">
  <div className="size-4 bg-superficie-2 rounded-[2px]" />
  <div className="h-3.5 w-24 bg-superficie-2 rounded-[2px]" />
</div>
```

- [x] **Step 3: Verificação de `Ranking.tsx`**
Run: `git grep -n "Avatar\|@" src/routes/Ranking.tsx`
Expected: zero ocorrências.

---

### Task 2: Estatísticas, Destaques e Histórico de Parcerias

**Files:**
- Modify: `src/routes/Estatisticas.tsx`
- Modify: `src/routes/EstatisticasRacha.tsx`
- Modify: `src/components/DuplaCard.tsx`
- Modify: `src/routes/Resumo.tsx`

**Interfaces:**
- Consumes: dados das RPCs de estatísticas e resumo.
- Produces: Cards e tabelas exibindo apenas os usernames dos atletas sem avatares e sem `@`.

- [x] **Step 1: Limpar `src/routes/Estatisticas.tsx`**

1. Remover `import { Avatar } from '../components/Avatar';` (linha 17).
2. Linha 166 (cabeçalho): alterar de `Estatísticas{usernameSelecionado ? \` · @\${usernameSelecionado}\` : ''}` para `Estatísticas{usernameSelecionado ? \` · \${usernameSelecionado}\` : ''}`.
3. Linha 192 (dropdown de atleta): alterar de `@{j.username}` para `{j.username}`.
4. Linhas 340-348 (card `DestaqueIndividual`): remover `<Avatar username={destaque.username} size="sm" />` e alterar `@{destaque.username}` para `{destaque.username}`.
5. Linhas 381-389 (card `ParceriaCard`): remover `<Avatar username={parceria.username} size="sm" />` e alterar `@{parceria.username}` para `{parceria.username}`.

- [x] **Step 2: Limpar `src/routes/EstatisticasRacha.tsx`**

1. Remover `import { Avatar } from '../components/Avatar';` (linha 8).
2. Linhas 297-305 (tabela de parcerias da temporada):
Substituir:
```tsx
<div className="flex items-center gap-2">
  <div className="flex -space-x-1.5 shrink-0">
    <Avatar username={par.jogador_a_username} size="xs" />
    <Avatar username={par.jogador_b_username} size="xs" />
  </div>
  <span>
    @{par.jogador_a_username} + @{par.jogador_b_username}
  </span>
</div>
```
Por:
```tsx
<div className="flex items-center gap-2">
  <span>
    {par.jogador_a_username} + {par.jogador_b_username}
  </span>
</div>
```

- [x] **Step 3: Limpar `src/components/DuplaCard.tsx`**

1. Remover `import { Avatar } from './Avatar';` (linha 2).
2. Linhas 42-50:
Substituir:
```tsx
<div className="flex items-center gap-2">
  <div className="flex -space-x-1.5 shrink-0">
    <Avatar username={par.jogador_a_username} size="xs" />
    <Avatar username={par.jogador_b_username} size="xs" />
  </div>
  <span className="truncate text-xs sm:text-sm font-bold text-giz">
    @{par.jogador_a_username} + @{par.jogador_b_username}
  </span>
</div>
```
Por:
```tsx
<div className="flex items-center gap-2">
  <span className="truncate text-xs sm:text-sm font-bold text-giz">
    {par.jogador_a_username} + {par.jogador_b_username}
  </span>
</div>
```

- [x] **Step 4: Limpar `src/routes/Resumo.tsx`**

Nas linhas 77, 84, 91, 98, 105-107 e 114 (cards de destaques da temporada):
Remover o `@` que precede os usernames nos campos `nome`:
- `nome: resumo.artilheiro_username ?? null,`
- `nome: resumo.maestro_username ?? null,`
- `nome: resumo.participante_username ?? null,`
- `nome: resumo.eficiente_username ?? null,`
- `nome: resumo.sequencia_vitorias_username ?? null,`
- `nome: resumo.seca_vitorias_username ?? null,`

- [x] **Step 5: Verificação do módulo de estatísticas**
Run: `git grep -n "Avatar" src/routes/Estatisticas.tsx src/routes/EstatisticasRacha.tsx src/components/DuplaCard.tsx`
Expected: zero ocorrências.

---

### Task 3: Confronto Direto (Comparador) e Skeleton

**Files:**
- Modify: `src/routes/Comparador.tsx`
- Modify: `src/components/Skeletons.tsx`

**Interfaces:**
- Consumes: lista de atletas e dados comparativos da RPC.
- Produces: Card de duelo e confrontos diretos com exibição textual centrada do username, sem avatares, sem prop órfã `posicao` e sem `@`.

- [x] **Step 1: Limpar `src/routes/Comparador.tsx`**

1. Remover `import { Avatar } from '../components/Avatar';` (linha 23).
2. Linha 83 (`primeiroNomeVencedor`): alterar de `return \`@\${username}\`;` para `return username;`.
3. Linhas 244 e 262 (chamadas do `LadoDuelo` no Card do Duelo):
Remover a prop órfã `posicao`:
```tsx
<LadoDuelo username={usernameA} />
...
<LadoDuelo username={usernameB} />
```
4. Linhas 284 e 306 (opções dos selects Atleta A e Atleta B): alterar de `@{j.username}` para `{j.username}`.
5. Linhas 464-473 (`LadoDuelo`):
Eliminar a prop `posicao` e o componente `Avatar`:
```tsx
function LadoDuelo({ username }: { username: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center py-2">
      <span className="w-full truncate text-center font-display text-base font-bold uppercase tracking-wider text-giz">
        {username}
      </span>
    </div>
  );
}
```
6. Linhas 533-540 (`LinhaAtletaConfronto`):
Remover `<Avatar username={username} size="sm" />` e alterar `{username === '—' ? '—' : \`@\${username}\`}` para `{username}`.

- [x] **Step 2: Ajustar `SkeletonComparador` em `src/components/Skeletons.tsx` mantendo CLS = 0**

No card real (`Comparador.tsx`), o centro contém o caractere `×` + botão de inverter `min-h-[44px]`, totalizando ~92px com o padding `p-3`. Por isso, a altura do contêiner `h-24` (96px) e o botão central `size-11` (44px) devem ser mantidos para garantir **CLS = 0**.
Nas linhas 196-201 de `src/components/Skeletons.tsx`:
```tsx
{/* Card do Duelo (avatar A + swap + avatar B) */}
<div className="h-24 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo flex items-center justify-between">
  <div className="size-12 rounded-[3px] bg-superficie-2 border border-borda" />
  <div className="size-11 rounded-[4px] bg-superficie-2 border border-borda" />
  <div className="size-12 rounded-[3px] bg-superficie-2 border border-borda" />
</div>
```
Substituir os dois blocos de avatar `size-12` por placeholders horizontais de username (`h-5 w-24`):
```tsx
{/* Card do Duelo (nome A + swap + nome B) */}
<div className="h-24 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo flex items-center justify-between">
  <div className="h-5 w-24 rounded-[2px] bg-superficie-2 border border-borda" />
  <div className="size-11 rounded-[4px] bg-superficie-2 border border-borda" />
  <div className="h-5 w-24 rounded-[2px] bg-superficie-2 border border-borda" />
</div>
```

- [x] **Step 3: Verificação de `Comparador.tsx`**
Run: `git grep -n "Avatar" src/routes/Comparador.tsx`
Expected: zero ocorrências.

---

### Task 4: Perfil do Jogador e Skeleton

**Files:**
- Modify: `src/routes/Perfil.tsx`
- Modify: `src/components/Skeletons.tsx`

**Interfaces:**
- Consumes: dados do jogador da sessão autenticada.
- Produces: Cabeçalho de perfil limpo com apenas o username e informações de mensalista/posição, sem o avatar grande.

- [x] **Step 1: Limpar `src/routes/Perfil.tsx`**

1. Remover `import { Avatar } from '../components/Avatar';` (linha 16).
2. Linha 106 (mensagem de sucesso de troca de username):
Alterar:
```tsx
setOkUsername('Usuário alterado com sucesso. Use @' + limpo + ' no próximo login.');
```
Para:
```tsx
setOkUsername('Usuário alterado com sucesso. Use ' + limpo + ' no próximo login.');
```
3. Linhas 198-218 (Cartão de Identidade do Jogador):
Remover `<Avatar username={jogador.username} posicao={jogador.posicao} size="lg" />`.
Na linha 204, alterar `@{jogador.username}` para `{jogador.username}`.
4. Linha 243 (label de edição): alterar de `Nome de Usuário (@)` para `Nome de Usuário`.

- [x] **Step 2: Ajustar `SkeletonPerfil` em `src/components/Skeletons.tsx`**

Nas linhas 265-272 de `src/components/Skeletons.tsx`:
```tsx
{/* Header com avatar */}
<div className="flex items-center gap-4 p-4 rounded-[4px] border border-borda bg-superficie shadow-carimbo">
  <div className="size-14 rounded-[4px] bg-superficie-2 border border-borda" />
  <div className="space-y-2 flex-1">
    <div className="h-5 w-36 bg-superficie-2 rounded-[2px]" />
    <div className="h-3 w-24 bg-superficie-2 rounded-[2px]" />
  </div>
</div>
```
Remover o bloco `<div className="size-14 rounded-[4px] bg-superficie-2 border border-borda" />`:
```tsx
{/* Header do perfil */}
<div className="p-4 rounded-[4px] border border-borda bg-superficie shadow-carimbo space-y-2">
  <div className="h-6 w-40 bg-superficie-2 rounded-[2px]" />
  <div className="h-3 w-28 bg-superficie-2 rounded-[2px]" />
</div>
```

- [x] **Step 3: Verificação de `Perfil.tsx`**
Run: `git grep -n "Avatar" src/routes/Perfil.tsx`
Expected: zero ocorrências.

---

### Task 5: Componentes de Partida e Escalação

**Files:**
- Modify: `src/components/CardCraquePartida.tsx`
- Modify: `src/components/CartaoJogadorEdicao.tsx`
- Modify: `src/components/ConfirmacoesPartida.tsx`
- Modify: `src/components/GridTimesPartida.tsx`
- Modify: `src/components/ListaNotasPartida.tsx`
- Modify: `src/components/ModalEscalarJogador.tsx`
- Modify: `src/components/ModalSelecionarGoleiro.tsx`
- Modify: `src/routes/PartidaAoVivo.tsx`
- Modify: `src/routes/PartidaEditar.tsx`
- Modify: `src/routes/PartidaNova.tsx`
- Modify: `src/routes/PartidaVotar.tsx`
- Modify: `src/hooks/useEscalacaoTimes.ts`

- [x] **Step 1: `CardCraquePartida.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Remover o contêiner do avatar (linhas 27-29: `<div className="ring-2 ring-destaque ring-offset-2 ring-offset-superficie rounded-[3px]"><Avatar ... /></div>`).
3. Linha 19: alterar `className="text-right"` para `className="text-center"` (centralizar a nota e votos após a remoção do avatar lateral).
4. Linha 33: alterar `@{craque.username}` para `{craque.username}`.

- [x] **Step 2: `CartaoJogadorEdicao.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Remover `<Avatar username={p.username ?? ''} size="sm" />` (linha 39).
3. Linha 43: alterar `{p.username ? \`@\${p.username}\` : \`#\${p.jogador_id}\`}` para `{p.username || \`#\${p.jogador_id}\`}`.

- [x] **Step 3: `ConfirmacoesPartida.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Remover `<Avatar username={p.username ?? ''} size="xs" />` (linha 297).
3. Remover `<Avatar username={j.username} size="xs" />` (linha 361).

- [x] **Step 4: `GridTimesPartida.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Linhas 40-43: remover `<Avatar username={p.username ?? ''} posicao={p.posicao} size="xs" />` e alterar `{p.username ? \`@\${p.username}\` : \`#\${p.jogador_id}\`}` para `{p.username || \`#\${p.jogador_id}\`}`.

- [x] **Step 5: `ListaNotasPartida.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Remover `<Avatar username={n.username} size="xs" />` (linha 28).
3. Linha 30: alterar `{n.is_craque ? '⭐ ' : ''}@{n.username}` para `{n.is_craque ? '⭐ ' : ''}{n.username}`.

- [x] **Step 6: `ModalEscalarJogador.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Linha 70: alterar `placeholder="Buscar por @username..."` para `placeholder="Buscar por username..."`.
3. Linha 111: remover `<Avatar username={j.username} size="sm" />`.
4. Linha 113: alterar `@{j.username}` para `{j.username}`.

- [x] **Step 7: `ModalSelecionarGoleiro.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Linha 129: remover `<Avatar nome={g.username} posicao="goleiro" size="sm" />`.

- [x] **Step 8: `PartidaAoVivo.tsx`, `PartidaEditar.tsx`, `PartidaNova.tsx`, `PartidaVotar.tsx` e `useEscalacaoTimes.ts`**
1. `PartidaAoVivo.tsx:38`: alterar `return username ? \`@\${username}\` : \`#\${jogadorId}\`;` para `return username || \`#\${jogadorId}\`;`.
2. `PartidaEditar.tsx:372`: alterar `titulo={\`Remover \${jogadorParaRemover?.username ? \`@\${jogadorParaRemover.username}\` : 'jogador'}?\`}` para `titulo={\`Remover \${jogadorParaRemover?.username || 'jogador'}?\`}`.
3. `PartidaNova.tsx:240`: alterar `placeholder="Buscar atleta por @username..."` para `placeholder="Buscar atleta por username..."`.
4. `PartidaVotar.tsx:345`: alterar `@{a.username}` para `{a.username}`.
5. `useEscalacaoTimes.ts:55`: alterar `\`Cada time só pode ter 1 goleiro. @\${jogador.username} não pode ir para o \${...}\`` para `\`Cada time só pode ter 1 goleiro. \${jogador.username} não pode ir para o \${...}\``.

---

### Task 6: Gestão de Jogadores, Painel Admin e Módulo Financeiro

**Files:**
- Modify: `src/components/LinhaJogadorGestao.tsx`
- Modify: `src/components/ListaReceitasAbertas.tsx`
- Modify: `src/components/ListaDespesasAbertas.tsx`
- Modify: `src/components/FormEventoAutomatico.tsx`
- Modify: `src/components/FormLancamentoFinanceiro.tsx`
- Modify: `src/components/SecaoNotificacaoSaude.tsx`
- Modify: `src/routes/GestaoJogadores.tsx`
- Modify: `src/routes/GestaoGoleiros.tsx`
- Modify: `src/routes/Administrador.tsx`
- Modify: `src/routes/NovoJogador.tsx`
- Modify: `src/lib/dividas.ts`
- Modify: `src/lib/exportacao.ts`
- Modify: `src/lib/notificacoes.ts`
- Modify: `src/components/CampoBusca.tsx`

- [ ] **Step 1: `LinhaJogadorGestao.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Linha 44: remover `<Avatar username={j.username} posicao={j.posicao} size="md" />`.
3. Linha 48: alterar `@{j.username}` para `{j.username}`.

- [ ] **Step 2: `ListaReceitasAbertas.tsx` e `ListaDespesasAbertas.tsx`**
1. `ListaReceitasAbertas.tsx:52`: remover `@` do aviso de lembrete WhatsApp (`Lembrete para \${g.username}...`).
2. `ListaReceitasAbertas.tsx:105`: alterar `@{g.username}` para `{g.username}`.
3. `ListaReceitasAbertas.tsx:124`: remover `@` do `aria-label` (`Copiar cobrança de \${g.username} para WhatsApp`).
4. `ListaDespesasAbertas.tsx:41`: alterar `@\${d.jogadores.username}` para `d.jogadores.username`.

- [ ] **Step 3: `FormEventoAutomatico.tsx` e `FormLancamentoFinanceiro.tsx`**
1. `FormEventoAutomatico.tsx:96`: alterar `label: \`@\${j.username}\`` para `label: j.username`.
2. `FormLancamentoFinanceiro.tsx:138`: alterar `label: \`@\${j.username}\${...}\`` para `label: \`\${j.username}\${...}\``.

- [ ] **Step 4: `SecaoNotificacaoSaude.tsx`**
1. Remover `import { Avatar } from './Avatar';`.
2. Linha 120: remover `<Avatar username={r.username} posicao={r.posicao} size="sm" />`.

- [ ] **Step 5: `GestaoJogadores.tsx` e `NovoJogador.tsx`**
1. `GestaoJogadores.tsx:165`: remover `@` da notificação (`"@${jOriginal.username}"` -> `"${jOriginal.username}"`).
2. `GestaoJogadores.tsx:200`: remover `@` da notificação (`"@${jOriginal.username}"` -> `"${jOriginal.username}"`).
3. `GestaoJogadores.tsx:241`: remover `@` do snackbar (`Senha de \${alvoReset.username} resetada...`).
4. `GestaoJogadores.tsx:316`: alterar `placeholder="Buscar por @usuário..."` para `placeholder="Buscar por usuário..."`.
5. `GestaoJogadores.tsx:413`: remover `@` da mensagem de confirmação de reset.
6. `NovoJogador.tsx:71`: remover `@` da mensagem de sucesso (`Jogador "${usernameLimpo}" criado com sucesso!`).
7. `NovoJogador.tsx:121`: alterar label `Nome de Usuário (@username) *` para `Nome de Usuário *`.

- [ ] **Step 6: `GestaoGoleiros.tsx` e `Administrador.tsx`**
1. `GestaoGoleiros.tsx:154`: remover `@` do snackbar (`Goleiro \${goleiro.username}...`).
2. `GestaoGoleiros.tsx:257`: alterar `@{g.username}` para `{g.username}`.
3. `GestaoGoleiros.tsx:291, 306, 413, 450, 451`: remover `@` de todos os `aria-label`s e diálogos de confirmação.
4. `Administrador.tsx:135, 175, 184`: remover `@` das mensagens de confirmação de quitação e do snackbar de sucesso.

- [ ] **Step 7: `dividas.ts`, `exportacao.ts`, `notificacoes.ts` e `CampoBusca.tsx`**
1. `src/lib/dividas.ts:168`: template do WhatsApp: alterar `Fala @\${g.username}!` para `Fala \${g.username}!`.
2. `src/lib/exportacao.ts:34`: alterar `@\${l.jogadores.username}` para `l.jogadores.username`.
3. `src/lib/notificacoes.ts:127`: atualizar comentário que fazia referência ao Avatar.
4. `src/components/CampoBusca.tsx:25`: atualizar comentário JSDoc.

---

### Task 7: Exclusão do Componente Órfão `Avatar.tsx` e Atualização de `DESIGN.md`

**Files:**
- Delete: `src/components/Avatar.tsx`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: nada.
- Produces: exclusão limpa do arquivo sem código morto no bundle final e alinhamento do doc canônico de arquitetura.

- [ ] **Step 1: Excluir o arquivo `src/components/Avatar.tsx`**
Comando: `git rm src/components/Avatar.tsx`

- [ ] **Step 2: Atualizar a documentação canônica em `DESIGN.md`**
1. Linha 81: remover a linha `│   │   ├── Avatar.tsx         # Avatar quadrado terroso com plaqueta de posição`.
2. Linha 167: remover a menção a `(avatares)` na definição de cantos duros (`rounded-[3px]`).

- [ ] **Step 3: Conferir ausência de referências órfãs a `Avatar` em `src/`**
Run: `git grep -n "Avatar" src/`
Expected: zero ocorrências.

---

### Task 8: Validação Final e Checklist de Qualidade

- [ ] **Step 1: Checagem estática de tipos**
Run: `npx tsc -p tsconfig.app.json`
Expected: zero erros de compilação.

- [ ] **Step 2: Formatação com Prettier**
Run: `npm run format`
Expected: arquivos formatados de acordo com o padrão do repositório.

- [ ] **Step 3: Build de produção**
Run: `npm run build`
Expected: pasta `dist/` gerada com sucesso sem avisos de módulos não encontrados.

- [ ] **Step 4: Inspeção manual dos fluxos da aplicação (`npm run dev`)**
1. **Tabela de Ranking (`/ranking/pontos`)**: conferir que a coluna "Atleta" exibe apenas o username (ex: `Danilo`, `Dico`, `Fil`), sem o `@` e sem o quadrado de iniciais/posição.
2. **Hard Refresh no Ranking**: verificar que o skeleton da tabela carrega sem salto visual (CLS = 0).
3. **Estatísticas e Comparador (`/estatisticas`)**: verificar cards de destaques, dropdowns de atletas e card do duelo sem avatar e sem `@`.
4. **Perfil (`/perfil`)**: verificar cabeçalho limpo com nome do usuário e dados de plano/posição.
5. **Súmula Ao Vivo e Votação (`/jogos/:id/ao-vivo`, `/jogos/:id/votar`)**: verificar que a cédula e o card do Craque exibem apenas o username de forma centralizada.
6. **Gestão e Financeiro (`/administrador`, `/jogadores`)**: verificar listas, selects de lançamentos, formulários e lembretes de cobrança no WhatsApp sem `@`.

---

**Commit sugerido (apenas sob solicitação do usuário):**

```bash
git add -u
git rm src/components/Avatar.tsx
git add docs/plano-remocao-arroba-avatar-jogadores.md
git commit
```

Mensagem de commit:
```text
Remove @ e avatar de inicial dos jogadores

Remove o prefixo @ e o componente de Avatar em toda a interface do
aplicativo, exibindo unicamente o username dos atletas. Os skeletons
foram adaptados para garantir CLS zero, o arquivo Avatar.tsx foi
excluído por se tornar obsoleto e o DESIGN.md foi sincronizado.
```
