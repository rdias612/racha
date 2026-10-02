# Fase 7 · Frontend jogador: `lib/clipes.ts`, bloco no detalhe e link na home — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md:138-147`, Fase 7) · requisito fechado (`docs/requisito-clipes-filmaeu.md:66-67`, RF04/RF05)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicáveis a esta fase: **P4** (bucket público de leitura → URL pública montada a partir de `caminho`), **P7** ("publicada" = `status IN ('published','closed')`), **P9** (link no Resumo independe dos destaques — aparece também no empty state `semPartidas`, render acima da mensagem).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). **ZERO libs novas** — player é o `<video>` nativo (RNF01); `lucide-react` já é dependência (`package.json:17`).

## 1. Objetivo da fase

Exibir os clipes aos jogadores: (a) camada de serviço `src/lib/clipes.ts` nova (listar clipes por partida + helper "última partida com clipes" P7), (b) componente de grade de vídeos em `src/components/` com `<video>` nativo, controles e ações baixar/compartilhar, (c) inserção no `PartidaDetalhe` (carregamento em paralelo no `Promise.all` de `PartidaDetalhe.tsx:75-81`, render condicional após `GridTimesPartida` `:220-222` — partida sem clipes não mostra nada), (d) link/card no `Resumo` entre `:144` e `:147` resolvendo P9, (e) verificação documentada de que `sw.js`/`vercel.json` não interceptam o Storage cross-origin (breakdown `:141`). **Exclui**: telas admin (Fase 8) e qualquer migration (nada de banco novo nesta fase).

## 2. Estado atual e interfaces vinculantes (evidências verificadas em 02/10/2026)

**Interfaces das fases anteriores (a consumir tal como escritas):**

- **Fase 1 — tabela `clipes`** (`fase-1-tasks.md:48-62`): `id bigserial PK`, `partida_id` FK, `caminho text` (`UNIQUE(partida_id, caminho)`), `data_jogo timestamptz NOT NULL` denormalizada, `size_bytes bigint` anulável, `ordem integer` anulável (semântica fixada na Fase 3: posição 1-based na grade do slot, `fase-3-tasks.md:18,473`), `criado_em`. Grants: `SELECT` para `anon, authenticated` (`fase-1-tasks.md:88`) — a leitura pelo client é garantida.
- **Fase 1 — `database.types.ts` regenerado** (Fase 1 Task 3): `clipes` presente em `Database['public']['Tables']`. **Hoje o arquivo ainda não contém `clipes`** (grep conferido em 02/10/2026) — a regeneração é entregue pela Fase 1; o `npm run build` desta fase só passa com ela aplicada (pré-condição).
- **Fase 3 — caminho e URL pública** (`fase-3-tasks.md:20,472`): `caminho` = `{partida_id}/{arquivo}` dentro do bucket `clipes`, **sem o nome do bucket**; URL pública = `${SUPABASE_URL}/storage/v1/object/public/clipes/${caminho}` (P4) — "a Fase 7 monta a URL em `src/lib/clipes.ts` a partir de caminho".
- **Fase 5/6 — nada é consumido aqui**: push e RPCs admin não entram nesta fase (breakdown `:141-142`).

**Padrões do código a seguir (conferidos agora):**

- Função de serviço: exportada, `supabase.from().select()`, `if (error) throw error`, retorno tipado — `src/lib/partidas.ts:70-78` (`carregarPartida`), `:148-170` (join achatado), `:239-253` (filtro por status). Tipos derivados dos gerados quando precisos: `partidas.ts:562-565` (`Pick<Database['public']['Tables']['partidas']['Row'], ...>`); hand-written defensivo só quando o gerado é impreciso: `partidas.ts:585-615` (comentário `:587-589`). Cast de narrowing com comentário: `partidas.ts:177-180`.
- Chaves de cache: `src/lib/chavesCache.ts:11-81` — constantes/funções exportadas, convenção `prefixo:parametro` (`:17-19`, `:22-24`); invalidação pós-mutação em `:38-43`.
- `useCache`: `src/hooks/useCache.ts:112-188` — SWR em memória; `buscar` deve ser estável (`:109-110`); erro só aparece quando não há dados (`:138-147`); `carregando` só na primeira visita (`:184`).
- `PartidaDetalhe.tsx`: carregamento local com `Promise.all` (`:75-81`) — a rota **não usa `useCache`**; consulta tolerante a falha como padrão para dado não-essencial (`:64-73`, count de votos com try/catch → 0); render condicional por bloco (`:195-222`); `SkeletonDetalhe` na primeira carga (`:132`).
- `Resumo.tsx`: `useCache(chaveResumo(ano), buscar)` (`:59`), componentes locais de card com `return null` quando sem dado (`CardProximaPartida`, `:198-226`), posição do link: entre `CardProximaPartida` (`:144`) e o ternário `semPartidas`/grade de destaques (`:146-162`); empty state `:147-156`.
- Visual "Súmula de Quinta": cards `rounded-[4px] border border-borda bg-superficie shadow-carimbo` (`Resumo.tsx:177`, `GridTimesPartida.tsx:29`); card de destaque da home com `border-2 border-destaque` (`Resumo.tsx:207`); botões padrão `ui/Botao.tsx:16-23`; grade 2 colunas `GridTimesPartida.tsx:23`.
- Datas: `src/lib/formatacao.ts:34-48` (`formatarDataLista`/`formatarDataMobile`/`formatarDataCompleta`). **Não existe formatador de bytes** no repo.
- Compartilhar/download: **nenhum precedente** — `grep navigator.share src` e `grep share src` retornam vazio (verificado agora). Decisão nova desta fase (Task 2).
- `src/lib/supabase.ts:4-5,13` — client tipado com `Database`; **a URL não é exportada** (só `import.meta.env.VITE_SUPABASE_URL` local) — ver decisão da Task 1 sobre `getPublicUrl`.
- `lucide-react` em uso nos componentes (`src/components/Estado.tsx:2`) — ícones de download/compartilhar vêm daí, sem lib nova.
- **sw.js/vercel.json** (verificação do breakdown, Task 5): `public/sw.js:162-243` — o handler de fetch só responde com `respondWith` em 3 ramos: API REST (`/rest/v1/`, `sw.js:175-177`), fontes Google (`:199`) e same-origin (`:220`). URLs de Storage (`https://jtavmrlllyctkuxefhpc.supabase.co/storage/v1/object/public/clipes/...`) **não casam com nenhum ramo** → passam direto (sem cache, sem interceptação). `vercel.json:2` reescreve `/(.*)` → `/index.html`, mas isso vale só para a origem Vercel — requisições a `*.supabase.co` nunca passam por lá. **Nenhuma mudança esperada** (confirmação do breakdown `:143`).
- Scripts de validação: `npm run build` (`tsc -b && vite build`, `package.json:8`) e `npm run lint` (`tsc -b && eslint src public/sw.js`, `package.json:10`) — **ambos existem e são o gate de toda task**.

