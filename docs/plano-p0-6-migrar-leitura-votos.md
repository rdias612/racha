# 🗳️ Plano P0-6 (parte remanescente) — Consolidar toda a leitura da tabela `votes` em `lib/partidas.ts`

> **Data do plano**: 2026-08-28
> **Origem**: item **P0-6** do [`docs/plano-refatoracoes.md`](./plano-refatoracoes.md) — "Query com coluna inexistente (`match_id`) engole erro".
> **Estado atual**: o bug central já foi corrigido — existe o wrapper canônico `carregarMeusVotos(partidaId, voterId)` em `src/lib/partidas.ts:168`, usado por `src/routes/PartidaVotar.tsx:146`. Porém, a refatoração proposta no item ("mover a leitura de `votes` para `lib/partidas.ts`") ficou **parcial**: ainda existem 2 consultas manuais à tabela `votes` fora da lib.
> **Escopo**: apenas a leitura da tabela `votes`. Nenhuma outra query, RPC, SQL ou mudança visual.
> **Verificação de referência**: ao final, `grep -rn "from('votes')" src/` deve retornar **apenas** `src/lib/partidas.ts`.

---

## 1. Visão geral

O domínio de votação (urna, cédula, votos já depositados) vive em `src/lib/partidas.ts` — ali já estão `carregarMeusVotos`, `registrarVotos`, `descartarVotos` e `votacaoAberta`. Toda consulta à tabela `votes` deve passar por um wrapper dessa lib, pelo mesmo motivo dos itens P1-5/P1-11: o acesso direto ao Supabase nas telas quebra o padrão de camadas, dificulta reuso e espalha conhecimento do schema.

Este plano migra as **2 leituras manuais restantes** (verificadas por grep em 2026-08-28 — as 3 ocorrências de `.from('votes')` em `src/` são: as duas abaixo + o wrapper legítimo na lib):

| #   | Arquivo                                   | Uso na tela                                                                                                |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `src/components/BannerLembrete.tsx:51-58` | Descobrir em quais partidas com urna aberta o jogador logado **ainda não votou** (banner "⚡ Urna Aberta") |
| 2   | `src/routes/PartidaDetalhe.tsx:78-91`     | Saber **se** o jogador logado já votou nesta partida ( alterna o CTA "Votar" ↔ "Editar/Descartar votos")   |

**Nota de auditoria**: o plano original citava também um fallback em `src/lib/jogadores.ts:180`. Ele **não existe mais** — foi removido em 2026-08-27 pelo item P1-8 (a lib agora consulta somente a RPC `obter_medias_notas_jogadores`). Não há nada para migrar em `jogadores.ts`.

---

## 2. Análise por ponto

### 2.1. `src/components/BannerLembrete.tsx:51-58` — leitura de `partida_id` para o banner "Urna Aberta"

**Onde**: dentro do callback `verificar` (linhas 29-71), logo após a query das partidas `published`.

**O que seleciona hoje**:

```ts
const { data: votados, error: erroVotados } = await supabase
  .from('votes')
  .select('partida_id')
  .eq('voter_id', jogadorId)
  .in(
    'partida_id',
    data.map((p) => p.id)
  );
```

- **Colunas**: apenas `partida_id` (nenhuma nota — já está enxuto).
- **Filtros**: `voter_id` do jogador logado + `partida_id IN (ids das partidas published com prazo futuro)`.
- **Para que serve**: montar o `Set` `idsVotados` e filtrar `pendentes` — o banner renderizado no `Layout.tsx:235` (abaixo do header, acima do `<main>`) lista apenas as partidas cuja votação está aberta **e** em que o usuário ainda não depositou a cédula.

**Problema**: acesso direto à tabela `votes` fora da lib — o único motivo de ainda existir é a refatoração P0-6 ter parado no meio.

**Refatoração**: criar o wrapper enxuto **`carregarPartidasVotadas(voterId, partidaIds)`** em `src/lib/partidas.ts` (sketch na seção 3) e substituir a query inline:

```ts
// antes (BannerLembrete.tsx:51-58)
const { data: votados, error: erroVotados } = await supabase.from('votes')...
const idsVotados = new Set((votados ?? []).map((v) => v.partida_id));

// depois
const idsVotados = await carregarPartidasVotadas(jogadorId, data.map((p) => p.id));
```

**Decisões de design** (obrigatórias):

1. **Não reutilizar `carregarMeusVotos`**: o shape dele (`target_id, rating` de **uma** partida) não serve — o banner consulta **várias** partidas e não precisa das notas. Baixar ratings para descartá-los em seguida viola o espírito do AGENTS 7.5 (nunca baixar dados desnecessários no cliente).
2. **Retornar `Set<number>`**: o consumer já construía um `Set`; devolver pronto da lib elimina o pós-processamento.
3. **Curto-circuito com lista vazia**: com `partidaIds.length === 0`, retornar `new Set()` **sem tocar na rede** (defensivo contra `.in()` vazio; hoje o banner só escapa disso porque faz early-return quando não há partidas abertas).
4. **Erros: lib lança cru, borda decide** (padrão P1-11). O `verificar` mantém o comportamento atual de engolir falhas (polling resiliente — "Falha de rede durante o polling: mantém o último estado conhecido"). Não introduzir `formatarMensagemErro` aqui: o banner não tem superfície de erro e o `try/catch` existente permanece.
5. **Proteção contra race permanece no componente**: as checagens `geracao !== geracaoRef.current` (linhas 43 e 59) continuam envolvendo as duas `await`s — a migração move apenas a chamada da query; o padrão `geracaoRef` é a flavour local do AGENTS 5.2 para polling.
6. **A query de `partidas` (linhas 37-41) NÃO migra** — é leitura de `partidas`, não de `votes` (fora do escopo; ver seção 6). O import de `supabase` permanece em `BannerLembrete.tsx`.

### 2.2. `src/routes/PartidaDetalhe.tsx:78-91` — count de existência para `jaVotou`

**Onde**: dentro do `carregar` (linhas 68-117), como 5º elemento do `Promise.all` (linhas 93-99).

**O que seleciona hoje**:

```ts
const { count } = await supabase
  .from('votes')
  .select('*', { count: 'exact', head: true })
  .eq('partida_id', numeroId)
  .eq('voter_id', jogadorLogado.id);
return count ?? 0;
```

- **Colunas**: nenhuma (head request — apenas o `count` de existência).
- **Filtros**: `partida_id` da rota + `voter_id` do jogador logado.
- **Para que serve**: alimentar o estado `jaVotou` (linha 107: `p.status === 'published' && !!jogadorLogado && votos > 0`), que alterna na súmula entre o CTA "Votar nos Jogadores (Craque da Quinta)" (linha 436-442) e o bloco "Seu voto tá garantido" + botões "Editar votos"/"Descartar votos" (linhas 414-434).
- **Tolerância a falhas deliberada**: o comentário das linhas 76-77 documenta que o count é tolerante (`catch → return 0`) para não derrubar a tela inteira se a consulta de votos falhar.

**Refatoração**: usar o **mesmo wrapper da seção 2.1** — a tela só precisa de existência, e `carregarPartidasVotadas` responde exatamente isso:

```ts
// antes (PartidaDetalhe.tsx:78-91)
const contarVotos = jogadorLogado
  ? (async () => {
      try {
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('partida_id', numeroId)
          .eq('voter_id', jogadorLogado.id);
        return count ?? 0;
      } catch {
        return 0;
      }
    })()
  : Promise.resolve(0);

// depois
const contarVotos = jogadorLogado
  ? (async () => {
      try {
        const votadas = await carregarPartidasVotadas(jogadorLogado.id, [numeroId]);
        return votadas.has(numeroId) ? 1 : 0;
      } catch {
        return 0;
      }
    })()
  : Promise.resolve(0);
```

**Decisões de design** (obrigatórias):

