# A2 - Reduzir responsabilidades de componentes de rota

**Origem:** item A2 do [relatório de conformidade](../relatorio-conformidade-agents.md).  
**Prioridade:** P1.  
**Objetivo:** separar apresentação de coordenação nas duas rotas sem mudar queries, RPCs, cache, navegação ou regras de negócio.

## Estado atual confirmado

### `GestaoGoleiros.tsx`

[GestaoGoleiros.tsx](../../src/routes/GestaoGoleiros.tsx) concentra estados de carregamento, busca, modal, edição de telefone/PIX, cópia, confirmação de status e snackbar. A rota já delega as operações de domínio a `src/lib/jogadores.ts`; portanto a primeira extração deve ser visual, sem mover handlers para um novo hook.

| Bloco            | Responsabilidade que sai da rota           | Estado que permanece na rota                                 |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Linha de goleiro | Visualização, modo edição, inputs e botões | `editandoId`, campos editados, `salvandoEdicao`, `copiadoId` |
| Lista            | Loop, vazio e separadores                  | `goleirosFiltrados` e callbacks                              |
| Cabeçalho/busca  | Continua na rota                           | `busca`, modal de novo goleiro                               |
| Diálogo/snackbar | Continua nos componentes existentes        | `dialogoConfirmacao`, `snackbarProps`                        |

### `Comparador.tsx`

[Comparador.tsx](../../src/routes/Comparador.tsx) mantém coordenação de `idA`, `idB`, elenco, `useCache` e haptics, mas também renderiza duelo, seletores, métricas, “Juntos”, “Adversos” e histórico. Os helpers existentes `LadoDuelo`, `LinhaComparativa` e `LinhaAtletaContexto` devem ser reutilizados ou movidos sem alterar seus contratos visuais.

| Novo componente            | Responsabilidade                   | Props mínimas                                        |
| -------------------------- | ---------------------------------- | ---------------------------------------------------- |
| `LinhaGoleiro`             | Uma linha visual e edição inline   | jogador, modo edição, valores dos campos e callbacks |
| `ListaGoleiros`            | Lista contínua, vazio e `map`      | lista filtrada e callbacks da linha                  |
| `DueloCard`                | Dois lados e troca                 | nomes, estado desabilitado e `onTrocarLados`         |
| `SeletorAtletasComparador` | Selects A/B e opções desabilitadas | jogadores, `idA`, `idB`, id logado e callbacks       |
| `SecaoMetricasComparador`  | Lista de métricas                  | `MetricaComparativa[]`                               |
| `SecaoJuntosComparador`    | Retrospecto quando jogam juntos    | linhas A/B e nomes                                   |
| `SecaoAdversosComparador`  | Retrospecto quando jogam contra    | linhas A/B e nomes                                   |
| `HistoricoComparador`      | Lista de partidas e links          | histórico, nomes e vencedor resolvido                |

## Contratos e decisões de desenho

1. A rota continua dona de dados, estado de servidor, callbacks e navegação.
2. Os novos componentes não importam `supabase`, hooks de sessão ou `useCache`.
3. `LinhaGoleiro` recebe valores controlados e callbacks; não cria estado paralelo para edição.
4. `DueloCard`, `SecaoMetricasComparador` e as seções de contexto são componentes puros.
5. `HistoricoComparador` recebe uma função já preparada para resolver o vencedor, evitando duplicar regra de apresentação na rota.
6. A extração acontece primeiro em `GestaoGoleiros`, depois em `Comparador`, com `npm run lint` e `npm run build` entre as etapas.

## Tasks de implementação

### A2.1 - Extrair a linha de goleiro

**Novo arquivo:** `src/components/LinhaGoleiro.tsx`.

1. Recortar o JSX de uma entrada de `goleirosFiltrados` sem alterar classes, ícones ou textos.
2. Definir props para `JogadorLista`, `estaEditando`, `telefone`, `chavePix`, `salvando`, `foiCopiado` e callbacks de editar, salvar, cancelar, copiar e alternar status.
3. Manter inputs controlados pela rota e respeitar alvos mínimos de toque já usados no projeto.
4. Substituir temporariamente apenas uma linha do loop para confirmar o contrato.

**Checkpoint:** `GestaoGoleiros` compila e a linha mantém modo leitura, modo edição, cópia e status.