## 3. Pré-condições

- **Fase 1 aplicada**: migrations 109/110 (`npx supabase db push`), bucket `clipes` público e **`src/lib/database.types.ts` regenerado com a tabela `clipes`** (Fase 1 Task 3) — sem isso nem `tsc` passa. Fases 2–6 **não são pré-requisito** (breakdown `:144`: "o código pode ser validado com dados de teste inseridos manualmente").
- **Dados de teste semeados manualmente** (enquanto a Action da Fase 3 não existe) — roda no **SQL Editor** (como `postgres`, contorna o REVOKE de escrita do client, `fase-1-tasks.md:86-95`) + upload pelo **dashboard Storage**:
  1. Escolher uma partida real `published`/`closed`:
     `SELECT id, data_jogo, status FROM partidas WHERE status IN ('published','closed') ORDER BY data_jogo DESC LIMIT 3;`
  2. Preparar 2–3 arquivos de vídeo reais pequenos (qualquer mp4 de 5–20 s — ex.: gravação curta do próprio celular; **não** instalar ferramenta nova no projeto para gerar vídeo) e subir pelo dashboard → Storage → bucket `clipes` → pasta `{partida_id}/` (nomes `clipe-01.mp4`, `clipe-02.mp4`…).
  3. Inserir as linhas (interface exata da Fase 1, `fase-1-tasks.md:48-62`):
     ```sql
     INSERT INTO clipes (partida_id, caminho, data_jogo, size_bytes, ordem) VALUES
       (<id_partida>, '<id_partida>/clipe-01.mp4', '<data_jogo da partida>', <bytes do arquivo>, 1),
       (<id_partida>, '<id_partida>/clipe-02.mp4', '<data_jogo da partida>', <bytes do arquivo>, 2);
     ```
  4. Conferir a URL pública no browser anônimo: `https://jtavmrlllyctkuxefhpc.supabase.co/storage/v1/object/public/clipes/<id_partida>/clipe-01.mp4` → reproduz (200).
  5. **Manter também uma partida recente SEM linhas em `clipes`** (qualquer outra da lista) — caso de teste "não mostra nada".
  6. Limpeza opcional ao fim da fase: `DELETE FROM clipes WHERE partida_id = <id>;` + apagar os objetos do prefixo no dashboard (o CASCADE não se aplica — `clipes.partida_id` é a tabela filha; as linhas de teste não são precisas depois da validação, mas podem ficar se virarem dado real).
- Supabase CLI/projeto linkados apenas se for preciso regenerar types (já feito na Fase 1). Validação no aparelho via `iniciar_local.ps1` é do dono (seção 6).
- Decisões fechadas aplicáveis: P4, P7, P9. **Nenhuma decisão aberta** (seção 10).

## 4. Tasks (1 passo = 1 commit)

### Task 1 — `src/lib/clipes.ts` novo: tipos + listar clipes por partida + "última partida com clipes" (P7)

**Arquivos a criar**: `src/lib/clipes.ts`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (completo, no padrão de `src/lib/partidas.ts:70-131`)**:

