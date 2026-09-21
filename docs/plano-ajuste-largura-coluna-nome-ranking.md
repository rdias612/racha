# Plano: Ajuste da Largura da Coluna de Atletas no Ranking Mobile

> **Para executores:** Implementar tarefa por tarefa. Passos usam checkbox (`- [ ]`). O executor não commita por conta própria — commit apenas sob pedido do usuário (padrão de commit: título imperativo ≤72 chars, sem prefixos, descrição em pt-BR).

**Objetivo:** Nas telas de ranking (`/ranking/pontos`, `/ranking/gols`, `/ranking/assistencias`, `/ranking/gols-contra`), ajustar a largura da coluna do nome dos jogadores ("Atleta") para que ela ocupe exatamente o tamanho máximo dos nomes presentes na tabela, eliminando o excesso de espaço em branco no celular e permitindo que as colunas numéricas fiquem visíveis com o mínimo de rolagem horizontal.

**Arquitetura:** Mudança 100% frontend em `src/routes/Ranking.tsx` (e validação de harmonia visual em `src/components/Skeletons.tsx`). Sem alterações em banco de dados, sem migrations, sem novas dependências.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4, HTML5 Table Layout.

---

## 1. Diagnóstico do Problema Atual

Ao inspecionar `src/routes/Ranking.tsx` (linhas 358–434) e realizar medições de viewport mobile (360px, 375px, 390px, 412px):

1. **Herança de `sm:min-w-44` (`Ranking.tsx:375`):**

   ```tsx
   ehAtleta ? 'w-px whitespace-nowrap text-left sm:min-w-44' : 'text-right';
   ```
   - A classe `sm:min-w-44` impõe `min-width: 11rem` (**176px**).
   - Esse valor era resquício da época em que cada linha continha um componente `<Avatar />` + `@` + `username`. Com a remoção do avatar e do `@` (concluída na refatoração anterior), os nomes dos jogadores (ex: `fil`, `dico`, `danilo`, `marcelinho`) ocupam entre 35px e 75px.
   - Em telas com largura `>= 640px` (como celulares em modo paisagem, tablets, telas dobráveis ou celulares com densidade de tela configurada para zoom pequeno), a coluna fica com **176px**, gerando mais de **100px de espaço vazio**.

2. **Assimetria de `w-px` entre `<th>` e `<td>`:**
   - O `<th>` possui `w-px`, mas os `<td>` correspondentes (`Ranking.tsx:413-416`) possuem apenas:
     ```tsx
     coluna.key === 'username'
       ? 'whitespace-nowrap text-giz font-medium text-xs'
       : ...
     ```
   - Em motores de renderização WebKit (Safari no iOS) e Blink (Chrome), quando a tabela possui largura total (`w-full`) ou largura mínima forçada, o algoritmo de tabela distribui o espaço excedente entre as colunas cujas células `<td>` não possuem restrição explícita de largura. Isso faz com que a coluna de texto absorva espaço desnecessário.

3. **Impacto de `min-w-120` na `<table>` (`Ranking.tsx:358`):**
   ```tsx
   <table className="w-full min-w-120 text-sm">
   ```
   - `min-w-120` força a tabela a ter no mínimo **480px** (`120 * 0.25rem`).
   - Em celulares com tela de 360px a 390px (largura útil de ~336px a 366px devido ao padding da página `px-3`), essa largura mínima de 480px gera cerca de **130px de rolagem horizontal desnecessária**.
   - Testes empíricos demonstraram que, com a coluna de atleta compactada ao tamanho do maior nome, o ranking de pontos (`#`, `Atleta`, `PTS`, `%V`, `J`, `V`, `E`, `D`) ocupa apenas **~349px**, cabendo perfeitamente em um iPhone (375px+) **sem rolagem horizontal alguma**.

---

## 2. Abordagem Proposta

### Abordagem Principal: CSS Nativo de Tabela (KISS / DRY / Recomendada)

O comportamento padrão de algoritmos de tabela HTML (CSS 2.1 / CSS Table Module Level 3) para colunas que devem ser dimensionadas exatamente pelo seu maior conteúdo (`shrink-to-fit` / `max-content`) é:

1. **Remover `sm:min-w-44`** do `<th>` da coluna Atleta.
2. **Aplicar `w-px` em ambos (`<th>` e `<td>`):**
   - Ao definir `w-px` (largura preferencial mínima de 1px) associado a `whitespace-nowrap` tanto no cabeçalho quanto em todas as células da coluna, o navegador calcula a largura da coluna estritamente pelo seu `max-content` (o maior nome presente na tabela ou o rótulo "Atleta ↕", o que for maior), impedindo que a coluna receba qualquer sobra de largura.
