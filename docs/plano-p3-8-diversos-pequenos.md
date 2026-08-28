# 📋 Plano de Implementação: P3-8 — Diversos Pequenos

> **Item da Auditoria**: `P3-8` de [`docs/plano-refatoracoes.md`](./plano-refatoracoes.md)  
> **Status**: Proposto / Planejamento Arquitetural (Auditado e Aprovado por Subagentes)  
> **Fontes Canônicas**: [`AGENTS.md`](../AGENTS.md) e [`design-system.md`](../design-system.md)  
> **Escopo**: 13 melhorias pontuais em componentes, hooks, bibliotecas de domínio (`src/lib/`), service worker (`public/sw.js`) e shell HTML (`index.html`).

---

## 🎯 1. Visão Geral e Racional

O item **P3-8** consolida um conjunto de pequenos refinamentos técnicos, correções de camadas arquiteturais, limpeza de constantes duplicadas, conformidade com o Design System "Súmula de Quinta" e robustez de ciclo de vida (PWA, Service Worker, gerenciamento de sessão e resiliência mobile).

Embora cada item individual tenha escopo reduzido, a execução conjunta eleva substancialmente a solidez do código, elimina armadilhas sutis em navegadores móveis (como Safari em modo privado) e fecha lacunas de camadas entre rotas, componentes e bibliotecas.

---

## 🛠️ 2. Detalhamento dos 13 Itens Técnicos

---

### Item 1. `src/components/ModalNovoGoleiro.tsx` — Reset Defensivo de Estado ao Abrir/Fechar

- **Problema**: Se o usuário preencher dados parciais no formulário de novo goleiro e cancelar/fechar o modal, os campos `nome`, `telefone`, `chavePix` e `erro` permanecem no estado interno do componente, reaparecendo na próxima abertura.
- **Refatoração**:
  - Adicionar sincronização defensiva que reseta o estado local sempre que `open` transicionar para `false` ou quando o modal for aberto:
    ```tsx
    useEffect(() => {
      if (!open) {
        setNome('');
        setTelefone('');
        setChavePix('');
        setErro(null);
      }
    }, [open]);
    ```

---

### Item 2. `src/hooks/useSwipeTabs.ts` — Memoização dos `handlers` de Touch

- **Problema**: Nas linhas 161-170, o hook retorna um novo objeto e um novo sub-objeto `handlers` a cada ciclo de render do componente consumidor, quebrando referências estáveis de props e disparando re-renderizações desnecessárias em elementos touch.
- **Refatoração**:
  - Envolver o objeto de retorno em `useMemo`:
    ```tsx
    return useMemo(
      () => ({
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        handlers: {
          onTouchStart: handleTouchStart,
          onTouchMove: handleTouchMove,
          onTouchEnd: handleTouchEnd,
        },
      }),
      [handleTouchStart, handleTouchMove, handleTouchEnd]
    );
    ```

---

### Item 3. `src/components/DuplaCard.tsx` — Eliminação da Inversão de Camadas

- **Problema**: `src/components/DuplaCard.tsx:2` importa o tipo `ColunaOrdenacaoDuplas` diretamente de `../routes/EstatisticasRacha`, caracterizando inversão de dependência (componente reutilizável dependendo de uma rota específica).
- **Refatoração**:
  - Mover a união canônica completa `ColunaOrdenacaoDuplas` para `src/lib/partidas.ts`:
    ```typescript
    export type ColunaOrdenacaoDuplas = 'pontos' | 'percentual' | 'partidas' | 'vitorias' | 'dupla';
    ```
  - Atualizar os imports em `src/components/DuplaCard.tsx` e `src/routes/EstatisticasRacha.tsx` para importar de `src/lib/partidas.ts`.

---

### Item 4. `src/components/DialogoEvento.tsx` — Ajuste Geométrico Canônico de Cantos

- **Problema**: Na linha 73 de `src/components/DialogoEvento.tsx`, a classe `rounded-t-[8px]` excede o teto geométrico estrito definido no [`design-system.md`](../design-system.md) (máximo permitido de `rounded-[6px]`).
- **Refatoração**:
  - Substituir `rounded-t-[8px]` por `rounded-t-[6px]`, alinhando perfeitamente a prancheta de diálogo aos tokens de cantos duros da estética "Súmula de Quinta".

---

### Item 5. `src/lib/tema.ts` — Resiliência no `localStorage` e Meta Theme-Color

