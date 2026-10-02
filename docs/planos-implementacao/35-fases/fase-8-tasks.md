# Fase 8 · Frontend admin: gestão de importações + validação end-to-end — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md:149-158`, Fase 8) · requisito fechado (`docs/requisito-clipes-filmaeu.md:65-71`, RF03/RF07/RF08/RF09 e RF01–RF09 no roteiro final)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicável a esta fase: **P6** (gestão admin em **rota própria no bloco admin**, precedente `/notificacoes/*` + `Layout.tsx:210-231`, **NÃO** dentro do `Administrador.tsx` financeiro). Indiretas: **P10** (painel mostra só `clipes_importacoes`), **P11** (limite é var do workflow — o painel só exibe entradas de limpeza, não o limite).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). **ZERO libs novas** — ícones de `lucide-react` (já dependência, `package.json:17`; ícone `Film` confirmado no pacote instalado, `node_modules/lucide-react/dist/lucide-react.d.ts:8675`).
> **Nota**: a atualização de `docs/planos-implementacao/35-clipes-filmaeu.md` (esqueleto → plano detalhado apontando para as 8 fases) é **consolidação do orquestrador**, não passo de implementação desta fase. A task final daqui é o **roteiro de validação end-to-end do dono** (Task 5, sem commit).

## 1. Objetivo da fase

Dar ao admin o controle da feature (RF03/RF07/RF08) e fechar a feature com validação manual completa: (a) funções admin em `src/lib/clipes.ts` consumindo as RPCs da Fase 6 (`disparar_importacao_clipes`, `obter_importacoes_clipes`, `obter_falhas_recentes_clipes`) no padrão `notificacoes.ts:100-152`; (b) **rota nova `/clipes/admin`** no bloco admin (P6) com três seções — destaque de falhas recentes 48h, form de disparo por data específica (horário 19:00 fixo na RPC, **não exposto** na UI) e histórico de importações/limpezas com badge de status; (c) registro da rota em `src/lib/rotas.ts`/`src/App.tsx` + link no menu admin do `src/routes/Layout.tsx`; (d) **roteiro de validação end-to-end do dono** consolidando os checklists das Fases 1–8 num roteiro único ordenado por dependência (RF01–RF09). **Exclui**: automação de testes (AGENTS.md), consolidação do doc do plano (orquestrador), qualquer migration (nada de banco novo nesta fase).

## 2. Estado atual e interfaces vinculantes (evidências verificadas em 02/10/2026)

**Interfaces das fases anteriores (a consumir tal como escritas):**

- **Fase 6 — RPCs** (`fase-6-tasks.md`): `disparar_importacao_clipes(p_admin_id bigint, p_data date) RETURNS boolean` (`:61-131`; valida data futura com exceção, `:86-88`; `horario` fixado em `'19:00'` dentro do SQL, `:118-121`); `obter_importacoes_clipes(p_admin_id bigint, p_limite integer DEFAULT 50)` `RETURNS TABLE` com colunas `id, partida_id, data_referencia, origem, status, sucesso, quantidade_clipes, bytes_total, detalhe, erro, criado_em, atualizado_em` (`:178-227`); `obter_falhas_recentes_clipes(p_admin_id bigint, p_horas integer DEFAULT 48)` — filtra `status IN ('falha','sem_clipes')` na janela em horas, clamp 1–720 (`:235-290`). Todas com gate `is_admin` interno e `GRANT EXECUTE ... TO anon, authenticated`. `database.types.ts` já regenerado com as 3 funções (Fase 6 Task 3, `:311-328`).
- **Fase 1 — semântica do ledger** (`fase-1-tasks.md:65-83`): `status CHECK ('iniciado','concluido','sem_clipes','falha','limpeza')`; `origem CHECK ('automatico','manual')`; `partida_id` nulável (`ON DELETE SET NULL`); `'sem_clipes'` tem `sucesso false` (Fase 3, `fase-3-tasks.md:471`) — entra no destaque de falhas (RF07).
- **Fase 7 — `src/lib/clipes.ts` já existe** com `carregarClipesDaPartida`, `obterUltimaPartidaComClipes`, `urlPublicaDoClipe` e tipos `Clipe`/`ClipeComUrl` (`fase-7-tasks.md:63-138`) — as funções admin **se acrescentam** neste arquivo (breakdown `:154`); nada do jogador é tocado. O componente `GradeClipesPartida` (Fase 7 Task 2) tem o formatador local `formatarTamanho` (`fase-7-tasks.md:181-184`) — ver decisão da Task 1 sobre DRY.

**Padrões do código a seguir (conferidos agora):**