1. **Um wrapper só, dois consumers** (Opção A — recomendada). O grão da tabela `votes` é por alvo votado, então a consulta retorna ~14 linhas de `partida_id` (inteiros) por partida — payload ínfimo, deduplicado no `Set`. Não justifica um segundo wrapper.
2. **Alternativa considerada e rejeitada** (Opção B): um wrapper dedicado `jaVotouNaPartida(partidaId, voterId)` com `{ count: 'exact', head: true }` economizaria as ~14 linhas (transferência zero), à custa de uma segunda função quase idêntica na lib — code slop (AGENTS 1º pilar da Filosofia Arquitetural). Se a auditoria futura mostrar custo real de rede, a Opção B pode ser promovida; hoje, não.
3. **Manter o `Promise.all` e a tolerância**: o wrapper entra como o 5º elemento do lote paralelo; o `try/catch → 0` (e o comentário explicando) permanecem na borda — a lib lança o erro cru.
4. **Remover o import agora morto**: o count de `votes` é o **único** acesso direto ao Supabase desta rota (verificado — `supabase` aparece só nas linhas 3 e 81). Após a migração, excluir `import { supabase } from '../lib/supabase';` da linha 3. Com isso, `PartidaDetalhe.tsx` fica 100% na lib (fecha também a menção a esta rota no P1-5).
5. **Não mexer no restante do `carregar`**: `carregarPartida`, `carregarPlacar`, `carregarParticipantes` e `carregarNotas` já vêm da lib; a lógica `p.status === 'published' && votos > 0` da linha 107 permanece idêntica (o wrapper só troca de onde vem o "votos > 0").

---

## 3. Wrapper proposto (fonte única)

Colocar em `src/lib/partidas.ts`, junto dos irmãos de urna (`carregarMeusVotos`/`registrarVotos`/`descartarVotos`, linhas 168-204):

```ts
// IDs das partidas informadas em que o votante já depositou a cédula. Seleciona
// apenas `partida_id` — nunca as notas (AGENTS 7.5). Serve ao banner de lembrete
// (várias partidas) e à súmula (existência em uma partida). Com lista vazia não
// toca na rede. Erro cru é propagado; a borda decide como tratar.
export async function carregarPartidasVotadas(
  voterId: number,
  partidaIds: number[]
): Promise<Set<number>> {
  if (partidaIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('votes')
    .select('partida_id')
    .eq('voter_id', voterId)
    .in('partida_id', partidaIds);
  if (error) throw error;
  return new Set((data ?? []).map((v) => v.partida_id));
}
```

Nome em português no padrão da lib (`carregarX`), parâmetros sem prefixo `p_` (prefixo é regra de RPC SQL, não de wrapper TS), erro propagado cru (padrão P1-11), sem estado (função pura de leitura).

---

## 4. Regras obrigatórias da implementação (AGENTS.md)

- **AGENTS 5.1 — Strict Rules of Hooks**: nenhum hook novo é necessário; se a implementação criar algum, ele vai no topo, **antes** do guard `if (pendentes.length === 0) return null;` (`BannerLembrete.tsx:102`) e antes dos guards de render de `PartidaDetalhe.tsx` (linhas 172+).
- **AGENTS 5.2 — Race conditions**: manter as proteções existentes — `geracaoRef` no `BannerLembrete` (checagem após cada `await`) e o callback `isAtivo()` no `PartidaDetalhe` (linhas 100, 110, 113). A migração substitui apenas a chamada de query; não remover nem duplicar essas checagens.
- **AGENTS 7.5 — Agregações vs download de tabelas**: proibido baixar `rating`/`target_id` para as duas telas deste plano (elas só precisam de existência/IDs de partida) e proibido qualquer leitura sem filtro de `voter_id`/`partida_id`.
- **Erros (padrão consolidado no P1-11)**: a lib lança o erro cru (`if (error) throw error`); a borda mantém as políticas atuais — `BannerLembrete` engole falhas do polling (mantém último estado), `PartidaDetalhe` degrada para `jaVotou = false` sem derrubar a súmula. Não exibir `error.message` cru em nenhuma superfície nova; se surgir mensagem de erro visível, usar `formatarMensagemErro` de `src/lib/erros.ts`.
- **AGENTS 5.3 — Diálogos**: nenhuma mudança de UI é permitida; zero `window.confirm`/`window.alert` (não existe nenhum hoje e não deve nascer um).
- **Zero code slop**: não criar wrappers especulativos nem reexports de compatibilidade; o import de `supabase` remanescente em `BannerLembrete.tsx` é legítimo (query de `partidas`, fora do escopo).
- **AGENTS 11.2 — Checklist**: `npm run lint` com 0 erros → `npm run format` → `npm run build` sem falhas.