### A2.2 - Extrair a lista e concluir `GestaoGoleiros`

**Novo arquivo:** `src/components/ListaGoleiros.tsx`.  
**Arquivo consumidor:** `src/routes/GestaoGoleiros.tsx`.

1. Mover o loop completo para `ListaGoleiros`, incluindo estado vazio e bordas da lista.
2. Renderizar `LinhaGoleiro` e encaminhar callbacks sem adaptar regra de negócio.
3. Substituir o bloco inline da rota por `<ListaGoleiros />`.
4. Manter na rota `listarGoleiros`, `listarGoleirosFiltrados`, `handleSalvarNovo`, `salvarEdicao`, `confirmarAlternanciaStatus`, `copiarPix`, modal, diálogo e snackbar.
5. Remover imports e variáveis órfãos.

**Checkpoint:** validar busca por username/telefone/PIX, edição conjunta de telefone e PIX, copiar PIX, alternar ativo/inativo, novo goleiro, erros e mensagens de sucesso.

### A2.3 - Extrair o cartão de duelo

**Novo arquivo:** `src/components/DueloCard.tsx`.  
**Arquivo consumidor:** `src/routes/Comparador.tsx`.

1. Mover a composição de `LadoDuelo`, separador e botão de inversão.
2. Receber `usernameA`, `usernameB`, `idBSelecionado` e `onTrocarLados`.
3. Manter `vibrateLight()` na rota ou em callback explicitamente passado; o componente não deve criar dependência global de haptics.
4. Preservar disabled, acessibilidade e prefetch dos links existentes.

**Checkpoint:** par incompleto, par completo e inversão continuam renderizando igual.

### A2.4 - Extrair seleção e métricas

**Novos arquivos:** `SeletorAtletasComparador.tsx` e `SecaoMetricasComparador.tsx`.

1. Mover os dois selects mantendo opções, seleção de “eu” e bloqueio do mesmo atleta nos dois lados.
2. Passar `jogadores`, `idA`, `idB`, id logado e callbacks de mudança.
3. Mover o loop de métricas e reutilizar `LinhaComparativa` sem recalcular valores.
4. Manter filtros e `useCache` na rota.

**Checkpoint:** troca de A/B atualiza a chave `chaveComparador`, sem mudar a ordenação ou o loading.

### A2.5 - Extrair contexto e histórico

**Novos arquivos:** `SecaoJuntosComparador.tsx`, `SecaoAdversosComparador.tsx` e `HistoricoComparador.tsx`.

1. Mover as condições de ausência de dados e as mensagens atuais para as seções correspondentes.
2. Passar dados já derivados pela rota; não fazer nova query dentro dos componentes.
3. Reutilizar `LinhaAtletaContexto`, badges e links existentes.
4. Encaminhar handlers de `onTouchStart`, `onMouseEnter` e `onFocus` para manter prefetch.
5. Manter “Juntos”, “Adversos”, vencedor, empate e histórico exatamente com os mesmos dados.

**Checkpoint:** par incompleto, carregamento, dados sem histórico, histórico preenchido e links de partida permanecem funcionais.

### A2.6 - Limpeza e validação integrada

1. Remover da rota apenas helpers e JSX que tenham sido totalmente extraídos.
2. Confirmar que a rota ainda possui apenas sessão, estado, cache, efeitos, handlers e composição.
3. Executar `npm run lint` e `npm run build` após cada rota concluída.
4. Revisar o diff para garantir que classes, textos, aria-labels, rotas e callbacks não mudaram sem necessidade.

## Critérios de aceite

- `GestaoGoleiros` usa `ListaGoleiros` e não contém o loop de apresentação das linhas.
- `Comparador` usa os componentes de duelo, seleção, métricas, contexto e histórico definidos acima.
- Componentes extraídos não acessam persistência nem sessão global.
- Busca, edição, cópia, confirmação, comparação, inversão, loading, vazio, erro e prefetch mantêm comportamento.
- `npm run lint` e `npm run build` passam em cada checkpoint final.

## Riscos e limites

- Não mover handlers para hooks apenas para reduzir linhas.
- Não alterar contratos de `src/lib/jogadores.ts` ou `src/lib/partidas.ts` neste plano.
- Não executar A2 em paralelo com A3, pois ambos alteram `Comparador.tsx`.