- **Bloco admin de rotas próprias**: `App.tsx:65-72` — redirect `/notificacoes` → primeira aba + 4 rotas `/notificacoes/*` dentro do `<Route element={<Layout />}>`. Precedente exato do redirect: `App.tsx:66-68`.
- **Rota admin-painel**: `NotificacoesSaude.tsx:21-62` — `useAdmin()` + `useJogadorLogado()` (`:22-23`), carregamento com `useCallback(isAtivo)` + cleanup no `useEffect` (`:34-60`), `if (!isAdmin) return <Navigate to="/" replace />` (`:62`), shell `BotaoVoltar` + `CabecalhoSumula` + conteúdo (`:69-85`). `NotificacoesTestes.tsx:44` usa `useSnackbar()`; `:102-116` é o handler de disparo admin (`dispararConfirmacaoManual(jogador.id, ...)` com `setDisparando`, snackbar de sucesso/erro com `formatarMensagemErro` de `src/lib/erros`); `:150-158` `ConfirmDialog` de confirmação; `:161` `<Snackbar {...snackbarProps} />`.
- **Abas**: `AbasNotificacoes.tsx:4-9` (4 abas para 4 responsabilidades) e `useSwipeTabs` (`NotificacoesSaude.tsx:29-32`) — ver decisão da seção 8.1: **não usar abas** nesta fase.
- **Componentes-seção**: props `dados, carregando, erro, onAtualizar` (`SecaoNotificacaoSaude.tsx:8-13`); cabeçalho de seção com título + resumo + botão de atualizar com `RefreshCw` girando (`:66-88`); estados carregando/erro/vazio com `Carregando`/`MensagemEstado` (`:96-103`, componentes de `src/components/Estado.tsx`); lista com `divide-y` (`:105`); erro em `text-perigo break-words` (`:168-173`).
- **Badge**: `Badge.tsx:5-12` variantes (`'ok' | 'perigo' | 'neutro' | 'destaque' | ...`), `:66-74` classes — uso por `variante` direta (o `status` prop de `Badge.tsx:14-23` NÃO conhece os status do ledger; mapear localmente).
- **Form de data**: `PartidaNova.tsx:210-220` — `<input type="date">` com `value`/`onChange`, classes `w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:...`; default de data via helper de `formatacao.ts` (`PartidaNova.tsx:53`).
- **Datas**: `src/lib/formatacao.ts:34-48` (`formatarDataLista` = "qui, 02/10" — ideal para `data_referencia date`; `formatarDataMobile` para timestamps), `:84-88` `hojeStr()` (AAAA-MM-DD local). **Não existe formatador de bytes** no repo hoje (a Fase 7 cria um local — ver 8.2).
- **Menu admin**: `Layout.tsx:210-231` — links `/administrador` (`:210-219`) e `/notificacoes/confirmacao` (`:221-231`) com ícone lucide + label `font-display uppercase`; prefetch de menu `preCarregarMenuNotificacoes = preCarregarAoInteragir('/notificacoes/confirmacao')` (`Layout.tsx:78`, handlers de `:65-71`).
- **Rotas lazy**: `src/lib/rotas.ts:13-35` (carregadores, único ponto com `import()` dinâmico — comentário `:4-7`), `:38-91` (`lazy` exports), `:98-124` (`TABELA_PRE_CARREGAMENTO` com entradas `/^\/notificacoes\/.../` em `:118-121`).
- **Skeleton de rota**: `Layout.tsx:45-57` (`SKELETONS_POR_ROTA`) — sem entrada para a rota nova, o fallback é `CarregandoGeral` (`:61`); aceitável (ver 8.5).
- **Carregamento multi-fonte com erro isolado**: `Administrador.tsx:62-80` (`Promise.allSettled` + erro por fonte com `formatarMensagemErro`) — padrão para as 2 listagens do painel.
- **`Administrador.tsx:190-231`** — composição por seções é específica de financeiro ("Controle Financeiro", `:196`); **não mexer** (P6).
- Scripts de validação: `npm run build` e `npm run lint` (gate de toda task).

## 3. Pré-condições

- **Fases 6 e 7 aplicadas**: migrations 114/115 com as 3 RPCs (`npx supabase db push`), `database.types.ts` regenerado com elas (Fase 6 Task 3), `src/lib/clipes.ts` existente com as funções do jogador (Fase 7 Task 1), `GradeClipesPartida.tsx` criado (Fase 7 Task 2 — a Task 1 desta fase toca nele, ver 8.2).
- Fases 1–5 aplicadas para a validação end-to-end (Task 5); para os **commits** das Tasks 1–4 basta a Fase 6 (as RPCs respondem, mesmo com ledger vazio).
- Um `jogador.id` real com `is_admin = true` para testar no aparelho; um não-admin para o gate.
- Decisões fechadas aplicáveis: P6 (e P10/P11 como contexto). **Nenhuma decisão aberta** (seção 10).

## 4. Tasks (1 passo = 1 commit)

### Task 1 — Funções admin em `src/lib/clipes.ts` + `formatarTamanhoBytes` em `formatacao.ts`

**Arquivos a tocar**: `src/lib/clipes.ts` (acréscimos no fim do arquivo), `src/lib/formatacao.ts` (1 função nova), `src/components/GradeClipesPartida.tsx` (troca do formatador local pelo import — ver 8.2).
**Arquivos NÃO tocados**: nenhum outro.

**Conteúdo esboçado**:

`src/lib/formatacao.ts` (no fim do arquivo):