- **Problema**: Chamadas ao `localStorage.setItem` em navegadores com restrição estrita de privacidade (como Safari no modo de navegação anônima) podem lançar exceção `QuotaExceededError` / `SecurityError`.
- **Refatoração**:
  - Garantir tratamento com `try/catch` defensivo em `lerTemaInicial` e `aplicarTema`.
  - Garantir sincronização contínua da meta tag `<meta name="theme-color">` no `<head>` (`#12100d` no escuro e `#f3efe4` no claro) em sintonia com `COR_FUNDO_DARK` e `COR_FUNDO_LIGHT`.

---

### Item 6. `src/lib/dividas.ts` $\to$ `src/lib/exportacao.ts` — Separação de Camadas de Domínio e I/O de Planilha

- **Problema**: `src/lib/dividas.ts:190-265` mistura lógica pura de dados/queries financeiras com manipulação de XML (`escaparXml`), criação de `Blob`, `URL.createObjectURL`, injeção temporária de elemento `<a download>` e disparo de download no browser (`baixarExcelLancamentos`).
- **Refatoração**:
  - **[NEW] `src/lib/exportacao.ts`**: Módulo especializado de infraestrutura e exportação documental contendo `escaparXml` e `baixarExcelLancamentos`.
  - Manter `src/lib/dividas.ts` como módulo estrito de consulta e mutação de dados financeiros.
  - Atualizar `src/routes/Administrador.tsx` (e `SecaoExportacaoFinanceira.tsx`) para consumir `baixarExcelLancamentos` a partir de `src/lib/exportacao.ts`.

---

### Item 7. `src/lib/pwa.ts` & `src/context/SessaoContext.tsx` — Tratamento de Erros Push e Expiração de Sessão Ativa

- **Problema 1 (`pwa.ts:172-178`)**: A função `statusPush` capturava qualquer erro do Supabase e retornava silenciosamente `'desativado'`, além de não checar explicitamente a presença de `data`.
- **Problema 2 (`SessaoContext.tsx:55`)**: Quando a sincronização de sessão consulta o atleta no banco e recebe `data.is_ativo === false` (atleta desativado por um administrador), o código executava `return;` silencioso, mantendo a sessão válida em memória e no `localStorage`.
- **Refatoração**:
  - Em `src/lib/pwa.ts`: Checar `if (error) throw error; return data ? 'ativado' : 'desativado';`, propagando falhas de rede reais para que a UI apresente feedback adequado.
  - Em `src/context/SessaoContext.tsx`: Se `data` for retornado e `!data.is_ativo`, invocar `logout()` / limpar `localStorage.removeItem(STORAGE_KEY)` e definir `setJogadorState(null)`. Se ocorrer erro de rede (`error`), preservar a sessão local para funcionamento offline no PWA.

---

### Item 8. Centralização de Constantes de Data, Storage Key e Capacidade

- **Problema**:
  - `Administrador.tsx:44-57` declara localmente as funções de data `hojeStr()`, `mesAtualStr()` e `primeiroDiaMesStr()`.
  - `PartidaNova.tsx:19` e `PartidaNovaTimes.tsx:32` duplicam a literal de string `STORAGE_KEY = 'racha_nova_partida'`.
  - `PartidaNova.tsx:16` declara `LIMITE_LINHA = 14` localmente em vez de consumir a constante canônica `CAPACIDADE_PARTIDA` (`14`).
- **Refatoração**:
  - Mover `hojeStr()`, `mesAtualStr()` e `primeiroDiaMesStr()` para `src/lib/formatacao.ts`.
  - Exportar a constante `STORAGE_NOVA_PARTIDA = 'racha_nova_partida'` em `src/lib/partidas.ts`.
  - Substituir `LIMITE_LINHA` por `CAPACIDADE_PARTIDA` em `src/routes/PartidaNova.tsx`.

---

### Item 9. `src/lib/jogadores.ts` — Helper Reutilizável de Ordenação por Presença Recente

- **Problema**: O comparador de ordenação de atletas elegíveis com base no número de partidas disputadas nos últimos meses está duplicado identicamente em `PartidaDetalhe.tsx:699-706` e `PartidaNova.tsx:114-119`.
- **Refatoração**:
  - Criar função pura de ordenação em `src/lib/jogadores.ts`:
    ```typescript
    export function compararPorPresencaRecente(
      partidasRecentes: Record<number, number>
    ): (a: JogadorLista, b: JogadorLista) => number {
      return (a, b) => {
        const qtdA = partidasRecentes[a.id] ?? 0;
        const qtdB = partidasRecentes[b.id] ?? 0;
        if (qtdB !== qtdA) return qtdB - qtdA;
        return a.username.localeCompare(b.username);
      };
    }
    ```
  - Aplicar o helper tanto em `ConfirmacoesPartida.tsx` (ou `PartidaDetalhe.tsx`) quanto em `PartidaNova.tsx`.