```ts
// Camada de serviço dos clipes do Filma Eu (RF04/RF05 — breakdown SDD 35, Fase 7).
// Padrão das demais libs (partidas.ts): função exportada, supabase.from(),
// throw de erro, retorno tipado. A escrita em `clipes` é exclusiva da Action
// (service key) — aqui só há leitura (grants da Fase 1, fase-1-tasks.md:88).

import { supabase } from './supabase';
import type { Database } from './database.types';

/** Campos de `clipes` usados na UI (types gerados pela Fase 1 — database.types.ts). */
export type Clipe = Pick<
  Database['public']['Tables']['clipes']['Row'],
  'id' | 'caminho' | 'ordem' | 'size_bytes'
>;

/** Clipe pronto para render: linha da tabela + URL pública do vídeo (P4, bucket público). */
export interface ClipeComUrl extends Clipe {
  url: string;
}

/**
 * URL pública de download/streaming do clipe (P4). `getPublicUrl` do SDK produz
 * exatamente `${SUPABASE_URL}/storage/v1/object/public/clipes/${caminho}` — o
 * padrão registrado na Fase 3 (fase-3-tasks.md:308-313) sem re-ler a env var
 * (src/lib/supabase.ts não exporta a URL).
 */
export function urlPublicaDoClipe(caminho: string): string {
  return supabase.storage.from('clipes').getPublicUrl(caminho).data.publicUrl;
}

/** Clipes da partida, na ordem do slot (ordem 1-based da Fase 3; null por último). */
export async function carregarClipesDaPartida(partidaId: number): Promise<ClipeComUrl[]> {
  const { data, error } = await supabase
    .from('clipes')
    .select('id, caminho, ordem, size_bytes')
    .eq('partida_id', partidaId)
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, url: urlPublicaDoClipe(row.caminho) }));
}

/** Última partida com clipes segundo P7: status IN ('published','closed'). */
export interface UltimaPartidaComClipes {
  partidaId: number;
  dataJogo: string;
  totalClipes: number;
}

/**
 * A partida mais recente publicada/encerrada (P7) que tenha clipes — alimenta o
 * link do Resumo (RF05, P9). Join com `partidas!inner` filtra o status em 1
 * round-trip; `data_jogo` denormalizada em `clipes` (Fase 1) ordena sem join extra.
 * null = nenhuma partida com clipes (card some).
 */
export async function obterUltimaPartidaComClipes(): Promise<UltimaPartidaComClipes | null> {
  const { data, error } = await supabase
    .from('clipes')
    .select('partida_id, data_jogo, partidas!inner(status)')
    .in('partidas.status', ['published', 'closed'])
    .order('data_jogo', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Contagem da partida achada (head count: sem transferir linhas).
  const { count, error: erroContagem } = await supabase
    .from('clipes')
    .select('id', { count: 'exact', head: true })
    .eq('partida_id', data.partida_id);
  if (erroContagem) throw erroContagem;

  return { partidaId: data.partida_id, dataJogo: data.data_jogo, totalClipes: count ?? 0 };
}
```

**Decisões embutidas (para revisão)**:

- **URL pública via `getPublicUrl` do SDK** (e não string montada com `import.meta.env.VITE_SUPABASE_URL`): resultado idêntico ao padrão da Fase 3, o client já carrega a URL (`src/lib/supabase.ts:4,13`) e a lib não reabre a env var. Se a revisão preferir a montagem explícita de string (fidelidade literal ao texto da Fase 3), a troca é de 3 linhas nesta função — sem impacto nos consumidores.
- **Filtro P7 com `partidas!inner(status)` + `.in('partidas.status', [...])`**: PostgREST resolve o filtro por tabela referenciada em 1 round-trip (FK `clipes.partida_id → partidas.id` da Fase 1). Se a tipagem gerada do join se mostrar imprecisa, aplicar cast de narrowing com comentário — padrão `partidas.ts:177-180` (não criar tipo hand-written inteiro, contrário à divergência 2 da Fase 1 Task 3, `fase-1-tasks.md:172`).
- **`totalClipes` no retorno**: alimenta o badge "N CLIPES" do card da home (paridade com o "N/N VAGAS" do `CardProximaPartida`, `Resumo.tsx:213-215`). Custo: 1 head-count (sem corpo). Se a revisão achar luxo, remover o campo e a 2ª query — a UI fica com card sem badge (KISS, reversível).
- **Sem chaves de cache aqui**: quem decide a chave é o consumidor (`chavesCache.ts`) — mesmo desacoplamento do resto do projeto.
- **Sem funções admin** (disparo, ledger): Fase 8 as acrescentará neste arquivo (`breakdown.md:154`).

**Validação da task**:

1. `npm run build` e `npm run lint` — passam (o `tsc` prova que `clipes` existe no `database.types.ts` regenerado).
2. Smoke com os dados semeados (seção 3), no console do browser dev ou num snippet temporário **não commitado**:
   `await carregarClipesDaPartida(<id_semeada>)` → array com `url` = `https://...supabase.co/storage/v1/object/public/clipes/<id>/clipe-01.mp4`;
   `await obterUltimaPartidaComClipes()` → `{ partidaId, dataJogo, totalClipes: 2 }`; numa base sem clipes → `null`.
3. Revisão do diff: nenhum `import` novo além de `supabase`/`database.types`; nenhuma lib nova (RNF01).

**Divergências/observações**: `database.types.ts` ainda não tem `clipes` hoje (grep conferido) — a task só compila após a Fase 1 Task 3; registrado como pré-condição, não como bloqueio desta fase.

### Task 2 — Componente `GradeClipesPartida`: grade de `<video>` nativo + baixar/compartilhar

**Arquivos a criar**: `src/components/GradeClipesPartida.tsx`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (completo)**:

```tsx
// Grade de clipes da partida (RF04 — player nativo, sem libs novas; RNF01).
// Segue o visual de card dos componentes existentes (GridTimesPartida.tsx:29,
// Resumo.tsx:177). Carregamento/erro/vazio são responsabilidade da rota:
// o componente SÓ é renderizado com lista não vazia (PartidaDetalhe.tsx),
// então aqui não há skeleton nem estado de erro — SRP.

import { useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { ClipeComUrl } from '../lib/clipes';

export interface GradeClipesPartidaProps {
  clipes: ClipeComUrl[];
}

/** Formata bytes em MB (local: só a grade exibe tamanho; formatacao.ts não tem isso). */
function formatarTamanho(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GradeClipesPartida({ clipes }: GradeClipesPartidaProps) {
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  // RF04 "compartilhar": Web Share API quando existir (mobile/PWA — o alvo é o
  // aparelho); fallback = copiar o link (clipboard), com feedback inline de 2 s.
  async function compartilhar(clipe: ClipeComUrl) {
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'Clipe da partida', url: clipe.url });
        return;
      } catch {
        // Usuário cancelou o share sheet → cai no mesmo fluxo de quem não compartilhou.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(clipe.url);
      setCopiadoId(clipe.id);
      setTimeout(() => setCopiadoId((atual) => (atual === clipe.id ? null : atual)), 2000);
    } catch {
      // Clipboard negado (permissão/http): silencioso — o link também está na
      // barra de endereço se o usuário abrir o vídeo.
    }
  }

  return (
    <section className="rounded-[4px] border border-borda bg-superficie shadow-carimbo overflow-hidden">
      {/* Cabeçalho da seção, padrão CabecalhoTime/GridTimesPartida */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-borda bg-superficie-2">
        <h2 className="font-display font-black text-[10px] uppercase tracking-widest text-giz-fraco">
          🎥 Clipes da partida
        </h2>
        <span className="font-mono text-xs font-bold text-destaque-texto tabular-nums">
          {clipes.length} {clipes.length === 1 ? 'clipe' : 'clipes'}
        </span>
      </div>

      <div className="divide-y divide-borda">
        {clipes.map((clipe, indice) => (
          <div key={clipe.id} className="p-3 space-y-2">
            {/* Player nativo do browser (RF04). preload="metadata" evita baixar
                todos os vídeos de uma vez; playsInline para iOS não abrir fullscreen. */}
            <video
              controls
              playsInline
              preload="metadata"
              src={clipe.url}
              className="w-full aspect-video bg-black rounded-[2px]"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-giz-fraco">
                Clipe {clipe.ordem ?? indice + 1}
                {formatarTamanho(clipe.size_bytes) && (
                  <> · {formatarTamanho(clipe.size_bytes)}</>
                )}
              </span>
              <div className="flex items-center gap-2">
                {/* Baixar: âncora direta na URL pública. O atributo `download`
                    é ignorado cross-origin (bucket no supabase.co) — o browser
                    abre o vídeo numa aba nova, de onde o usuário salva;
                    o atributo fica para o dia em que a origem mudar. */}
                <a
                  href={clipe.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-1.5 rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-giz hover:bg-superficie transition active:translate-y-px"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Baixar
                </a>
                <button
                  type="button"
                  onClick={() => compartilhar(clipe)}
                  className="flex items-center gap-1.5 rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-giz hover:bg-superficie transition active:translate-y-px"
                >
                  <Share2 className="size-3.5" aria-hidden="true" />
                  {copiadoId === clipe.id ? 'Copiado!' : 'Compartilhar'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

**Decisões embutidas (baixar/compartilhar — a escolha pedida pelo orquestrador)**:

- **Compartilhar = Web Share API com fallback de clipboard**: `'share' in navigator` cobre Android/iOS (onde o RF04 faz sentido — PWA de aparelho); desktop sem API copia o link com feedback "Copiado!" de 2 s. Cancelamento do share sheet (`AbortError`) não vira erro nem fallback — comportamento esperado. Sem Snackbar/`haptics` para não acoplar o componente a mais infraestrutura do que os pares usam (`GridTimesPartida` não usa nenhum).
- **Baixar = âncora com `download` + `target="_blank"`**: sem fetch-blob (memória/complexidade à toa para vídeo de dezenas de MB); o comportamento real cross-origin (aba nova com o mp4) é documentado no comentário do código — honesto e KISS.
- **`preload="metadata"` + `controls` + `playsInline`**: a grade pode ter N vídeos; só metadados na carga da página, streaming sob demanda ao dar play — essencial em rede de celular e para não estourar o egress do free tier.
- **Sem `poster`**: o primeiro frame via `preload="metadata"` já dá miniatura na maioria dos browsers; customizar poster seria upload extra na Action (fora de escopo).
- **Erro de playback do `<video>`** (arquivo deletado pela retenção RF09 entre a listagem e o play): o player nativo exibe o erro dele — sem tratamento extra nesta fase (a retenção é por partida inteira e antiga; o caso é raro e auto-evidente).

**Validação da task**:

1. `npm run build` e `npm run lint` — passam.
2. Render manual (snippet temporário com os dados semeados, não commitado) — playback inicia, controles nativos funcionam, botões visíveis.
3. Revisão do diff: só `lucide-react` (já dependência, `package.json:17`) e React nativo; nenhum player de terceiros.

**Divergências/observações**: nome `GradeClipesPartida` segue o precedente `GridTimesPartida` (grade do detalhe da partida). "Grade" em grid de 1 coluna (vídeos full-width empilhados) é deliberado — vídeo lado a lado no mobile é ilegível; o container é um card só com divisórias, como `GridTimesPartida`.

### Task 3 — Inserção no `PartidaDetalhe`: carregamento paralelo + render condicional

**Arquivos a tocar**: `src/routes/PartidaDetalhe.tsx`.
**Arquivos NÃO tocados**: nenhum outro.

**Conteúdo esboçado (4 pontos de edição, com contexto suficiente)**:

1. Import (junto dos demais de `../lib/`, `PartidaDetalhe.tsx:7-21`):
   ```tsx
   import { carregarClipesDaPartida, type ClipeComUrl } from '../lib/clipes';
   import { GradeClipesPartida } from '../components/GradeClipesPartida';
   ```
2. Estado (junto dos demais, `PartidaDetalhe.tsx:43-52`):
   ```tsx
   const [clipes, setClipes] = useState<ClipeComUrl[]>([]);
   ```
3. No `carregar` (`PartidaDetalhe.tsx:54-99`): consulta **tolerante a falha** — padrão do `contarVotos` de `:64-73` (dado não-essencial não derruba a súmula, tela mais visitada do app):
   ```tsx
   // Clipes são tolerantes a falha (como o count de votos): sem clipes ou erro
   // de rede, a grade simplesmente não aparece.
   const buscarClipes = (async () => {
     try {
       return await carregarClipesDaPartida(numeroId);
     } catch {
       return [];
     }
   })();

   const [p, pl, parts, ns, votos, cs] = await Promise.all([
     carregarPartida(numeroId),
     carregarPlacar(numeroId),
     carregarParticipantes(numeroId),
     carregarNotas(numeroId),
     contarVotos,
     buscarClipes,
   ]);
   // ... dentro do if (p):
   setClipes(cs);
   ```
4. Render — **imediatamente após o bloco de `GridTimesPartida`** (`PartidaDetalhe.tsx:220-222`), antes das ações por status (`:225`):
   ```tsx
   {(partida.status !== 'draft' || participantes.some((p) => p.time !== null)) && (
     <GridTimesPartida participantes={participantes} />
   )}

   {/* Clipes do Filma Eu: só existe bloco quando há clipes importados (RF04) */}
   {clipes.length > 0 && <GradeClipesPartida clipes={clipes} />}
   ```

**Decisões embutidas**:

- **Sem `useCache`/chave de cache no detalhe**: a rota inteira usa carregamento local com `Promise.all` + `carregar` recorrente (`PartidaDetalhe.tsx:54-99,216`); introduzir SWR só para os clipes criaria dois regimes de dado na mesma tela. Ver divergência 1 — o breakdown menciona "chaves de cache novas" (plural), mas o único consumidor de cache desta fase é o Resumo (Task 4).
- **Render independente de status**: clipes só existem de partidas importadas (passadas), mas o filtro é por conteúdo (`clipes.length > 0`), não por status — uma partida `published` com votação aberta e clipes já importados mostra a grade, o que é desejado (RF06 notifica "clipes prontos" enquanto a partida pode ainda estar `published`).
- **Sem render no `draft` sem times**: o bloco entra após o `GridTimesPartida`, herda o layout; se uma partida draft improvável tiver clipes, a grade aparece — inócuo.

**Validação da task**:

1. `npm run build` e `npm run lint` — passam.
2. Com os dados semeados: abrir `/partida/<id_semeada>` → a grade aparece abaixo dos times, playback funciona; abrir uma partida **sem** clipes → **nenhum bloco aparece** (critério do breakdown `:147`).
3. Simular erro (devtools → block da URL `/rest/v1/clipes*`) e recarregar → a página carrega normal, sem grade (tolerância validada).
4. `git status`: só `PartidaDetalhe.tsx` mudou.

**Divergências/observações**: nenhuma — a posição exata (após `GridTimesPartida`, `:220-222`) é a definida no breakdown `:141`.

### Task 4 — Chave de cache nova + link no `Resumo` (RF05, P9)

**Arquivos a tocar**: `src/lib/chavesCache.ts` (1 chave nova), `src/routes/Resumo.tsx` (hook + card local).
**Arquivos NÃO tocados**: nenhum outro.

**Conteúdo esboçado**:

`src/lib/chavesCache.ts` — constante nova, no padrão de `:11` e `:46-58` (o parâmetro não muda — query sem parâmetros):

```ts
/** Última partida publicada/encerrada com clipes (P7) — card/link da home (RF05). */
export const CHAVE_ULTIMA_PARTIDA_COM_CLIPES = 'clipes:ultima-partida';
```

`src/routes/Resumo.tsx`:

1. Imports:
   ```tsx
   import { useCache } from '../hooks/useCache';           // já existe (:19)
   import { chaveResumo } from '../lib/chavesCache';        // já existe (:20) — vira:
   import { chaveResumo, CHAVE_ULTIMA_PARTIDA_COM_CLIPES } from '../lib/chavesCache';
   import {
     obterUltimaPartidaComClipes,
     type UltimaPartidaComClipes,
   } from '../lib/clipes';
   ```
2. Hook (após o `useCache` principal de `:59`; `obterUltimaPartidaComClipes` é referência de módulo — estável por definição, requisito do `useCache` `useCache.ts:109-110`):
   ```tsx
   // RF05: link "clipes da última partida" — independe dos destaques do ano
   // (P9: aparece inclusive no empty state `semPartidas`). Erro/carregando
   // deixam o card de fora (card opcional não quebra nem atrasa a home).
   const { dados: ultimaComClipes } = useCache<UltimaPartidaComClipes | null>(
     CHAVE_ULTIMA_PARTIDA_COM_CLIPES,
     obterUltimaPartidaComClipes
   );
   ```
3. Render — **entre `CardProximaPartida` (`Resumo.tsx:144`) e o ternário `semPartidas` (`:146-157`)**, incondicional (é o P9: no empty state, o card fica acima da mensagem "Nenhuma partida na súmula..."):
   ```tsx
   <CardProximaPartida proxima={proxima} />

   <CardClipesDisponiveis ultima={ultimaComClipes ?? null} />

   {/* Grade de Destaques ou Empty State Esportivo */}
   {semPartidas ? ( ... ) : ( ... )}
   ```
4. Componente local — padrão `CardProximaPartida` (`Resumo.tsx:198-226`: `return null` sem dado, card de destaque com `border-2 border-destaque`, link para `/partida/{id}`):
   ```tsx
   function CardClipesDisponiveis({ ultima }: { ultima: UltimaPartidaComClipes | null }) {
     if (!ultima) return null;
     return (
       <Link
         to={`/partida/${ultima.partidaId}`}
         className="block rounded-[4px] border-2 border-destaque bg-superficie px-4 py-3.5 shadow-carimbo transition active:scale-[0.99] hover:bg-superficie-2"
       >
         <div className="flex items-center justify-between gap-2">
           <span className="font-display font-black text-[10px] uppercase tracking-widest text-destaque-tinta bg-destaque px-2 py-0.5 rounded-[2px] shadow-xs">
             🎥 CLIPES DA ÚLTIMA PARTIDA
           </span>
           <span className="font-mono text-xs font-bold text-destaque-texto tabular-nums">
             {ultima.totalClipes} {ultima.totalClipes === 1 ? 'CLIPE' : 'CLIPES'}
           </span>
         </div>
         <p className="mt-2 font-display font-bold text-lg uppercase tracking-wider text-giz capitalize">
           <span className="sm:hidden">{formatarDataMobile(ultima.dataJogo)}</span>
           <span className="hidden sm:inline">{formatarDataCompleta(ultima.dataJogo)}</span>
         </p>
         <p className="mt-0.5 text-xs text-giz-fraco font-mono">
           Toque para rever os melhores momentos
         </p>
       </Link>
     );
   }
   ```

**Decisões embutidas**:

- **Uma chave de cache só, para o Resumo** (`clipes:ultima-partida`): chave fora do escopo `chaveResumo(ano)` porque o dado independe do ano (clipes históricos D9 podem ser de dezembro do ano passado); card some com erro — coerente com a filosofia do `useCache` (erro só quando não há nada a exibir, e aqui "nada" é o normal, `useCache.ts:138-147`). Sem invalidação nova em `invalidarCachesDependentesDePartida` (`chavesCache.ts:38-43`): clipes não mudam por mutação de partida feita no app — mudam por importação da Action, que o cache de sessão não precisa refletir em tempo real (revalida ao remontar a rota).
- **Segundo `useCache` em vez de estender `DadosResumo`** (`Resumo.tsx:22-25,40-57`): isola a falha — se a consulta de clipes falhar, a home inteira continua funcionando (o `buscar` do Resumo atual é all-or-nothing); e evita que o skeleton da home espere 2 queries novas.
- **P9 literal**: o card é renderizado fora do ternário `semPartidas`, então existe nos dois estados — com destaques (acima deles, `:157`) e no empty state (acima da mensagem, `:147-156`).
- **Badge "CLIPES DA ÚLTIMA PARTIDA"** (e não "DA QUINTA"): com importação histórica (D9) a última partida com clipes pode não ser de quinta.

**Validação da task**:

1. `npm run build` e `npm run lint` — passam.
2. Com os dados semeados: a home mostra o card entre o "PRÓXIMA QUINTA" e os destaques; tocar → abre `/partida/{id}` com a grade (Task 3).
3. Remover temporariamente as linhas de teste (`DELETE FROM clipes WHERE partida_id = <id>;`) e recarregar a rota → card some (revalidação do `useCache` ao remontar). Recolocar depois.
4. `git status`: só `chavesCache.ts` e `Resumo.tsx` mudaram.

**Divergências/observações**: ver divergência 1 (uma chave, não várias).

### Task 5 — Verificação de infraestrutura de rede: `sw.js` e `vercel.json` (sem commit)

**Arquivos a criar/tocar**: **nenhum** — verificação pura, documentada nesta tasks-list e no checklist da seção 6 (o breakdown `:141` pede o passo de verificação; como não há mudança, não há commit — a regra "1 passo = 1 commit" vale para passos de código).

**Procedimento e evidências**:

1. **Leitura estática** (já conferida na elaboração deste plano, reconfirmar no dia):
   - `public/sw.js:166-168` — só `GET` é examinado; vídeos são `GET`, mas:
   - `public/sw.js:175-177` — ramo 1 casa com `/rest/v1/` (pathname) ou `hostname .supabase.co` **com** pathname contendo `/rest/v1/`; Storage é `/storage/v1/object/public/clipes/...` → **não casa**.
   - `public/sw.js:199` — ramo 2 é fonts.googleapis/gstatic → não casa.
   - `public/sw.js:220` — ramo 3 exige `url.origin === self.location.origin` (app em Vercel; vídeo em `jtavmrlllyctkuxefhpc.supabase.co`) → **não casa**.
   - Resultado: sem `respondWith`, a requisição do `<video>` vai direto à rede (streaming com Range headers intactos — condição para seek funcionar).
   - `vercel.json:2` — rewrite `/(.*)` → `/index.html` só se aplica ao deployment Vercel; requisições cross-origin ao Supabase nunca passam por ele. Headers de `vercel.json:3-53` são da origem do app.
2. **Prova no aparelho/devtools** (durante a validação da fase): abrir a grade com o SW ativo, dar play, e na aba Network conferir que a requisição do vídeo aparece **sem** a coluna "from ServiceWorker" e responde `206 Partial Content` (seek funciona).

**Divergências/observações**: se a verificação falhar (não esperado — o vídeo não carregar ou o SW cachear), **parar e escalar**: significaria mudança no `sw.js` fora do previsto pelo breakdown `:43`.

## 5. Validação manual da fase (checklist para o dono — no aparelho, via `iniciar_local.ps1`)

- [ ] `npm run build` e `npm run lint` passam em todas as tasks; `git log` da fase com **4 commits** (Tasks 1–4), cada um revertível isoladamente.
- [ ] **RF04 — playback**: partida semeadas com 2–3 clipes → grade abaixo dos times, cada vídeo reproduz com som no aparelho, seek (arrastar a barra) funciona.
- [ ] **RF04 — baixar**: botão Baixar abre o vídeo e permite salvar (conforme o browser do aparelho).
- [ ] **RF04 — compartilhar**: Android/iOS abre o share sheet com o link; desktop copia e mostra "Copiado!".
- [ ] **Partida sem clipes não mostra nada**: nenhuma grade, nenhum espaço vazio, layout idêntico ao de hoje.
- [ ] **RF05 — link na home**: card "CLIPES DA ÚLTIMA PARTIDA" aparece entre o card "PRÓXIMA QUINTA" e os destaques, com contagem certa; toque leva ao detalhe certo.
- [ ] **RF05 — some corretamente**: sem nenhuma linha em `clipes` → card some da home (revalidação ao reabrir a rota).
- [ ] **P9 — empty state**: com o ano zerado de destaques (ou simulando) e clipes existentes → o card aparece **acima** da mensagem "Nenhuma partida na súmula ainda este ano.".
- [ ] **SW**: com o app instalado/SW ativo, playback funciona (Network sem "from ServiceWorker", resposta 206) — Task 5.
- [ ] Nenhuma lib nova no `package.json`; nenhum arquivo fora de `src/lib/clipes.ts`, `src/lib/chavesCache.ts`, `src/components/GradeClipesPartida.tsx`, `src/routes/PartidaDetalhe.tsx`, `src/routes/Resumo.tsx`.
- [ ] Limpar os dados de semente se não virarem dado real (seção 3, item 6).

## 6. Fora de escopo da fase

- Telas admin: disparo manual, histórico/ledger, falhas recentes (Fase 8 — `breakdown.md:152`).
- Funções admin em `src/lib/clipes.ts` (Fase 8 as acrescenta — `breakdown.md:154`).
- Push "clipes prontos" no frontend (a notificação já abre `/partida/{id}`, que passa a ter a grade — Fase 5 entregou o resto).
- Mudanças em `sw.js`, `vercel.json`, migrations, `database.types.ts` (a regeneração é da Fase 1; nada de banco novo aqui).
- Backfill de histórico (D9), múltiplas quadras (§8), transcodificação/HLS (§8).
- Testes automáticos (AGENTS.md proíbe novos).

## 7. Riscos e rollback

- **Cada task é 1 commit, revertível por `git revert` isolado** (AGENTS.md). Sem migrations e sem mudança de contrato de API — o rollback é trivial: reverter volta as telas exatamente ao estado anterior (o bloco some e nada mais muda).
- **Risco principal (breakdown `:146`): regressão no `Resumo`/`PartidaDetalhe`, telas mais visitadas.** Mitigações em camadas: (a) `PartidaDetalhe` carrega clipes de forma **tolerante a falha** (try/catch → `[]`, padrão `:64-73`) — erro de rede nos clipes não derruba a súmula; (b) o card do Resumo é um componente local com `return null` que some com erro/carregando — a home nunca fica bloqueada pelos clipes (segundo `useCache` independente do `DadosResumo`); (c) render puramente aditivo (`clipes.length > 0 &&` / `!ultima && return null`) — com base vazia, zero mudança visual; (d) cada task tocável é 1 commit pequeno e isolado.
- **Risco secundário — egress/bateria**: N `<video preload="metadata">` baixam só metadados na abertura; streaming sob demanda ao dar play. Sem autoplay.
- **Risco baixo — tipagem do join `partidas!inner`**: se o types gerado impreciso travar o `tsc`, cast de narrowing com comentário (padrão `partidas.ts:177-180`); alternativa pior-case, consulta em 2 passos (buscar última partida por `clipes` e filtrar status pelo `carregarPartida` existente) — nenhuma exige retrabalho estrutural.
- **Risco baixo — vídeo não reproduz no iOS** (formato do Filma Eu não suportado): só detectável no aparelho (validação da fase); se ocorrer, é problema de container/codec na origem (Fase 3) — o app não tem o que corrigir sem lib nova (proibida).
- **Rollback dos dados de semente**: `DELETE FROM clipes WHERE partida_id = <id>;` + apagar objetos no dashboard — nenhuma dependência do código (o código lê, nunca escreve).

## 8. Divergências e observações (vs breakdown e fases anteriores)

1. **"Chaves de cache novas" — uma chave, não várias** (breakdown `:140` pede chaves no padrão `chavesCache.ts:11-43`): o `PartidaDetalhe` **não usa `useCache`** — a rota carrega tudo localmente via `Promise.all` + `carregar` (`PartidaDetalhe.tsx:54-99`), e as mutações locais invalidam via `carregar`/`invalidarCachesDependentesDePartida`, não por chave. Criar `chaveClipesPartida(id)` sem leitor seria código morto (YAGNI). A única superfície cacheável da fase é o Resumo → 1 chave (`CHAVE_ULTIMA_PARTIDA_COM_CLIPES`, Task 4). Se a revisão quiser fidelidade literal ao breakdown, a chave do detalhe entra como constante não usada — não recomendo.
2. **URL pública via `getPublicUrl` do SDK** em vez de string montada com a env var (Fase 3 literaliza `${SUPABASE_URL}/storage/v1/object/public/clipes/${caminho}`, `fase-3-tasks.md:308-313`): resultado idêntico byte a byte; o SDK derivou a URL do client já configurado (`src/lib/supabase.ts:13`) e a lib não reabre `import.meta.env`. Troca de 3 linhas se a revisão preferir a montagem explícita.
3. **`totalClipes` e a 2ª query (head count)**: o RF05 pede "um link"; o badge com contagem é paridade de UX com `CardProximaPartida` (`Resumo.tsx:213-215`) e custa 1 head-count. Cortável sem mudança de assinatura (o campo some do retorno).
4. **`TEMPLATE.md` não existe** em `.superpowers/sdd/35-clipes-filmaeu/` (listagem conferida) — o formato deste documento segue o consagrado nas Fases 1–6, que é o template de fato do plano.
5. **`database.types.ts` ainda sem `clipes` hoje** (02/10/2026): a Fase 1 está planejada, não executada — a Task 1 assume os types regenerados e não compila sem eles. Sem conflito de interface: as colunas consumidas (`id, caminho, ordem, size_bytes, partida_id, data_jogo`) são exatamente as do DDL da Fase 1 (`fase-1-tasks.md:48-62`), e a semântica de `ordem` (1-based da grade do slot) foi fixada pela Fase 3 (`fase-3-tasks.md:18`).
6. **Gate "jogador logado" do RF04 é de UI herdado**: `clipes` é legível por `anon/authenticated` por grant (Fase 1, `fase-1-tasks.md:88`) e o app não usa Supabase Auth para sessão (`src/lib/supabase.ts:14-16`); o detalhe da partida hoje não bloqueia leitura por login — os clipes seguem o mesmo regime do resto da súmula. Restringir a `authenticated` seria mudança de grants (Fase 1) + regra de UI nova, fora do escopo.
7. **Interfaces das Fases 1–6 consumidas sem incompatibilidade**: bucket público (P4) permite `<video src>` direto sem URL assinada (que expiraria e exigiria refresh — pior para streaming); P7 e P9 têm tradução literal nas Tasks 1 e 4. Nada das Fases 5–6 (push/RPCs admin) é tocado.

## 9. Critérios de encerramento (do breakdown `:147`, refinados)

1. `npm run build` e `npm run lint` passam (gate de todas as tasks).
2. **Partida com clipes exibe a grade com playback no aparelho**: grade após os times, player nativo com controles, baixar/compartilhar funcionando.
3. **Partida sem clipes não mostra nada**: render condicional validado com partida vazia e com falha simulada de rede.
4. **Link da home aparece/some corretamente**: card entre `CardProximaPartida` e os destaques com dado; some sem dado; presente no empty state `semPartidas` (P9).
5. Verificação `sw.js`/`vercel.json` documentada (Task 5) com prova de streaming no aparelho; 4 commits revertíveis; checklist da seção 5 completo.

## 10. NEEDS_CONTEXT

Nenhum. (P4, P7 e P9 — as decisões abertas da fase no breakdown `:145` — foram fechadas pelo orquestrador em `breakdown.md:186,189,191` e têm tradução direta: URL pública via `caminho`, filtro `status IN ('published','closed')`, card incondicional acima do ternário `semPartidas`. As escolhas locais — `getPublicUrl` do SDK, Web Share com fallback de clipboard, uma chave de cache só, card local no `Resumo.tsx`, tolerância a falha no detalhe — estão justificadas nas seções 4 e 8 e nenhuma é estrutural nem irreversível.)