3. **Ajustar a largura mínima da tabela:**
   - Substituir `min-w-120` (480px) por `min-w-full text-sm` (ou remover `min-w-120` mantendo `w-full text-sm`).
   - O contêiner pai já possui `overflow-x-auto`, garantindo rolagem suave caso surjam nomes atipicamente longos ou na aba `/ranking/gols` (que possui a coluna adicional "Média"), sem forçar 480px artificiais quando não necessário.

---

## 3. Plano de Implementação

### Task 1: Ajustar classes da coluna "Atleta" e tabela em `src/routes/Ranking.tsx`

**Arquivo:** `src/routes/Ranking.tsx`

- [x] **Step 1: Ajustar a tag `<table>`**
  - Localizar `Ranking.tsx:358`:
    ```tsx
    // Antes:
    <table className="w-full min-w-120 text-sm">

    // Depois:
    <table className="w-full min-w-full text-sm">
    ```

- [x] **Step 2: Remover `sm:min-w-44` do `<th>` da coluna `username`**
  - Localizar `Ranking.tsx:374-376`:
    ```tsx
    // Antes:
    className={`p-0 font-display font-bold uppercase tracking-wider text-xs ${
      ehAtleta ? 'w-px whitespace-nowrap text-left sm:min-w-44' : 'text-right'
    }`}

    // Depois:
    className={`p-0 font-display font-bold uppercase tracking-wider text-xs ${
      ehAtleta ? 'w-px whitespace-nowrap text-left' : 'text-right'
    }`}
    ```

- [x] **Step 3: Aplicar `w-px` no `<td>` da coluna `username`**
  - Localizar `Ranking.tsx:412-416`:
    ```tsx
    // Antes:
    className={`px-2 py-2 ${
      coluna.key === 'username'
        ? 'whitespace-nowrap text-giz font-medium text-xs'
        : 'text-right font-mono text-xs text-giz tabular-nums font-semibold'
    }`}

    // Depois:
    className={`px-2 py-2 ${
      coluna.key === 'username'
        ? 'w-px whitespace-nowrap text-giz font-medium text-xs'
        : 'text-right font-mono text-xs text-giz tabular-nums font-semibold'
    }`}
    ```

- [x] **Step 4: Verificar o botão de ordenação do cabeçalho da coluna `username`**
  - Em `Ranking.tsx:381-383`:
    ```tsx
    className={`w-full min-h-[44px] px-2 py-2 inline-flex items-center gap-1 cursor-pointer select-none transition ${
      ehAtleta ? 'justify-start' : 'justify-end'
    } ${ativa ? 'text-destaque-texto font-black' : 'hover:text-giz'}`}
    ```
    - Mantida a área de toque acessível (`min-h-[44px] px-2 py-2`), com alinhamento à esquerda e largura compactada.

---

### Task 2: Verificação do Skeleton de Carregamento

**Arquivo:** `src/components/Skeletons.tsx`

- [x] **Step 1: Inspecionar `SkeletonRanking`**
  - Placeholders do skeleton (`Skeletons.tsx:113-123`) usam flex layout com largura de placeholder `w-24`, mantendo harmonia com o layout e CLS = 0.

---

## 4. Plano de Verificação

### 4.1 Checagens Automatizadas

1. **Compilação TypeScript:**

   ```bash
   npx tsc -b
   ```

   Esperado: 0 erros.

2. **Linting e Formatação:**

   ```bash
   npm run lint
   npm run format:check
   ```

   Esperado: sem violações.

3. **Build de Produção:**
   ```bash
   npm run build
   ```
   Esperado: pasta `dist/` gerada com sucesso.

### 4.2 Validação Manual e Visual

Testar a aplicação (`npm run dev`) emulando diferentes tamanhos de viewport mobile pelo DevTools (ou dispositivo real):

1. **iPhone SE / Telas estreitas (360px - 375px):**
   - Acessar `/ranking/pontos`.
   - Verificar que a coluna "Atleta" termina imediatamente após o nome mais longo (ex: `marcelinho` ou `danilo`), sem espaço em branco sobrando à direita dos nomes.
   - Conferir que as colunas numéricas (`PTS`, `%V`, `J`, `V`, `E`, `D`) se aproximam dos nomes, eliminando a rolagem horizontal ou reduzindo-a ao mínimo estritamente necessário.
2. **Outras telas de ranking:**
   - Acessar `/ranking/gols`, `/ranking/assistencias` e `/ranking/gols-contra`.
   - Conferir que o comportamento se mantém idêntico e consistente em todas as 4 rotas.
3. **Filtro de Posição:**
   - Selecionar o filtro "Goleiro", "Zagueiro", "Meia" e "Atacante".
   - Conferir que a largura da coluna se reajusta dinamicamente ao maior nome visível daquele filtro específico.
4. **Desktop / Telas amplas (> 640px):**
   - Conferir que a tabela se expande suavemente no contêiner `max-w-2xl`, distribuindo o espaço nas colunas de dados e mantendo a coluna de atletas legível e alinhada sem distorções.