---

### Item 10. `src/routes/PartidaNova.tsx` / `PartidaConfirma.tsx` / `PartidaNovaTimes.tsx` — Otimização de Estado de Navegação

- **Problema**: O fluxo de criação de partida em 3 etapas trafega o array volumoso `jogadores: JogadorLista[]` inteiro dentro do `location.state` (`history.state`). Além de poluir o histórico do navegador, um refresh F5 na rota intermediária pode corromper o estado se o objeto não for re-hidratado perfeitamente.
- **Refatoração**:
  - Simplificar a interface `EstadoPartida` para conter apenas referências mínimas:
    ```typescript
    export interface EstadoPartidaNavegacao {
      selecionados: number[];
      dataJogo: string;
      horaJogo?: string;
    }
    ```
  - As telas recuperam os detalhes dos atletas a partir do cache `listarJogadoresAtivos()` ou do rascunho persistido no `localStorage` (`STORAGE_NOVA_PARTIDA`).
  - Manter todos os hooks incondicionalmente no topo das rotas (React 19) antes de quaisquer guards (`if (!isAdmin)` ou `if (!estado)`).

---

### Item 11. `public/sw.js` — Garantia de Fallback para `tag` em Notificações Push

- **Problema**: Em `public/sw.js:60-62`, a notificação é exibida com `renotify: true`. Conforme a especificação W3C Web Notifications API, `renotify: true` requer obrigatoriamente que a propriedade `tag` seja uma string não vazia. Se `payload.tag` e `payload.id` forem indefinidos, o navegador ignora a notificação ou emite warning no console.
- **Refatoração**:
  - Garantir fallback de tag consistente:
    ```javascript
    const tagNotificacao = payload.tag || (id ? `votar-partida-${id}` : 'racha-notificacao-geral');
    event.waitUntil(
      self.registration.showNotification(payload.title || 'Racha', {
        body: payload.body || 'Há uma nova notificação do racha.',
        data: { url },
        tag: tagNotificacao,
        renotify: true,
        vibrate: [100, 50, 100, 50, 300],
      })
    );
    ```

---

### Item 12. `index.html` & `public/` — Links Canônicos de Favicon e Ícones

- **Problema**: `index.html` declara apenas `<link rel="apple-touch-icon">`, sem referenciar `<link rel="icon" type="image/svg+xml" href="/icon.svg">` ou `<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">`. Navegadores desktop requisitam `/favicon.ico` na raiz, gerando requisições 404 desnecessárias no log e tentativas errôneas de cache do Service Worker.
- **Refatoração**:
  - Adicionar as tags no `<head>` de `index.html`:
    ```html
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    ```

---

### Item 13. `src/components/ErrorBoundary.tsx` — Enquadramento Visual no Design System

- **Problema**: O fallback de erro global `ErrorBoundary.tsx` utiliza uma apresentação genérica em vez da identidade visual "Súmula de Quinta".
- **Refatoração**:
  - Refatorar a renderização com cartão de mesa de súmula (`rounded-[4px] border border-borda bg-superficie shadow-carimbo-preto p-6`), badge de alerta `Badge variante="perigo"`, tipografia `font-display` nos títulos e botão de retorno `bg-destaque text-destaque-tinta font-display font-bold uppercase tracking-wider shadow-carimbo`.

---

## 🧪 3. Plano de Verificação e Testes

### 3.1. Testes Automatizados e Linters
- `npm run lint`: 0 erros no ESLint.
- `npm run build`: Compilação de produção sem erros de tipos no TypeScript.

### 3.2. Roteiro de Testes Manuais
1. **Modal de Goleiro**: Abrir modal, digitar dados, fechar sem salvar e reabrir $\to$ confirmar que os campos reiniciam limpos.
2. **Gesto de Swipe**: Navegar entre as abas via swipe touch e verificar se não ocorrem re-renders anômalos.
3. **Exportação Excel**: Clicar em exportar lançamentos no painel admin $\to$ verificar que `src/lib/exportacao.ts` gera o arquivo `.xls` perfeitamente formatado.
4. **Desativação de Sessão**: Simular atleta inativado (`is_ativo = false`) $\to$ verificar que a sincronização efetua o logout automático e limpa o `localStorage`.
5. **Favicon e Ícones**: Abrir aplicação no Chrome/Safari desktop $\to$ verificar ícone correto na aba e ausência de 404 para favicon.
6. **Fallback de Erro**: Provocar erro de renderização temporário $\to$ conferir o visual estilizado nos tokens do Design System.