```ts
/** Bytes em MB com 1 casa ("12.3 MB"); null/0 → null (não exibir). */
export function formatarTamanhoBytes(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

`src/lib/clipes.ts` (acréscimos; padrão `dispararConfirmacaoManual`/`obterPainelEntregasPush` de `src/lib/notificacoes.ts:100-152`):

```ts
/** Linha do ledger `clipes_importacoes` (Fase 1, fase-1-tasks.md:65-83) para o painel admin. */
export interface ImportacaoClipes {
  id: number;
  partida_id: number | null;
  data_referencia: string; // date do Postgres → 'YYYY-MM-DD'
  origem: 'automatico' | 'manual';
  status: 'iniciado' | 'concluido' | 'sem_clipes' | 'falha' | 'limpeza';
  sucesso: boolean;
  quantidade_clipes: number | null;
  bytes_total: number | null;
  detalhe: string | null;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** RF03: dispara a importação de uma data específica (AAAA-MM-DD; RPC da Fase 6
 *  rejeita data futura e fixa o horário 19:00 — nada disso é decisão da UI). */
export async function dispararImportacaoClipes(adminId: number, data: string): Promise<void> {
  const { error } = await supabase.rpc('disparar_importacao_clipes', {
    p_admin_id: adminId,
    p_data: data,
  });
  if (error) throw error;
}

/** RF08: histórico de importações e limpezas, mais recente primeiro. */
export async function obterImportacoesClipes(
  adminId: number,
  limite = 50
): Promise<ImportacaoClipes[]> {
  const { data, error } = await supabase.rpc('obter_importacoes_clipes', {
    p_admin_id: adminId,
    p_limite: limite,
  });
  if (error) throw error;
  // Cast de narrowing intencional: RETURNS TABLE gera colunas imprecisas no gerado
  // (padrão obterPainelEntregasPush, notificacoes.ts:149-151).
  return (data ?? []) as unknown as ImportacaoClipes[];
}

/** RF07: falhas ('falha' + 'sem_clipes') da janela de horas (default 48h). */
export async function obterFalhasRecentesClipes(
  adminId: number,
  horas = 48
): Promise<ImportacaoClipes[]> {
  const { data, error } = await supabase.rpc('obter_falhas_recentes_clipes', {
    p_admin_id: adminId,
    p_horas: horas,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ImportacaoClipes[];
}
```

Em `GradeClipesPartida.tsx`: remover a função local `formatarTamanho` (`fase-7-tasks.md:181-184`) e importar `formatarTamanhoBytes` de `../lib/formatacao`, ajustando os 2 usos (mesma assinatura/retorno).

**Decisões embutidas**:

- **Assinaturas 1:1 com as RPCs da Fase 6** — `p_data` como string `AAAA-MM-DD` (PostgREST serializa para `date`); sem expor `horario`/`partida_id`/`limite`/`horas` na UI (a RPC já fixa 19:00 e o default 48h é o requisito; YAGNI).
- **Tipos explícitos + cast de narrowing** (e não `Database['public']['Functions'][...]['Returns']`): consistência com `PainelEntregaJogador` (`notificacoes.ts:124-151`), que é o precedente direto de `RETURNS TABLE` consumida no frontend; o tipo também é usado como props dos componentes (Tasks 2–3), então um tipo nomeado e legível é melhor que um `Pick` profundo do gerado.
- **`formatarTamanhoBytes` em `formatacao.ts`** em vez de duplicar o formatador local da Fase 7: com o histórico exibindo `bytes_total`, existem 2 consumidores reais — duplicação real, extração justificada (DRY com critério). A mudança em `GradeClipesPartida` é de 3 linhas e não altera comportamento.

**Validação da task**:

1. `npm run build` e `npm run lint` passam (o `tsc` prova que as 3 RPCs existem no `database.types.ts` da Fase 6).
2. Smoke no console do browser (snippet temporário não commitado, logado como admin): `await obterImportacoesClipes(<adminId>)` → array (vazio ou com as linhas das fases anteriores); `await obterFalhasRecentesClipes(<adminId>)` → idem; com não-admin → exceção "Acesso restrito a administradores.".
3. `git status`: só `clipes.ts`, `formatacao.ts` e `GradeClipesPartida.tsx`.

**Divergências/observações**: ver 8.2 (extração do formatador da Fase 7) e 8.6 (tipos explícitos vs gerado).

### Task 2 — Componente `SecaoDisparoClipes`: form de disparo por data específica (RF03)

**Arquivos a criar**: `src/components/SecaoDisparoClipes.tsx`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (completo)**:

```tsx
// Form de disparo manual por dia específico (RF03). O estado do form é da seção;
// a AÇÃO (RPC + snackbar + recarga) é da rota — padrão SecaoNotificacaoTestes
// (NotificacoesTestes.tsx:139-146 recebe disparando/onTestarPush).
// Horário do slot (19:00) é fixo na RPC da Fase 6 e NÃO aparece na UI.

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Botao } from './ui/Botao';
import { hojeStr } from '../lib/formatacao';

export interface SecaoDisparoClipesProps {
  disparando: boolean;
  /** Envia a data escolhida; a rota confirma (ConfirmDialog) e dispara. */
  onSolicitarDisparo: (data: string) => void;
}

export function SecaoDisparoClipes({ disparando, onSolicitarDisparo }: SecaoDisparoClipesProps) {
  // Default hoje: o caso comum é recuperar a partida da semana; o admin ajusta
  // para datas históricas (D9). `max` de hoje espelha a validação da RPC.
  const [data, setData] = useState(() => hojeStr());
  const podeDisparar = Boolean(data) && !disparando;

  return (
    <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
      <div>
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          Disparar importação
        </h3>
        <p className="text-xs text-giz-fraco mt-0.5">
          Baixa os clipes do slot de 19h do dia informado no Filma Eu e os publica na partida
          correspondente. O resultado aparece no histórico abaixo (assíncrono).
        </p>
      </div>

      <label className="block">
        <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
          Dia da partida
        </span>
        <input
          type="date"
          value={data}
          max={hojeStr()}
          onChange={(e) => setData(e.target.value)}
          className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
        />
      </label>

      <Botao
        onClick={() => onSolicitarDisparo(data)}
        disabled={!podeDisparar}
        larguraCompleta
      >
        {disparando ? 'Disparando…' : 'Disparar importação'}
      </Botao>
    </section>
  );
}
```

(ícone no botão opcional — `Send` sugerido; o padrão é `Botao` de `src/components/ui/Botao.tsx:16-23`.)

**Decisões embutidas**:

- **`<input type="date">` com `max={hojeStr()}`** (padrão visual `PartidaNova.tsx:210-220`): espelha a validação da RPC (`fase-6-tasks.md:86-88`) no client — erro claro cedo, sem round-trip. `min` não é definido (D9: histórico entra por aqui).
- **Ação na rota, form na seção**: a rota tem o `useSnackbar`, o `ConfirmDialog` e o `carregar` — a seção só coleta a data (SRP; paridade com `SecaoNotificacaoTestes`).
- **Sem `ConfirmDialog` dentro da seção**: o disparo cria run na Action (efeito externo) — confirmação explícita na rota, padrão `NotificacoesTestes.tsx:150-158`.
- **Cópia do texto explicando assíncronia**: o retorno `true` da RPC é "dispatch encaminhado", não "importação concluída" (`fase-6-tasks.md:138`) — a mensagem gerencia a expectativa e aponta para o histórico.

**Validação da task**:

1. `npm run build` e `npm run lint` passam.
2. Render manual (snippet temporário não commitado): date picker abre, `max` bloqueia datas futuras, botão desabilita sem data e durante `disparando`.
3. `git status`: só o arquivo novo.

**Divergências/observações**: nenhuma estrutural.

### Task 3 — Componentes `SecaoFalhasRecentesClipes` e `SecaoHistoricoImportacoes` (RF07/RF08)

**Arquivos a criar**: `src/components/SecaoFalhasRecentesClipes.tsx`, `src/components/SecaoHistoricoImportacoes.tsx`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado**:

`src/components/SecaoFalhasRecentesClipes.tsx`:

```tsx
// Destaque de falhas recentes (RF07): 'falha' + 'sem_clipes' das últimas 48h
// (RPC da Fase 6 com default 48). Sem falhas o bloco NÃO existe (return null) —
// é um aviso, não um painel permanente.
import { AlertTriangle } from 'lucide-react';
import { Carregando, MensagemEstado } from './Estado';
import { formatarDataLista } from '../lib/formatacao';
import type { ImportacaoClipes } from '../lib/clipes';

export interface SecaoFalhasRecentesClipesProps {
  falhas: ImportacaoClipes[];
  carregando: boolean;
  erro: string | null;
}

export function SecaoFalhasRecentesClipes({ falhas, carregando, erro }: SecaoFalhasRecentesClipesProps) {
  if (carregando || erro || falhas.length === 0) return null;

  return (
    <section className="rounded-[4px] border border-perigo/40 bg-perigo/10 p-3.5 shadow-carimbo space-y-2">
      <h3 className="flex items-center gap-2 font-display font-bold text-sm uppercase tracking-wider text-perigo">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Falhas nas últimas 48h ({falhas.length})
      </h3>
      <ul className="space-y-1.5">
        {falhas.map((f) => (
          <li key={f.id} className="text-xs font-mono text-giz tabular-nums">
            {formatarDataLista(f.data_referencia)} · {f.status === 'sem_clipes' ? 'sem clipes no slot' : f.erro ?? 'falha'}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-giz-fraco">
        Use o disparo manual abaixo para reexecutar o dia afetado.
      </p>
    </section>
  );
}
```

`src/components/SecaoHistoricoImportacoes.tsx` (padrão `SecaoNotificacaoSaude.tsx:65-88` — cabeçalho + botão atualizar; lista `divide-y` `:105`):

```tsx
import { RefreshCw } from 'lucide-react';
import { Badge, type BadgeVariante } from './Badge';
import { Carregando, MensagemEstado } from './Estado';
import { formatarDataLista, formatarDataMobile, formatarTamanhoBytes } from '../lib/formatacao';
import type { ImportacaoClipes } from '../lib/clipes';

// Mapeamento local: os status do ledger (Fase 1) não existem no `status` prop do
// Badge (Badge.tsx:14-23) — usar `variante` direta.
const STATUS_BADGE: Record<ImportacaoClipes['status'], { rotulo: string; variante: BadgeVariante }> = {
  iniciado: { rotulo: 'Em andamento', variante: 'neutro' },
  concluido: { rotulo: 'Concluído', variante: 'ok' },
  sem_clipes: { rotulo: 'Sem clipes', variante: 'destaque' },
  falha: { rotulo: 'Falha', variante: 'perigo' },
  limpeza: { rotulo: 'Limpeza', variante: 'neutro' },
};

export interface SecaoHistoricoImportacoesProps {
  importacoes: ImportacaoClipes[];
  carregando: boolean;
  erro: string | null;
  onAtualizar: () => void;
}

export function SecaoHistoricoImportacoes({ importacoes, carregando, erro, onAtualizar }: SecaoHistoricoImportacoesProps) {
  return (
    <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-4">
      {/* Cabeçalho + botão atualizar: padrão SecaoNotificacaoSaude.tsx:66-88 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
            Histórico de importações
          </h3>
          <p className="text-xs text-giz-fraco mt-0.5">
            Execuções da Action e limpezas de retenção (mais recente primeiro).
          </p>
        </div>
        <button type="button" onClick={onAtualizar} aria-label="Atualizar histórico"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[4px] border border-borda bg-superficie px-3 text-giz shadow-xs transition hover:bg-superficie-2 active:translate-y-px disabled:opacity-50">
          <RefreshCw className={`size-4 text-destaque-texto ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {carregando && importacoes.length === 0 ? (
        <Carregando compacto>Carregando histórico…</Carregando>
      ) : erro ? (
        <MensagemEstado tipo="erro">{erro}</MensagemEstado>
      ) : importacoes.length === 0 ? (
        <MensagemEstado tipo="info">Nenhuma importação registrada ainda.</MensagemEstado>
      ) : (
        <div className="divide-y divide-borda/40 border-y border-borda">
          {importacoes.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? { rotulo: r.status, variante: 'neutro' as BadgeVariante };
            const tamanho = formatarTamanhoBytes(r.bytes_total);
            return (
              <div key={r.id} className="py-2.5 px-1 space-y-1">
                <div className="flex items-center justify-between gap-2 min-h-[32px]">
                  <span className="font-display font-bold text-sm text-giz capitalize truncate">
                    {formatarDataLista(r.data_referencia)}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-giz-fraco">
                      {r.origem === 'manual' ? 'manual' : 'auto'}
                    </span>
                    <Badge variante={badge.variante}>{badge.rotulo}</Badge>
                  </span>
                </div>
                <p className="font-mono text-[11px] text-giz-fraco tabular-nums">
                  {r.status === 'limpeza'
                    ? 'partida removida por retenção'
                    : r.quantidade_clipes != null
                      ? `${r.quantidade_clipes} clipe(s)${tamanho ? ` · ${tamanho}` : ''}`
                      : '—'}
                  {r.partida_id != null && ` · partida #${r.partida_id}`}
                  {' · '}
                  {formatarDataMobile(r.criado_em)}
                </p>
                {r.erro && <p className="text-perigo break-words text-xs">{r.erro}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

**Decisões embutidas**:

- **`Badge` por `variante` com mapa local** (`STATUS_BADGE`): o prop `status` do `Badge` (`Badge.tsx:14-23,46-64`) só conhece status de partida/confirmação — estender o componente do domínio de partidas com status de ledger seria acoplamento errado; o mapa é local, explícito e total (fallback neutro para status futuro).
- **Falhas recentes com `return null` quando vazias** (e também durante carregando/erro — silêncio não bloqueia o painel): RF07 pede aviso; um banner permanente "tudo ok" seria ruído num painel de visitas esparsas. O erro da listagem NÃO aparece aqui — aparece no histórico (fonte duplicada da mesma RPC consultada; exibir duas vezes confunde).
- **Sem drill-down** (diferente de `SecaoNotificacaoSaude:110-176`): as linhas do ledger cabem em 2 linhas planas (data/status/contagem/erro); drill-down aqui seria estrutura sem necessidade (KISS). Se ficar denso no aparelho, é a evolução natural — anotada, não construída.
- **`formatarDataLista` para `data_referencia`** (date-only: "qui, 02/10" — sem hora) e `formatarDataMobile` para `criado_em` (timestamp); `formatarTamanhoBytes` (Task 1) para `bytes_total` — entradas `limpeza` também exibem o tamanho removido.
- **`partida_id` nulo tratado**: importações com partida não achada (Fase 2, ledger `ON DELETE SET NULL`, `fase-1-tasks.md:67`) simplesmente omitem o "#id".

**Validação da task**:

1. `npm run build` e `npm run lint` passam.
2. Render manual com os três estados (vazio/erro/dados — snippet temporário, não commitado).
3. `git status`: só os 2 arquivos novos.

**Divergências/observações**: ver 8.4 (falhas escondidas quando vazias) e 8.7 (sem drill-down).

### Task 4 — Rota `ClipesAdmin` + registro (`rotas.ts`, `App.tsx`, `Layout.tsx`)

**Arquivos a criar**: `src/routes/ClipesAdmin.tsx`.
**Arquivos a tocar**: `src/lib/rotas.ts`, `src/App.tsx`, `src/routes/Layout.tsx`. Nenhum outro.

**Conteúdo esboçado**:

`src/routes/ClipesAdmin.tsx` (padrão `NotificacoesSaude.tsx:21-88` + disparo de `NotificacoesTestes.tsx:102-116,150-161`):

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Film } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useSnackbar } from '../hooks/useSnackbar';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import { SecaoDisparoClipes } from '../components/SecaoDisparoClipes';
import { SecaoFalhasRecentesClipes } from '../components/SecaoFalhasRecentesClipes';
import { SecaoHistoricoImportacoes } from '../components/SecaoHistoricoImportacoes';
import {
  dispararImportacaoClipes,
  obterImportacoesClipes,
  obterFalhasRecentesClipes,
  type ImportacaoClipes,
} from '../lib/clipes';
import { formatarMensagemErro } from '../lib/erros';

export function ClipesAdmin() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  const [importacoes, setImportacoes] = useState<ImportacaoClipes[]>([]);
  const [falhas, setFalhas] = useState<ImportacaoClipes[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [dataConfirmacao, setDataConfirmacao] = useState<string | null>(null);
  const [disparando, setDisparando] = useState(false);

  // Duas listagens independentes com erro isolado por fonte — padrão
  // Promise.allSettled de Administrador.tsx:62-80.
  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregando(true);
      const [rHist, rFalhas] = await Promise.allSettled([
        obterImportacoesClipes(jogador.id),
        obterFalhasRecentesClipes(jogador.id),
      ]);
      if (isAtivo && !isAtivo()) return;
      if (rHist.status === 'fulfilled') {
        setImportacoes(rHist.value);
        setErroHistorico(null);
      } else {
        setErroHistorico(formatarMensagemErro(rHist.reason, 'Erro ao carregar o histórico.'));
      }
      if (rFalhas.status === 'fulfilled') setFalhas(rFalhas.value);
      setCarregando(false);
    },
    [jogador, isAdmin]
  );

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function handleConfirmarDisparo() {
    if (!jogador || !dataConfirmacao) return;
    const data = dataConfirmacao;
    setDataConfirmacao(null);
    setDisparando(true);
    try {
      await dispararImportacaoClipes(jogador.id, data);
      mostrarSnackbar('sucesso', `Importação de ${data} disparada. Acompanhe no histórico abaixo.`);
      await carregar();
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Falha ao disparar a importação.'));
    } finally {
      setDisparando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <BotaoVoltar fallback="/" />

      <CabecalhoSumula
        titulo="Gestão de Clipes"
        icone={<Film className="size-5 text-destaque-texto" />}
        acao="Filma Eu"
        className="items-center"
      />

      <SecaoFalhasRecentesClipes falhas={falhas} carregando={carregando} erro={null} />

      <SecaoDisparoClipes disparando={disparando} onSolicitarDisparo={setDataConfirmacao} />

      <SecaoHistoricoImportacoes
        importacoes={importacoes}
        carregando={carregando}
        erro={erroHistorico}
        onAtualizar={() => carregar()}
      />

      {dataConfirmacao && (
        <ConfirmDialog
          open
          titulo="Disparar importação?"
          mensagem={`Disparar a importação dos clipes do dia ${dataConfirmacao} (slot 19h) no GitHub Actions?`}
          onConfirm={handleConfirmarDisparo}
          onClose={() => setDataConfirmacao(null)}
        />
      )}

      <Snackbar {...snackbarProps} />
    </div>
  );
}
```

`src/lib/rotas.ts` — 3 pontos (padrão `:32-35, :88-91, :121`):

```ts
// carregadores:
const carregarClipesAdmin = () => import('../routes/ClipesAdmin');
// lazy exports:
export const ClipesAdmin = lazy(() => carregarClipesAdmin().then((m) => ({ default: m.ClipesAdmin })));
// TABELA_PRE_CARREGAMENTO (junto das entradas de /notificacoes, :118-121):
{ padrao: /^\/clipes\/admin/, carregar: carregarClipesAdmin },
```

`src/App.tsx` — import de `ClipesAdmin` na lista de `:6-29` e rotas no bloco do `Layout` (precedente do redirect `/notificacoes`, `App.tsx:65-68`):

```tsx
<Route path="/clipes" element={<Navigate to="/clipes/admin" replace />} />
<Route path="/clipes/admin" element={<ClipesAdmin />} />
```

`src/routes/Layout.tsx` — 3 pontos:

```tsx
// import do ícone (bloco lucide, :3-17): acrescentar Film
// prefetch de menu, junto de :78:
const preCarregarMenuClipes = preCarregarAoInteragir('/clipes/admin');
// link no menu admin, após o bloco "Notificações Push" (:221-231):
<Link
  to="/clipes/admin"
  onClick={() => setMenuAberto(false)}
  {...preCarregarMenuClipes}
  className="flex min-h-[44px] items-center gap-2.5 rounded-[3px] px-3 py-2 text-xs font-medium text-giz hover:bg-superficie-2 hover:text-destaque-texto transition-fast"
>
  <Film className="size-4 text-destaque-texto shrink-0" />
  <span className="font-display font-bold uppercase tracking-wider text-xs">
    Clipes (Filma Eu)
  </span>
</Link>
```

**Decisões embutidas**:

- **Rota única `/clipes/admin`, sem abas nem `useSwipeTabs`** (P6): o precedente `/notificacoes/*` tem 4 abas porque são 4 responsabilidades com navegação entre elas; a gestão de clipes é **um painel único** com 3 blocos coesos (falhas → disparo → histórico, na ordem do fluxo do admin: ver o problema, agir, conferir). O redirect `/clipes` → `/clipes/admin` copia o precedente (`App.tsx:66-68`) para links curtos. Se um dia houver mais de uma tela de clipes, o grupo ganha abas sem quebrar nada.
- **Disparo com `ConfirmDialog` + `useSnackbar`** (padrão `NotificacoesTestes.tsx:150-161`): o disparo cria uma run externa (custo real) — confirmação explícita é o padrão do app para efeitos desse tipo.
- **`Promise.allSettled` com erro só no histórico** (padrão `Administrador.tsx:62-80`): se `obter_importacoes_clipes` falhar (ex.: migration 115 ausente), o painel continua renderizando disparo e falhas; a falha de `obter_falhas_recentes_clipes` é silenciosa (o bloco some — ver 8.4) e o erro que importa aparece no histórico.
- **Gate de UI `useAdmin()` + `Navigate`** (`NotificacoesSaude.tsx:62`): as RPCs já têm gate `is_admin` (Fase 6), mas o gate de UI evita chamada inútil e esconde o painel de não-admins — mesmo critério das rotas irmãs.
- **Sem entrada em `SKELETONS_POR_ROTA`** (`Layout.tsx:45-57`): a rota cai no `CarregandoGeral` (`:61`); painel admin de visitas esparsas não justifica um skeleton dedicado (ver 8.5).

**Validação da task**:

1. `npm run build` e `npm run lint` passam.
2. No aparelho/dev (validação funcional fica para a Task 5): logado como admin, o menu mostra "Clipes (Filma Eu)" e a rota abre com as 3 seções; logado como não-admin, `/clipes/admin` redireciona para `/`.
3. `git status`: só os 4 arquivos listados.

**Divergências/observações**: ver 8.1 (sem abas), 8.3 (`allSettled`), 8.5 (skeleton).

### Task 5 — Roteiro de validação end-to-end do dono (RF01–RF09; sem commit)

**Arquivos a criar/tocar**: **nenhum** — validação pura do dono (como a Task 5 da Fase 7, `fase-7-tasks.md:445-460`: a regra "1 passo = 1 commit" vale para passos de código). Consolida os checklists das Fases 1–8 (`fase-1-tasks.md:180-192`, `fase-2-tasks.md:391-401`, `fase-3-tasks.md:438-449`, `fase-4-tasks.md:279-294`, `fase-5-tasks.md:437-448`, `fase-6-tasks.md:330-340`, `fase-7-tasks.md:462-474` e esta fase) num roteiro único **ordenado por dependência** — não repete cada checklist literal: é o caminho mínimo que valida RF01–RF09 de ponta a ponta. Pode ser incorporado a `docs/planos-implementacao/35-clipes-filmaeu.md` pelo orquestrador na consolidação.

**Roteiro (executar na ordem; SQL Editor roda como `postgres` e contorna grants)**:

**A. Fundação (Fases 1–2)**

1. `npx supabase db push` aplica TODAS as migrations da feature (109–115: tabelas, bucket, RPC do Vault, grant de deleção, RPCs de disparo/consulta) sem erro.
2. Com anon key: `GET /rest/v1/clipes` → 200 `[]`; `POST /rest/v1/clipes` → erro de permissão; `GET /rest/v1/clipes_importacoes` → erro (ledger invisível ao client).
3. Dashboard → Storage: bucket `clipes` público; upload de teste abre pela URL pública `/storage/v1/object/public/clipes/...` em browser anônimo; upload com anon key **falha**. Remover o arquivo de teste.
4. Secrets: Vault com credenciais do Filma Eu + `github_pat_clipes` (fine-grained, só `actions:write`); GitHub Secrets com `SUPABASE_URL` + service key. **RF02**: nada disso aparece em diff/log.
5. Run manual (`workflow_dispatch`) com data de partida real → **verde**; `clipes_importacoes` ganha linha `origem='manual'`, `status='concluido'`, `quantidade_clipes: 0`; log da run sem nenhum segredo; **reexecutar a mesma data → uma linha ativa só** (sem duplicata).

**B. Importação real (Fase 3)**

6. Run com data de partida real → clipes no bucket `clipes/{partida_id}/`; cada URL pública abre anônima; tabela `clipes` com `size_bytes` > 0 e `ordem` preenchida; ledger `concluido` com `quantidade_clipes`/`bytes_total` coerentes. Run com data **sem** partida → run verde com ledger `falha`.

**C. Retenção (Fase 4, RF09)**

7. Semear partidas antigas (ex.: `data_jogo` de fevereiro e de 09/02) com arquivos dummy ~30/40 MB (uploads de hoje); dispatch reimportando a data real com `limite_storage_mb: 50` → run verde; ledger mostra entradas `status='limpeza'` **na ordem de `data_jogo`** (fevereiro antes de 09/02, embora o upload seja de hoje); prefixos e linhas das partidas deletadas somem; a recém-importada permanece intacta; sem input → 800 MB e zero limpeza. Limpar as sementes (`DELETE FROM partidas WHERE id IN (...)` — CASCADE/SET NULL preservam histórico).

**D. Push (Fase 5, RF06/RF07)**

8. `npx supabase functions deploy notificar-clipes`; a importação da etapa 6 gera **um** push "clipes prontos" por participante inscrito, abrindo `/partida/{id}`; simular `falha`/`sem_clipes` → push de aviso a cada admin; reexecução → `claimed: 0`, nenhum push duplicado.

**E. Disparo pelo app (Fase 6)**

9. RPCs com **não-admin** → exceção "Acesso restrito a administradores." em todas as 3; com **admin** → `true`, run visível na aba Actions, `cron_execucoes` com linha `job_nome='disparar_importacao_clipes'`, `status_code 204`.

**F. Frontend jogador (Fase 7, RF04/RF05)**

10. Partida com clipes: grade abaixo dos times, playback com som, seek funcionando, Baixar e Compartilhar OK; partida sem clipes **não mostra nada**; home mostra o card "CLIPES DA ÚLTIMA PARTIDA" entre a próxima partida e os destaques (inclusive no empty state `semPartidas` — P9) e some quando não há clipes; com SW ativo, o vídeo responde `206` e sem "from ServiceWorker" na Network.

**G. Painel admin (Fase 8, RF03/RF07/RF08)**

11. Menu admin mostra **"Clipes (Filma Eu)"**; não-admin é redirecionado; admin abre `/clipes/admin` com as 3 seções.
12. **RF03 — disparo por data histórica**: escolher no form a data de fevereiro (semente da etapa 7, já limpa) ou qualquer quinta passada → `ConfirmDialog` → snackbar de sucesso → run aparece no GitHub com a data no input → após alguns minutos, "Atualizar" no histórico mostra a linha `manual` da data. O horário 19:00 **não aparece** na UI.
13. **Data futura**: o date picker bloqueia (`max`); (força-bruta via curl também cai na exceção da RPC).
14. **RF08 — histórico**: linhas automáticas e manuais listadas mais-recente-primeiro, com badge coerente (`Concluído` ok, `Sem clipes` destaque, `Falha` perigo, `Limpeza` neutro), origem, contagem/tamanho e `#partida` quando existe.
15. **RF07 — falha visível**: disparar uma data **sem partida** → run verde com ledger `falha` → push de aviso aos admins (etapa 8) e o destaque vermelho "Falhas nas últimas 48h" aparece no topo do painel com o dia afetado; apontar o texto do erro. (A entrada sai da janela após 48h — opcional conferir com `p_horas` maior via curl.)
16. **Reexecução não duplica**: disparar de novo a mesma data pelo app → run nova, mas **uma** linha ativa no histórico (idempotência da Action), sem clipes duplicados na grade do detalhe.
17. **RF01 — cron**: na primeira sexta após o merge, conferir a run agendada (09:00 BRT / 12:00 UTC — P8 default; se os clipes de quinta não estiverem publicados a essa hora, ajuste de 1 linha no YAML).
18. Fechamento: `npm run build`/`npm run lint` verdes; nenhum segredo em log/diff em nenhuma etapa; sementes de teste removidas.

## 5. Validação manual da fase

É a Task 5 (roteiro consolidado acima) — em particular os itens do bloco G para esta fase. Gate automático de todas as tasks: `npm run build` + `npm run lint`; `git log` da fase com **4 commits** (Tasks 1–4), cada um revertível isoladamente.

## 6. Fora de escopo da fase

- **Consolidação de `docs/planos-implementacao/35-clipes-filmaeu.md`** (esqueleto → plano detalhado apontando para as 8 fases; incluir a correção do requisito §6: Edge Function → RPC, P1) — **do orquestrador**, não é task desta fase.
- Migrations, `database.types.ts` (já regenerado na Fase 6), Edge Functions, workflow da Action.
- Deleção/reimportação cirúrgica por `partida_id` na UI (o input existe no workflow, sem parâmetro na RPC — YAGNI, `fase-6-tasks.md:135`); exibir o limite de retenção no painel (P11: é var do workflow, não dado do banco).
- Configuração do painel de notificações para clipes (templates on/off — excluída no breakdown `:120`).
- Abas/swipe no bloco de clipes (uma tela só — 8.1); testes automáticos (AGENTS.md).

## 7. Riscos e rollback

- **Cada task é 1 commit, revertível por `git revert` isolado** (AGENTS.md). Sem migrations e sem mudança de contrato: o rollback volta as telas exatamente ao estado anterior (rota some do menu e do router; `clipes.ts` volta às funções do jogador da Fase 7).
- **Risco global baixo** (breakdown `:157` — superfícies admin): os arquivos compartilhados tocados (`rotas.ts`, `App.tsx`, `Layout.tsx`) recebem acréscimos puramente aditivos (1 carregador, 2 rotas, 1 link) — regressão plausível só se um bloco JSX existente for colado errado; mitigado por diff pequeno e `npm run build`.
- **RPCs ausentes** (Fase 6 não aplicada): `tsc` até passa (types gerados são só tipos), mas a chamada falha em runtime — o erro aparece como `MensagemEstado tipo="erro"` no histórico (padrão `SecaoNotificacaoSaude.tsx:99`) e snackbar no disparo; pré-condição da fase cobre.
- **Painel degradado sem derrubar a tela**: falha de `obter_importacoes_clipes` não impede o disparo (allSettled, Task 4); falha do disparo não afeta as listagens; a seção de falhas some silenciosamente se a sua consulta falhar (decisão 8.4 — aceitável: o desfecho também chega por push, RF07).
- **Confusão "disparei e nada apareceu"**: a importação é assíncrona (run da Action); mitigado pelo texto da seção de disparo + mensagem do snackbar apontando o histórico + botão "Atualizar". Se a run falhar, o desfecho aparece no histórico como `falha` e no destaque de 48h — não no snackbar do disparo (que reporta só o transporte, `fase-6-tasks.md:138,356`).
- **Rolloback dos dados de validação**: sementes são removidas por `DELETE FROM partidas ...` (etapa 7) e linhas de teste do ledger, se necessário, com service_role — o código da fase nunca escreve no banco.

## 8. Divergências e observações (vs breakdown e fases anteriores)

1. **Rota única sem abas** (breakdown `:152` diz "rota/aba própria"; P6 confirma rota própria no bloco admin): justificado na Task 4 — `/clipes/admin` com 3 seções em vez de grupo `/clipes/{a,b}` com `AbasNotificacoes`-clone + `useSwipeTabs`. O precedente `/notificacoes/*` é seguido no que importa (rota própria, redirect, prefetch de menu, gate admin); abas seriam estrutura sem segunda tela. Reversível: criar o grupo de abas depois é aditivo.
2. **`formatarTamanhoBytes` extraído para `formatacao.ts`, tocando em arquivo da Fase 7** (`GradeClipesPartida.tsx`): a Fase 7 criou o formatador local alegando consumidor único (`fase-7-tasks.md:28`); o histórico da Fase 8 é o segundo consumidor real — extrair é a regra DRY do AGENTS.md ("remova duplicação real"). Se a revisão preferir intocar a Fase 7, duplicar 3 linhas na seção de histórico também funciona (anotar lá a duplicação). Extração recomendada.
3. **`Promise.allSettled` em vez de dois loaders independentes** (um por seção, como `NotificacoesSaude` faz com o seu único painel): 2 consultas disparadas juntas com erro isolado por fonte — o padrão já consagrado de `Administrador.tsx:62-80` para exatamente essa forma (multi-fonte com erro por fonte). Dois `useCallback`+`useEffect` separados duplicariam o maquinário de `isAtivo` sem ganho.
4. **Destaque de falhas some quando vazio** (`return null`), inclusive enquanto carrega ou se a consulta falha: RF07 ("registro visível no painel") é um aviso condicional; um bloco permanente "sem falhas" é ruído, e o canal push (Fase 5, P2 = push + painel) cobre a parte proativa. O erro da consulta de falhas não é exibido — o mesmo dado (ledger) tem erro exibido no histórico; exibir duas vezes confunde.
5. **Sem skeleton dedicado em `SKELETONS_POR_ROTA`** (`Layout.tsx:45-57`): cai no `CarregandoGeral`. Se a revisão quiser paridade com os painéis de notificações, 1 linha com `SkeletonGestao` resolve — não essencial (KISS).
6. **Tipos `ImportacaoClipes` explícitos + `as unknown as`** em vez de consumir `Database['public']['Functions'][...]['Returns']`: paridade com `PainelEntregaJogador` (`notificacoes.ts:124-151`), que é o precedente direto do projeto para `RETURNS TABLE` → props de UI; comentário do cast segue o padrão. Se o gerado se mostrar preciso e a revisão preferir, trocar o cast pelo tipo gerado é mecânico.
7. **Histórico plano, sem drill-down** (diferente de `SecaoNotificacaoSaude.tsx:110-176`): cada linha do ledger tem 2 linhas planas (data/origem/badge + contagem/tamanho/erro). Drill-down aqui seria estrutura sem necessidade com ~10 linhas por registro; se o histórico crescer (reexecuções acumulam `falha`, Fase 2), a evolução natural é o drill-down da seção de saúde — anotada, não construída (YAGNI).
8. **Ordem das seções no painel**: falhas → disparo → histórico (fluxo do admin: ver problema, agir, conferir). O breakdown não fixa ordem.
9. **`docs/planos-implementacao/35-clipes-filmaeu.md`**: o esqueleto §4 passa 8–12 para o que as Fases 6–8 realmente entregaram (RPC no lugar de Edge Function — P1; gestão em rota própria `/clipes/admin` — P6, não no `Administrador`); a reescrita é da consolidação do orquestrador, e o roteiro da Task 5 substitui o §5 do esqueleto.
10. **Interfaces das Fases 1–7 consumidas sem incompatibilidade**: assinaturas das 3 RPCs (`fase-6-tasks.md:61-290`), colunas/semântica do ledger (`fase-1-tasks.md:65-83`), `clipes.ts` da Fase 7 intacto (só acréscimos), `Badge`/`Estado`/`Botao`/`ConfirmDialog`/`useSnackbar` usados como existem. **Nenhuma divergência bloqueante.**

## 9. Critérios de encerramento (do breakdown `:158`, refinados)

1. **Admin dispara importação de data histórica pelo app** (menu → `/clipes/admin` → form → ConfirmDialog → snackbar → run no GitHub → linha `manual` no histórico) e acompanha o status no painel.
2. **Falha recente fica visível**: destaque 48h no topo do painel para `falha`/`sem_clipes` (RF07), combinado com o push da Fase 5.
3. **Histórico consultável** (RF08): importações e limpezas com origem, badge de status, contagem/tamanho e erro — mais recente primeiro, com atualização manual.
4. **Roteiro de validação end-to-end** (Task 5) executável pelo dono cobrindo RF01–RF09 na ordem de dependência; pendências do dono registradas (P8 do cron é a conhecida).
5. `npm run build`/`npm run lint` verdes; 4 commits revertíveis; nenhuma lib nova; nenhum arquivo fora dos listados por task; `Administrador.tsx` intocado (P6).

## 10. NEEDS_CONTEXT

Nenhum. (P6 — a única decisão de estrutura da fase no breakdown `:156` — foi fechada pelo orquestrador em `breakdown.md:188`: rota própria no bloco admin, precedente `/notificacoes`, fora do `Administrador.tsx`. As escolhas locais — rota única sem abas, `allSettled`, falhas com `return null`, sem drill-down, extração do formatador de bytes, sem skeleton dedicado — estão justificadas nas seções 4 e 8 e nenhuma é estrutural nem irreversível.)