---

## 5. Plano de verificação

### 5.1. Automático

```bash
npm run lint        # 0 erros
npm run format      # Prettier alinhado
npm run build       # dist/ sem falhas
```

Conformidade de camada (deve retornar apenas a lib):

```bash
grep -rn "from('votes')" src/
# esperado: src/lib/partidas.ts:NN  (dentro de carregarMeusVotos e carregarPartidasVotadas)
```

### 5.2. Roteiro manual (derivação dos fluxos reais)

Pré-condição: uma partida `published` com `voting_closes_at` no futuro e o usuário logado como jogador de linha participante que **ainda não votou**.

1. **Banner de lembrete aparece**: com a urna aberta, o banner "⚡ Urna Aberta — Partida #N / fecha em Xh Ymin" renderiza abaixo do header (montado em `Layout.tsx:235`) com link para `/partida/N/votar`.
2. **Votar faz o banner sumir**: depositar a cédula → após o redirecionamento automático de volta à súmula (800ms), o banner deve desaparecer em até ~30s (polling com pendentes) ou imediatamente ao trocar de aba e voltar (`visibilitychange`). O contador "fecha em…" continua diminuindo a cada minuto enquanto visível.
3. **Súmula antes de votar**: em `/partida/N`, com votação aberta e jogador participante, aparece o CTA "Votar nos Jogadores (Craque da Quinta)".
4. **Súmula depois de votar**: o CTA dá lugar a "Seu voto tá garantido. Dá pra mudar até as urnas fecharem." + botões "Editar votos" e "Descartar votos".
5. **Descartar reabre tudo**: confirmar o descarte (ConfirmDialog) → `jaVotou` volta a false, navega para a cédula, e o banner de lembrete reaparece (o jogador está novamente pendente).
6. **Editar votos (regressão do wrapper existente)**: reabrir a cédula deve pré-popular as notas anteriores via `carregarMeusVotos` — comportamento inalterado por este plano.
7. **Partida encerrada (`closed`)**: súmula mostra Craque e notas reveladas; nenhuma UI de votação; banner não aparece para ela.
8. **Goleiros e randoms**: usuários que atuaram no gol ou com username `random*` não veem UI de voto na súmula nem banner (guardas inalterados).
9. **Degradação tolerante**: simular falha na consulta de `votes` (ex.: devtools offline por um instante) — a súmula continua carregando com `jaVotou = false`, e o banner mantém o último estado conhecido sem travar o app.

---

## 6. Fora do escopo (não fazer neste item)

- **Não migrar as demais queries diretas ao Supabase** — item separado (extensão do P1-5):
  - `src/routes/Jogos.tsx:41,55,86` — queries em `partidas`, `partida_placar` e `partidas_com_placar`.
  - `src/routes/Ranking.tsx:97` — query na view `ranking`.
  - `src/routes/PartidaNova.tsx:158` — chamada direta à RPC `criar_partida`.
  - `src/components/BannerLembrete.tsx:37-41` — a query de `partidas` (`published` com prazo futuro) permanece direta; só a leitura de `votes` migra.
- **Não tocar em RPCs/SQL/migrations** — nenhuma migration nova; `registrar_votos`, `descartar_votos`, `obter_medias_notas_jogadores` e views ficam como estão.
- **Sem mudanças visuais ou de UX** — markup, classes, textos e comportamento dos dois components permanecem idênticos; a migração é invisível ao usuário.
- **Não introduzir cache SWR (`useCache`) para votos** — são leituras efêmeras por usuário/visualização; nenhuma chave nova em `src/lib/chavesCache.ts`.
- **Não alterar `carregarMeusVotos`, `registrarVotos` ou `descartarVotos`** — apenas acrescentar `carregarPartidasVotadas` e trocar os call sites das seções 2.1 e 2.2.
