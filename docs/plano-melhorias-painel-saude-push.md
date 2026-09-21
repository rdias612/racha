# Plano — Melhorias do Painel de Saúde Push: tela apartada, filtros e push de teste por atleta

> **Base**: `main` @ `fffd2d2` · **Origem**: pedidos do usuário pós-implementação do P6 (commit
> `442b036`), materializando [`docs/analise-painel-saude-push.md`](./analise-painel-saude-push.md) ·
> **Escopo fechado**: os 3 pedidos explícitos (§3.1, §3.2, §3.3). Nada além — sem bônus, sem
> refatorações adjacentes. Formato e nível de detalhe herdados de `docs/plano-p6-painel-entregas-push.md`
> (removido do repo em `d2eddda`, recuperável via `git show b5d058c:docs/plano-p6-painel-entregas-push.md`).

---

## 1. Contexto e objetivo

O painel **"4. Saúde das Entregas por Atleta"** (P6) vive hoje **dentro** da tela de configuração
`/notificacoes` (`src/routes/Notificacoes.tsx:259-265`), como seção somente-leitura fora do
`<form>`. O uso real revelou três atritos, que são exatamente os pedidos deste plano:

1. **Conteúdo de leitura acoplado a tela de configuração**: alonga a página, mistura propósitos e
   herda o `SkeletonNotificacoes` (que espelha o formulário, não o quadro).
2. **Sem filtros**: encontrar um atleta entre ~30-50 linhas exige scroll + olho.
3. **Sem teste por atleta**: o push de teste da `SecaoNotificacaoTestes` vai sempre para o próprio
   admin (`104_fix_push_cron_fire_and_forget.sql:161-167` envia `jogador_id = p_admin_id`).

Objetivo: **(A)** mover o quadro para a rota apartada `/notificacoes/saude` (conforme a análise
§3.1), **(B)** adicionar os 3 filtros combináveis (busca por texto, status de saúde, categoria do
atleta), **(C)** estender `disparar_push_teste` com `p_jogador_id_alvo DEFAULT NULL` + pré-checagem
de aparelhos dentro da RPC, com botão de teste no drill-down de cada linha.

---

## 2. Estado atual medido (reauditado contra HEAD @ `fffd2d2`)

### 2.1 Roteamento, Layout e skeletons

- **Rotas**: `/notificacoes` declarada em `src/App.tsx:62`; fonte única dos lazy imports em
  `src/lib/rotas.ts:32,77-79` e entrada de prefetch `/^\/notificacoes/` em `rotas.ts:106`. A
  TABELA de prefetch usa `find` **na ordem** (`rotas.ts:120`) — padrões mais específicos primeiro.
- **Skeleton por pathname**: `SKELETONS_POR_ROTA` em `src/routes/Layout.tsx:43-54`; entrada atual
  `/^\/notificacoes/` → `SkeletonNotificacoes` (`Skeletons.tsx:353-414`, espelha o _formulário_).
  O mapa usa `find` na ordem (`Layout.tsx:57`), então `/notificacoes/saude` hoje cairia no skeleton
  errado — a entrada nova precisa vir **antes** da genérica.
- **TabBar**: oculta só em fluxo focado via
  `const isFluxoFocado = /^\/partida\/(nova|\d+\/(votar|editar|ao-vivo|times))/.test(pathname)`
  (`Layout.tsx:103`). Telas admin de leitura mantêm a TabBar — **não tocar na regex**.
- **Menu admin**: link "Notificações Push" no dropdown admin do header (`Layout.tsx`, ícone `Bell`).

### 2.2 Seção de saúde e regra de badge

- `src/components/SecaoNotificacaoSaude.tsx`: presentacional (props `dados/carregando/erro/
onAtualizar`, `:9-14`); constantes `DIAS_OBSERVAR = 3` / `DIAS_VERIFICAR = 14` (`:20-21`);
  `calcularDiasSemEvidencia` (`:25-32`) e `saude(r): SaudeInfo` (`:40-52`, variantes
  `ok`/`perigo`/`neutro`, rótulos "Em dia"/"Observar"/"Verificar aparelho"/"Sem aparelho");
  título numerado "4. Saúde das Entregas por Atleta" (`:71`); drill-down accordion (`:144-177`);
  contagem "N de M atletas com inscrição ativa" (`:77-79`).
- **Regra de negócio que nunca se duplica**: `saude()` + limiares são a MESMA regra que o filtro de
  status precisa usar → **hoist para export do módulo** do componente (§3.2), não cópia.
- Consumo atual: `Notificacoes.tsx:50-53` (estados), `:103-131` (efeito próprio com flag
  `isAtivo`, isolado do formulário), `:259-265` (render fora do `</form>`).

### 2.3 Caminho do push de teste (limitação que define o desenho do Pedido C)

- RPC `disparar_push_teste(p_admin_id bigint)` (`104:127-171`): gate admin (`:140-143`), secret do
  vault (`:145-148`), `disparar_e_registrar_cron_http(..., 2000)` contra `send-test-push` com corpo
  `jsonb_build_object('jogador_id', p_admin_id)` (`:161-167`). **Coleta de 2s** — o comentário do
  cabeçalho (`104:18-20`) documenta que cold start pode registrar falso "Timeout" com o push
  entregue mesmo assim.
- Edge Function `supabase/functions/send-test-push/index.ts`: aceita `jogador_id` opcional no body
  (`:45-51` — **já suporta alvo arbitrário hoje**), retorna **404 JSON** quando o alvo não tem
  inscrições (`:60-62`) e limpa endpoints 404/410 (`:90-92`).
- **Implicação**: com coleta de 2s, o 404/"sem aparelho" da function **não chega confiavelmente ao
  client**. A checagem de aparelhos tem de ocorrer **no banco, dentro da RPC, antes do POST**.
- Tipagem atual da RPC: `src/lib/database.types.ts:964`
  (`disparar_push_teste: { Args: { p_admin_id: number }; Returns: boolean }`).
- Wrapper atual: `dispararPushTeste(adminId)` em `src/lib/notificacoes.ts:90-96`.

### 2.4 Elenco real (medido via REST `jogadores?is_ativo=eq.true` @ HEAD)

Elenco ativo ≈ 22 atletas não-random (Dico, Natal, Hees, K, Tadeu, Thiagao, Cadinho, Gualberto,
Andret, Jp, "vitor andre", "victor tchuca", Tchuca, Ed, Fil, Danilo, Hugo, Marcelinho, Bill,
Gustavo, Gian, Azeita, Guto, Joel, Rod, Cafuba) + randoms (`random1`…, excluídos da RPC do painel,
`106_painel_entregas_push.sql` WHERE `username NOT ILIKE 'random%'`). **Goleiros ativos: 4** —
`Dudu` (24), `Pedrinho` (25), `geilson` (37) e `Rodrigo` (38), todos `posicao = 'goleiro'` e
**`is_mensalista = false`** (medido via REST em 29/08/2026 — re-medir na execução; o elenco muda).
Não há hoje nenhum goleiro mensalista, o que torna a precedência do filtro de categoria (§3.2)
inequívoca nos dados reais, com os 3 grupos populados (~14 mensalistas de linha, ~11 avulsos de
linha, 4 goleiros). A RPC do painel já devolve `username`, `is_mensalista` e `posicao`
(`notificacoes.ts:122-140`) — **filtros 100% client-side, zero mudança de contrato de consulta**.

### 2.5 Componentes reutilizáveis disponíveis

- `CampoBusca` (`src/components/CampoBusca.tsx`): input de busca com lupa + botão limpar,
  `min-h-[44px]`, `text-base` anti-zoom iOS, foco âmbar — **padrão pronto para a busca**.
- `ModalSelecionarOpcao` (`src/components/ModalSelecionarOpcao.tsx`): bottom-sheet de seleção única
  (`ModalBase` + 44px + `vibrateLight` + Escape), **já usado nesta mesma tela**
  (`Notificacoes.tsx:293-303`) — **padrão pronto para os 2 dropdowns**.
- `Badge` (variantes `ok`/`perigo`/`neutro` + slot `icone`), `MensagemEstado`/`Carregando`
  (`Estado.tsx`), `ConfirmDialog`, `Snackbar` + `useSnackbar`, `formatarMensagemErro`
  (`src/lib/erros.ts`), `vibrateLight/Success/Error` (`src/lib/haptics.ts`).
- **Não existe** helper de normalização de acentos em `src/lib/formatacao.ts` (o filtro de
  `GestaoJogadores.tsx:124-126` usa só `toLowerCase`) — criar helper local (§3.2).
- **Nenhuma tela admin usa `useCache`** (AGENTS §5.5 restringe a telas de aba) — a nova rota segue
  sem cache, com `useState` + efeito + flag `ativo` (AGENTS §5.2).

---

## 3. Design das soluções (decisões e justificativas)

### 3.1 Pedido A — tela apartada `/notificacoes/saude`

**Decisão**: Alternativa A da análise — nova rota sob o domínio `/notificacoes`, coerente com o
padrão de sub-rotas por domínio (`/estatisticas/racha`, `/estatisticas/comparar`,
`App.tsx:50-51`). Detalhes:

- **Rota** declarada em `App.tsx` dentro de `<Route element={<Layout />}>`; lazy **exclusivamente**
  em `src/lib/rotas.ts` (AGENTS §6.7): carregador `carregarNotificacoesSaude` + `lazy` +
  entrada de prefetch `{ padrao: /^\/notificacoes\/saude/, ... }` **antes** da genérica
  (`rotas.ts:106`).
- **Skeleton novo e específico**: `SkeletonNotificacoesSaude` em `Skeletons.tsx` (cabeçalho +
  campo de busca + 8 linhas de `h-11` em lista contínua — espelho da tela real, CLS = 0, AGENTS
  §5.4), registrado em `SKELETONS_POR_ROTA` (`Layout.tsx`) na entrada
  `{ padrao: /^\/notificacoes\/saude/, ... }` **antes** da linha `/^\/notificacoes/` existente.
- **TabBar visível**: tela de leitura admin, mesma família de `/notificacoes` — **não mexer em
  `isFluxoFocado`** (regex existe só para fluxos transacionais de partida).
- **Gate admin pós-hooks**: `useAdmin()` + guard `if (!isAdmin) return <Navigate to="/" replace />`
  depois de todos os hooks (AGENTS §5.1; padrão de `Notificacoes.tsx:37,134`).
- **Volta**: `BotaoVoltar` com fallback `'/notificacoes'` (AGENTS §6.3, `voltar(navigate, …)`).
- **O que sobra na `/notificacoes`**: remover estados/efeito/render da seção 4
  (`Notificacoes.tsx:50-53,103-131,259-265`) e o import de `SecaoNotificacaoSaude`; incluir um
  **card de atalho estático** (estilo `SecaoNotificacaoTestes`: `bg-superficie-2`, seta, navegação
  via `useNavigate`) — sem manter a RPC nesta tela (uma única fonte de dados, análise §3.1).
- **Título**: `SecaoNotificacaoSaude` deixa de ser numerado — título vira
  **"Saúde das Entregas por Atleta"** (sem "4.", que só fazia sentido na sequência editorial da
  tela-mãe). Os cards da `/notificacoes` continuam 1-3.
- **Sem `Snackbar` na tela**: na versão inicial não há mutação na tela em si (o push de teste do
  Pedido C é disparado do drill-down e adiciona `Snackbar` — §3.3).

### 3.2 Pedido B — filtros combináveis (busca + status de saúde + categoria)

**Filtrar no client, sem `useMemo` pesado e sem debounce — decisão justificada**: o elenco real é
~22-50 linhas (§2.4); filtrar 50 objetos por toque é O(n) trivial (< 0,1ms), muito abaixo do frame
budget. Debounce adicionaria timer/cleanup (AGENTS filosofia "Zero Code Slop") sem ganho mensurável;
latência de rede não existe (dados já em memória). **Filtro direto em `useMemo`** com deps
`[dados, busca, status, categoria]` — recomputado só quando algo muda.

**Normalização de texto (case/acento-insensível)**: não existe helper no projeto
(`GestaoJogadores.tsx:124-126` usa só `toLowerCase` — insuficiente: "João" não casaria "joao").
Novo helper **local ao módulo** da tela:

```ts
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
```

Match por `username` conforme o admin escreve (substring em qualquer posição — permite achar
"vitor andre" digitando "andre").

**Filtro 1 — busca**: componente `CampoBusca` reutilizado (padrão existente, 44px, anti-zoom,
botão limpar). Estado `busca: string`.

**Filtro 2 — status de saúde**: dropdown com as MESMAS opções dos badges — `todos` (Todos) ·
`em_dia` · `observar` · `verificar` · `sem_aparelho` — agrupadas pela MESMA regra: **hoist** de
`saude()`, `SaudeInfo`, `calcularDiasSemEvidencia`, `DIAS_OBSERVAR` e `DIAS_VERIFICAR` de
`SecaoNotificacaoSaude.tsx` para **export do módulo** (`export function saude(...)`,
`export type SaudeInfo`, `export const DIAS_...`). Não criar arquivo novo nem duplicar limiares —
o módulo do componente é o módulo compartilhado (análise §3.2/§3.4 item "essencial"). O filtro
compara `saude(r).rotulo` (ou um `id` de status adicionado a `SaudeInfo`, preferível — ver §4.3).

**Filtro 3 — categoria do atleta**: `todos` · `goleiro` · `mensalista` · `avulso`, com **semântica
determinística de precedência**, fundamentada em AGENTS §8.3/§8.5 e validada contra os dados reais
(§2.4):

```ts
type CategoriaAtleta = 'goleiro' | 'mensalista' | 'avulso';
function categoria(r: PainelEntregaJogador): CategoriaAtleta {
  if (r.posicao === 'goleiro') return 'goleiro'; // 1º: quem atua no gol
  if (r.is_mensalista) return 'mensalista'; // 2º: mensalista de linha
  return 'avulso'; // 3º: avulso de linha
}
```

- **Justificativa da precedência Goleiro > Mensalista**: os goleiros são regime financeiro
  distinto — recebem **diária de R$ 30,00** e são **isentos de avulso** por partida (AGENTS §8.5);
  a mensalidade é gerada para **não-goleiros** (§8.5). Operacionalmente, a pergunta do admin é
  "como este atleta se relaciona com a push financeira/convite", e o papel de gol domina. Os dados
  reais não têm goleiro mensalista hoje (os 4 goleiros ativos são `is_mensalista = false`, §2.4),
  então a precedência não gera ambiguidade prática; se um dia existir goleiro mensalista, ele
  aparece como **Goleiro** (documentado aqui e no comentário do código).
- **Randoms**: não precisam de categoria — a RPC do painel já os exclui (§2.4), então o filtro
  cobre 100% das linhas exibíveis com 3 valores + "Todos".

**Componente dos dropdowns**: **`ModalSelecionarOpcao`** (bottom-sheet), e não select nativo nem
`useListbox`. Justificativa: (a) já é o padrão desta exata tela (`Notificacoes.tsx:293-303`) —
coerência; (b) mobile-first real (bottom-sheet com alvos de 44px, `vibrateLight`, Escape,
backdrop) supera o `<select>` nativo estilizado em identidade e no iOS o nativo é inestilizável;
(c) `useListbox` (motor de `SeletorNota`/`SelectSumula`) seria generalização nova para 2 dropdowns
estáticos de 4-5 opções — complexidade sem retorno. Padrão de uso: `button`-gatilho
(`min-h-[44px]`, rótulo `font-display uppercase tracking-wider` + valor atual) abrindo o modal,
igual ao gatilho de "Antecedência do Reforço".

**Combinação dos 3 filtros**: AND entre eles (busca E status E categoria). UI dos controles
acima do quadro, dentro do card da lista — a lista continua **lista contínua** `divide-y`
(AGENTS §4.2.1, design-system §3). Contagem do topo ("N de M atletas com inscrição ativa") passa a
refletir o **resultado filtrado** ("N de M" = filtrados/total), com feedback de estado vazio:
`MensagemEstado tipo="info"` "Nenhum atleta atende aos filtros aplicados." (nunca tela em branco).
`vibrateLight` ao trocar dropdown (o modal já vibra) e no toque dos gatilhos.

**Sem `useCache`**: tela admin com filtros derivados de estado local; cache SWR traria chave com
filtro + obrigações de invalidação do AGENTS §5.5.5 sem benefício (análise §3.2).

### 3.3 Pedido C — push de teste por atleta (RPC estendida)

**Decisão: Alternativa A da análise** — estender `disparar_push_teste` com
`p_jogador_id_alvo bigint DEFAULT NULL` (NULL = próprio admin, comportamento atual). Alternativa B
(RPC nova) duplica vault/headers/coleta; alternativa C (client → Edge Function) exigiria expor
`PUSH_CRON_SECRET` no bundle — quebra grave de segurança (AGENTS §9).

**Decisão DROP vs overload — precisa de DROP explícito.** Em PostgreSQL, `CREATE OR REPLACE
FUNCTION` só substitui quando a **assinatura (nome + tipos de args) é idêntica**; mudar a lista de
argumentos cria um **overload** — `disparar_push_teste(bigint)` e `disparar_push_teste(bigint,
bigint)` coexistiriam, e a chamada de 1 argumento continuaria resolvendo para a função **antiga**
(sem pré-checagem), além de exigir GRANT duplicado e sujar o catálogo (o projeto já pagou esse
preço: `088_drop_abrir_partida_overload_antigo.sql` existe exatamente para limpar overload).
Padrão do próprio P6 (migration `106`, cabeçalho: `DROP FUNCTION IF EXISTS
obter_painel_entregas_push(bigint, integer);`). Portanto a migration:

```sql
DROP FUNCTION IF EXISTS disparar_push_teste(bigint);
CREATE OR REPLACE FUNCTION disparar_push_teste(
  p_admin_id        bigint,
  p_jogador_id_alvo bigint DEFAULT NULL
) RETURNS boolean ...
GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint, bigint) TO anon, authenticated;
```

Retrocompatibilidade: o `DEFAULT NULL` mantém a chamada de 1 argumento válida
(`SecaoNotificacaoTestes` via `notificacoes.ts:90-96` nem precisa mudar — embora passar o alvo
explicitamente seja desejável, §4.2). Janela de risco do DROP: mínima (DDL transacional; nenhum
caller concorrente a dignidade de transação — chamadas admin manuais).

**Comportamento novo quando `p_jogador_id_alvo IS NOT NULL`** (esboço quase completo, §4.1):
validar alvo existe + `is_ativo` + não-random (AGENTS §8.6) com `RAISE EXCEPTION` amigável;
**pré-checagem determinística de aparelhos dentro da RPC** — `SELECT count(*) FROM
push_subscriptions WHERE jogador_id = alvo`; se 0, `RAISE EXCEPTION 'Atleta sem aparelho
inscrito.'` **antes** do `net.http_post`. Justificativa: a Edge Function devolve 404 nesse caso
(`send-test-push/index.ts:60-62`), mas a coleta de 2s (`104:166`) torna a resposta não-confiável
para o client (falso "Timeout" — `104:18-20`). TOCTOU residual (inscrição apagada entre check e
POST) é aceitável: pior caso é o 404 com cleanup automático (`:90-92`).

**Front**:

- `dispararPushTeste(adminId, jogadorIdAlvo?)` em `notificacoes.ts` (param opcional); atualizar
  `database.types.ts:964` → `Args: { p_admin_id: number; p_jogador_id_alvo?: number | null }`.
- No drill-down do `SecaoNotificacaoSaude`, botão **"Enviar push de teste"** (`min-h-[44px]`):
  - `qtd_aparelhos === 0` → botão **desabilitado** com explicação inline (o dado já está na linha);
    nem abre diálogo (a RPC também barraria — defesa em profundidade).
  - `qtd_aparelhos > 0` → abre **`ConfirmDialog`** ("Enviar push de teste para {nome}?") —
    `window.confirm` proibido (AGENTS §5.3.3 / matriz §10).
- **Estado de disparo por linha**: `disparandoPara: number | null` (não um boolean global) —
  spinner/disabled **só na linha do atleta alvo**; `vibrateLight` no toque,
  `vibrateSuccess`/`vibrateError` no resultado (AGENTS §6.4).
- **Feedback honesto (lição P5 — disparo ≠ entrega)**: Snackbar de sucesso
  **"Push de teste enfileirado — confirme a entrega no quadro em alguns instantes."** NUNCA
  "entregue com sucesso". Após ~10s do enfileiramento, a tela dispara `carregar()` silencioso
  (recarrega o quadro; a entrega real aparece no ledger e o badge/datas da própria linha refletem
  o teste — o loop de diagnóstico fecha no painel). Erro (ex.: "Atleta sem aparelho inscrito.")
  via `Snackbar tipo="erro"` com `formatarMensagemErro`.
- O header da tela passa a precisar de `Snackbar` + `useSnackbar` e de callback de disparo
  descendo para a seção (props novas, §4.3).

---

## 4. Plano de execução (arquivo a arquivo)

> **Numeração da migration — reauditar antes de criar.** Nesta sessão, `ls supabase/migrations`
> mostra a última como **`107_push_votacao_aberta.sql`** → a próxima livre é **108**. **ATENÇÃO**:
> o plano irmão **P2 (retry do push semanal) também reivindica a 108** (a análise original
> reservou 108 para este trabalho, mas a P2 pode executar primeiro). **Regra**: antes de criar o
> arquivo, rodar `ls supabase/migrations | tail -3` e usar o **próximo número livre naquele
> momento**; ajustar referências internas deste plano se deslocar. Nada de timestamp longo no nome
> (AGENTS §7.2, matriz §10).

### 4.1 `supabase/migrations/108_push_teste_por_atleta.sql` (novo)

```sql
-- Pedido 3 da análise de saúde push (docs/analise-painel-saude-push.md §3.3):
-- push de teste para UM atleta a partir do painel /notificacoes/saude.
-- - p_jogador_id_alvo NULL = comportamento atual (teste no próprio admin).
-- - Pré-checagem de aparelhos DENTRO da RPC: a coleta de 2s (104:166) não
--   devolve o 404 da Edge Function de forma confiável; a checagem no banco dá
--   erro determinístico ("Atleta sem aparelho inscrito.") ANTES do POST.
-- - A assinatura muda → DROP da antiga para evitar overload (lição da 088);
--   DEFAULT NULL mantém a chamada de 1 argumento retrocompatível.
DROP FUNCTION IF EXISTS disparar_push_teste(bigint);

CREATE OR REPLACE FUNCTION disparar_push_teste(
  p_admin_id        bigint,
  p_jogador_id_alvo bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_secret   text;
  v_headers  jsonb;
  v_alvo_id  bigint;
  v_qtd_aparelhos bigint;
BEGIN
  -- Gate admin (padrão 104:140-143; jogadores.id qualificado — lição 42702)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- Resolução do alvo: NULL = o próprio admin (comportamento atual)
  v_alvo_id := COALESCE(p_jogador_id_alvo, p_admin_id);

  IF p_jogador_id_alvo IS NOT NULL THEN
    -- Alvo válido: existe, ativo e não é random (AGENTS 8.6)
    SELECT jogadores.id INTO v_alvo_id
      FROM jogadores
     WHERE jogadores.id = p_jogador_id_alvo
       AND is_ativo
       AND username NOT ILIKE 'random%';
    IF v_alvo_id IS NULL THEN
      RAISE EXCEPTION 'Atleta alvo não encontrado ou inativo.';
    END IF;

    -- Pré-checagem determinística de aparelhos (essencial: 2s de coleta
    -- engolem o 404 da Edge Function — 104:18-20)
    SELECT count(*) INTO v_qtd_aparelhos
      FROM push_subscriptions WHERE jogador_id = v_alvo_id;
    IF v_qtd_aparelhos = 0 THEN
      RAISE EXCEPTION 'Atleta sem aparelho inscrito — peça para ele abrir o app primeiro.';
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_push_teste', false, 'Secret push_cron_secret não encontrado no vault.');
    RAISE EXCEPTION 'Secret push_cron_secret não configurado no vault.';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-cron-secret', v_secret
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_push_teste',
    'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push',
    v_headers,
    jsonb_build_object('jogador_id', v_alvo_id),
    2000
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint, bigint) TO anon, authenticated;
```

Observações de conformidade (AGENTS §7.1-7.3): zero UUID; parâmetros `p_`; `SECURITY DEFINER SET
search_path = public`; `GRANT EXECUTE` explícito na **nova** assinatura; corpo do POST já é
aceito pela Edge Function (`jogador_id` opcional no body, `send-test-push/index.ts:45-51`) —
**nenhuma mudança em `supabase/functions/`**.

### 4.2 `src/lib/notificacoes.ts` (editar)

```ts
export async function dispararPushTeste(
  adminId: number,
  jogadorIdAlvo?: number | null
): Promise<void> {
  const { error } = await supabase.rpc('disparar_push_teste', {
    p_admin_id: adminId,
    ...(jogadorIdAlvo != null ? { p_jogador_id_alvo: jogadorIdAlvo } : {}),
  });
  if (error) throw error;
}
```

(`database.types.ts:964` → `Args: { p_admin_id: number; p_jogador_id_alvo?: number | null }` —
o spread condicional satisfaz a tipagem opcional e mantém a chamada antiga intacta.)

### 4.3 `src/components/SecaoNotificacaoSaude.tsx` (editar)

1. **Hoist para export do módulo** (mesmo arquivo, nada duplicado):
   - `export const DIAS_OBSERVAR = 3;` / `export const DIAS_VERIFICAR = 14;`
   - `export type SaudeStatus = 'em_dia' | 'observar' | 'verificar' | 'sem_aparelho';`
   - `SaudeInfo` ganha campo `status: SaudeStatus` (o filtro compara o id, não o rótulo —
     imune a mudança de copy);
   - `export function saude(r: PainelEntregaJogador): SaudeInfo` e
     `export function calcularDiasSemEvidencia(...)`.
2. **Props novas**:

```ts
export interface SecaoNotificacaoSaudeProps {
  dados: PainelEntregaJogador[];
  carregando: boolean;
  erro: string | null;
  onAtualizar: () => void;
  /** Total da RPC sem filtros — alimenta o "N de M" do cabeçalho. */
  totalNaoFiltrado: number;
  /** true quando busca/status/categoria estão aplicados — troca a copy do estado vazio. */
  comFiltrosAtivos: boolean;
  // Pedido C: disparo de teste por atleta (estado por linha vive no pai)
  disparandoPara: number | null;
  onEnviarTeste: (jogador: PainelEntregaJogador) => void;
}
```

Assinatura **fixada** (validação 29/08): com `totalNaoFiltrado` a contagem do cabeçalho vira
"`{dados.length} de {totalNaoFiltrado} atletas com inscrição ativa`" (o M é o total real da RPC,
não o recorte filtrado); com `comFiltrosAtivos`, o estado vazio (`dados.length === 0`) mostra
"Nenhum atleta atende aos filtros aplicados." quando true e a copy atual de elenco vazio quando
false. O pai (`NotificacoesSaude`) calcula os dois: `totalNaoFiltrado = dados.length` e
`comFiltrosAtivos = busca.trim() !== '' || status !== 'todos' || categoriaFiltro !== 'todos'`.

3. **Título** sem numeração: "Saúde das Entregas por Atleta" (era "4. …", `:71`).
4. **Drill-down** (`:144-177`): após o bloco de `ultimo_erro`, botão
   **"Enviar push de teste"** — `min-h-[44px] w-full`, padrão de botão da tela (borda, `font-display
uppercase tracking-wider`), desabilitado quando `r.qtd_aparelhos === 0` com `<p>` explicativo
   ("Sem aparelho inscrito — o atleta precisa abrir o app primeiro."), e com spinner
   (`RefreshCw animate-spin`) + `disabled` quando `disparandoPara === r.jogador_id`.
5. **Hooks inalterados**: o componente continua com o único hook `useState(aberto)` no topo.

### 4.4 `src/routes/NotificacoesSaude.tsx` (novo)

Estrutura completa (hooks no topo, guard no final — AGENTS §5.1; flag `ativo` — §5.2):

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { Carregando, MensagemEstado } from '../components/Estado';
import { CampoBusca } from '../components/CampoBusca';
import { ModalSelecionarOpcao } from '../components/ModalSelecionarOpcao';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import {
  SecaoNotificacaoSaude,
  saude,
  type SaudeStatus,
} from '../components/SecaoNotificacaoSaude';
import {
  obterPainelEntregasPush,
  dispararPushTeste,
  type PainelEntregaJogador,
} from '../lib/notificacoes';
import { formatarMensagemErro } from '../lib/erros';
import { vibrateLight } from '../lib/haptics';
import { formatarNome } from '../lib/formatacao';

// Categorias determinísticas (AGENTS 8.3/8.5): goleiro domina (diária R$30,
// isento de avulso); senão mensalista; senão avulso. Randoms já vêm excluídos
// pela RPC do painel — 3 valores bastam.
type CategoriaAtleta = 'goleiro' | 'mensalista' | 'avulso';
function categoria(r: PainelEntregaJogador): CategoriaAtleta {
  if (r.posicao === 'goleiro') return 'goleiro';
  if (r.is_mensalista) return 'mensalista';
  return 'avulso';
}

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

const OPCOES_STATUS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'em_dia', label: 'Em dia' },
  { value: 'observar', label: 'Observar' },
  { value: 'verificar', label: 'Verificar aparelho' },
  { value: 'sem_aparelho', label: 'Sem aparelho' },
];
const OPCOES_CATEGORIA = [
  { value: 'todos', label: 'Todas as categorias' },
  { value: 'goleiro', label: 'Goleiro' },
  { value: 'mensalista', label: 'Mensalista' },
  { value: 'avulso', label: 'Avulso' },
];

export function NotificacoesSaude() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();
  const navigate = useNavigate();

  // Dados
  const [dados, setDados] = useState<PainelEntregaJogador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros (AND)
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'todos' | SaudeStatus>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<'todos' | CategoriaAtleta>('todos');
  const [modalStatusAberto, setModalStatusAberto] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);

  // Disparo de teste (Pedido C)
  const [disparandoPara, setDisparandoPara] = useState<number | null>(null);
  const [confirmarAlvo, setConfirmarAlvo] = useState<PainelEntregaJogador | null>(null);
  const { snackbarProps, mostrarSnackbar } = useSnackbar();
  // Timer da revalidação pós-disparo — limpo no unmount (sem setState pós-unmount, §5.2)
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Carregamento (padrão AGENTS §5.2 — flag ativo; sem useCache, §5.5)
  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregando(true);
      setErro(null);
      try {
        const dadosRpc = await obterPainelEntregasPush(jogador.id);
        if (isAtivo && !isAtivo()) return;
        setDados(dadosRpc);
      } catch (err) {
        if (isAtivo && !isAtivo()) return;
        setErro(formatarMensagemErro(err, 'Erro ao carregar o quadro de entregas.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
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

  // Filtros combináveis — direto em memo (elenco ~22-50 linhas; debounce
  // desnecessário, §3.2)
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return dados.filter((r) => {
      if (termo && !normalizar(r.username).includes(termo)) return false;
      if (status !== 'todos' && saude(r).status !== status) return false;
      if (categoriaFiltro !== 'todos' && categoria(r) !== categoriaFiltro) return false;
      return true;
    });
  }, [dados, busca, status, categoriaFiltro]);

  const handleEnviarTeste = useCallback(
    async (alvo: PainelEntregaJogador) => {
      if (!jogador || alvo.qtd_aparelhos === 0) return;
      setDisparandoPara(alvo.jogador_id);
      vibrateLight();
      try {
        await dispararPushTeste(jogador.id, alvo.jogador_id);
        // Honestidade (P5): disparo ≠ entrega — nunca afirmar "entregue"
        mostrarSnackbar('sucesso', 'Push de teste enfileirado — confirme a entrega no quadro.');
        // Revalida o ledger em ~10s; timer limpo no unmount (cleanup acima)
        timerRef.current = window.setTimeout(() => carregar(), 10_000);
      } catch (err) {
        mostrarSnackbar('erro', formatarMensagemErro(err, 'Falha ao enviar push de teste.'));
      } finally {
        setDisparandoPara(null);
      }
    },
    [jogador, carregar, mostrarSnackbar]
  );

  // Guard admin: após TODOS os hooks (AGENTS §5.1)
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <BotaoVoltar fallback="/notificacoes" />
      <div className="flex items-center justify-between sumula-header pb-2">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-destaque-texto" />
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Saúde das Entregas
          </h2>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
          Painel Push
        </span>
      </div>

      {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}

      {/* Filtros (Pedido B) — controles acima do quadro, dentro do card */}
      <CampoBusca
        valor={busca}
        aoMudar={setBusca}
        placeholder="Buscar atleta pelo nome…"
        ariaLabel="Buscar atleta por nome"
      />
      {/* Dois gatilhos de dropdown (44px) abrindo ModalSelecionarOpcao:
          gatilho de status mostra `OPCOES_STATUS.find(o => o.value === status)?.label`
          e o de categoria o análogo; modais usam opcoes/valorAtual/onSelecionar
          no padrão de Notificacoes.tsx:293-303. */}

      <SecaoNotificacaoSaude
        dados={filtrados}
        carregando={carregando}
        erro={erro}
        onAtualizar={() => carregar()}
        totalNaoFiltrado={dados.length}
        comFiltrosAtivos={busca.trim() !== '' || status !== 'todos' || categoriaFiltro !== 'todos'}
        disparandoPara={disparandoPara}
        onEnviarTeste={(alvo) => setConfirmarAlvo(alvo)} // ConfirmDialog primeiro
      />

      {confirmarAlvo && (
        <ConfirmDialog
          open
          titulo="Enviar push de teste?"
          mensagem={`Disparar uma notificação de teste para ${formatarNome(confirmarAlvo.username)} agora?`}
          onConfirm={() => {
            const alvo = confirmarAlvo;
            setConfirmarAlvo(null);
            if (alvo) void handleEnviarTeste(alvo);
          }}
          onClose={() => setConfirmarAlvo(null)}
        />
      )}

      <ModalSelecionarOpcao
        open={modalStatusAberto}
        titulo="Status de Saúde"
        subtitulo="Mesmos limiares dos badges do quadro (3 e 14 dias)"
        opcoes={OPCOES_STATUS}
        valorAtual={status}
        onSelecionar={(v) => setStatus(v as 'todos' | SaudeStatus)}
        onClose={() => setModalStatusAberto(false)}
      />
      <ModalSelecionarOpcao
        open={modalCategoriaAberto}
        titulo="Categoria do Atleta"
        subtitulo="Goleiro, mensalista ou avulso"
        opcoes={OPCOES_CATEGORIA}
        valorAtual={categoriaFiltro}
        onSelecionar={(v) => setCategoriaFiltro(v as 'todos' | CategoriaAtleta)}
        onClose={() => setModalCategoriaAberto(false)}
      />

      <Snackbar {...snackbarProps} />
    </div>
  );
}
```

Notas de implementação:

- **Estado vazio por filtro / contagem filtrada**: resolvidos pelas props fixadas `totalNaoFiltrado`
  e `comFiltrosAtivos` (§4.3) — o componente usa `totalNaoFiltrado` no "N de M" do cabeçalho e
  troca a copy do estado vazio conforme `comFiltrosAtivos` (comportamento da tabela §5).
- `formatarNome` reutilizado do import já existente na seção (`SecaoNotificacaoSaude.tsx:6`).

### 4.5 `src/lib/rotas.ts` (editar)

```ts
const carregarNotificacoesSaude = () => import('../routes/NotificacoesSaude');
// ...
export const NotificacoesSaude = lazy(() =>
  carregarNotificacoesSaude().then((m) => ({ default: m.NotificacoesSaude }))
);
// TABELA_PRE_CARREGAMENTO — ANTES da entrada genérica de /notificacoes:
{ padrao: /^\/notificacoes\/saude/, carregar: carregarNotificacoesSaude },
{ padrao: /^\/notificacoes/, carregar: carregarNotificacoes },
```

(A genérica `/^\/notificacoes/` já casa com o prefixo e serviria de prefetch, mas a entrada
específica mantém a simetria com `/estatisticas/*` e é à prova de reordenação.)

### 4.6 `src/App.tsx` (editar)

Importar `NotificacoesSaude` de `./lib/rotas` e declarar a sub-rota **adjacente** à rota
`/notificacoes` (sem segmentos dinâmicos no prefixo, a ordem é irrelevante para o React Router v7 —
a adjacência é só legibilidade):

```tsx
<Route path="/notificacoes" element={<Notificacoes />} />
<Route path="/notificacoes/saude" element={<NotificacoesSaude />} />
```

### 4.7 `src/routes/Layout.tsx` (editar)

Importar `SkeletonNotificacoesSaude` e inserir em `SKELETONS_POR_ROTA` **antes** da linha
`/^\/notificacoes/` (`Layout.tsx:53`):

```tsx
{ padrao: /^\/notificacoes\/saude/, Skeleton: SkeletonNotificacoesSaude },
{ padrao: /^\/notificacoes/, Skeleton: SkeletonNotificacoes },
```

**Não mexer** em `isFluxoFocado` (`:103`) nem na TabBar.

### 4.8 `src/components/Skeletons.tsx` (editar)

`SkeletonNotificacoesSaude` novo, espelhando a tela real (CLS = 0, AGENTS §5.4): container
idêntico (`px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 animate-pulse`), voltar (`h-3
w-16`), header `sumula-header` (`size-5` + `h-6 w-44`), campo de busca (`h-11 w-full`), fileira
de 2 dropdowns (`h-11` em grid 2 colunas) e lista contínua de **8 linhas `h-11`** em
`divide-y divide-borda/40 border-y border-borda`.

### 4.9 `src/routes/Notificacoes.tsx` (editar)

1. Remover: estados `painel/carregandoPainel/erroPainel` (`:50-53`), `carregarPainel` + efeito
   (`:103-131`), render da seção (`:259-265`) e imports de `SecaoNotificacaoSaude` +
   `obterPainelEntregasPush` + `PainelEntregaJogador` (`:16,29,32`).
2. Incluir **card de atalho estático** (após o `</form>`, no lugar da seção 4), estilo
   `SecaoNotificacaoTestes`: `bg-superficie-2`, título "Saúde das Entregas por Atleta",
   sublinha curta ("Quadro de aparelhos e entregas por atleta"), seta `ChevronRight`, `min-h-[44px]`,
   `onClick={() => navigate('/notificacoes/saude')}` + `onTouchStart` de `preCarregarRota`
   (o prefetch da TABELA já cobre, mas o toque direto é grátis). Requer `useNavigate` (não existe
   hoje na tela — adicionar no topo dos hooks).
3. Renumerar? **Não**: as seções 1-3 mantêm numeração atual (o card de atalho não é seção
   numerada — é navegação).

### 4.10 Checagens finais (AGENTS §11.2)

`npx supabase db push` (migration primeiro — ver ordem §7) → `npm run lint` (0 erros) →
`npm run format` → `npm run build` → validação em produção (§6).

---

## 5. Casos de borda

| Caso                                                  | Tratamento                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Busca sem resultado / combinação de filtros vazia** | `filtrados.length === 0` com `dados.length > 0` → `MensagemEstado tipo="info"` "Nenhum atleta atende aos filtros aplicados." + contagem "0 de M". Nunca tela em branco.                                                      |
| **Busca com acento**                                  | `normalizar()` NFD + strip `\p{Diacritic}` — "joao" acha "victor tchuca"? não; mas "vitor" acha "vitor andre" e "VICTOR" acha "victor tchuca" (case-insensitive). Helper local documentado (§3.2).                           |
| **Goleiro mensalista (hipotético)**                   | Precedência documentada: vira categoria **Goleiro** (§3.2). Não existe hoje (os 4 goleiros ativos = `is_mensalista=false`, §2.4) — sem ambiguidade real.                                                                     |
| **Atleta sem aparelho + push de teste**               | Dupla barreira: botão desabilitado no drill-down (com explicação) **e** `RAISE EXCEPTION 'Atleta sem aparelho inscrito…'` na RPC (defesa contra chamada manual/antiga UI).                                                   |
| **Disparo duplo (2 cliques rápidos)**                 | `disparandoPara` desabilita o botão da linha durante o disparo; o `ConfirmDialog` fecha antes do disparo (segundo clique reabriria diálogo). RPC é idempotente no pior caso (2 pushes de teste — inofensivo).                |
| **Erro de rede / RPC ausente**                        | `formatarMensagemErro` → `MensagemEstado tipo="erro"` no topo da tela; quadro continua com o último dado em tela se for falha de recarga (padrão tolerante da análise §4a).                                                  |
| **Deploy do front antes do `db push` da 108**         | `dispararPushTeste` com alvo falha com erro da RPC ("function is not unique / does not exist") → Snackbar de erro amigável; o restante da tela (quadro, filtros) funciona — por isso a migration vai primeiro na ordem (§7). |
| **Cold start da Edge Function**                       | `cron_execucoes` pode registrar "Timeout" com push entregue (`104:18-20`) — por isso o feedback é "enfileirado" + revalidação do quadro em ~10s; a verdade está no ledger da própria linha, nunca no status do disparo.      |
| **TOCTOU na pré-checagem**                            | Inscrição apagada entre `count(*)` e o POST → 404 da function com cleanup automático do endpoint (`send-test-push/index.ts:90-92`); pior caso: linha volta a "Sem aparelho" no quadro. Aceitável e documentado.              |
| **Skeleton errado em deep-link**                      | `/notificacoes/saude` direto por URL: entrada `/^\/notificacoes\/saude/` vem antes da genérica em `Layout.tsx` (ordem do `find`) — skeleton da lista, não do formulário.                                                     |
| **Admin não-logado / não-admin**                      | Guard pós-hooks `<Navigate to="/" replace />`; RPC tem gate próprio (`is_admin`) — a UI nunca é a única defesa.                                                                                                              |
| **URL antiga / favorito**                             | Nenhum redirecionamento necessário: a seção nunca teve URL própria; o atalho novo orienta o admin.                                                                                                                           |

---

## 6. Validação em produção (sem testes automatizados — decisão do usuário; proibido script/CI)

1. **SQL Editor do Supabase** (após `npx supabase db push`):
   ```sql
   -- Assinatura nova ativa e sem overload remanescente:
   SELECT p.proname, pg_get_function_identity_arguments(p.oid)
     FROM pg_proc p WHERE p.proname = 'disparar_push_teste';
   -- Deve listar SOMENTE (p_admin_id bigint, p_jogador_id_alvo bigint).

   -- Gate: com NÃO-admin deve estourar 'Acesso restrito a administradores.'
   SELECT disparar_push_teste(<ID_NAO_ADMIN>, <ID_QUALQUER>);

   -- Alvo sem aparelho (conferir antes): deve estourar
   -- 'Atleta sem aparelho inscrito…' SEM chamar a Edge Function.
   SELECT count(*) FROM push_subscriptions WHERE jogador_id = <ID_SEM_APARELHO>;
   SELECT disparar_push_teste(<ID_ADMIN>, <ID_SEM_APARELHO>);

   -- Alvo inativo/random: deve estourar 'Atleta alvo não encontrado ou inativo.'
   SELECT disparar_push_teste(<ID_ADMIN>, <ID_RANDOM_OU_INATIVO>);

   -- Retrocompatibilidade: chamada de 1 argumento (próprio admin) continua válida.
   SELECT disparar_push_teste(<ID_ADMIN>);
   ```
2. **REST/PostgREST** (shape e gate):
   ```bash
   curl -s "$SUPABASE_URL/rest/v1/rpc/disparar_push_teste" \
     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"p_admin_id": 999999, "p_jogador_id_alvo": 24}';
   # gate deve bloquear (exceção), nunca disparar
   ```
3. **UI manual** (admin logado, tema claro e escuro):
   - `/notificacoes`: seção "4." ausente; card de atalho navega para `/notificacoes/saude`;
     formulário de config intocado (salvar/testar push próprios seguem funcionando).
   - `/notificacoes/saude`: skeleton da **lista** durante o carregamento do chunk (não o do
     formulário); TabBar visível; busca filtra enquanto digita (com acento e sem); dropdown de
     status agrupa igual aos badges (conferir um "Observar" e um "Sem aparelho"); dropdown de
     categoria separa os 4 goleiros ativos (Dudu, Pedrinho, geilson, Rodrigo) como Goleiro —
     re-medir na execução; 3 filtros combinados (AND); estado vazio com
     filtros impossíveis mostra mensagem e contagem "0 de M".
   - Push de teste: em atleta com aparelho, ConfirmDialog → Snackbar "enfileirado" → linha do
     atleta atualiza `ultima_entrega_em` após a revalidação (~10s) ou manual (botão atualizar);
     em atleta sem aparelho, botão desabilitado com explicação; spinner só na linha alvo.
   - Alvos ≥ 44px, foco visível âmbar, datas/números em `font-mono tabular-nums`, nenhum
     `window.confirm`/`alert` (grep no diff).
4. **Executar** `npm run lint` (0 erros), `npm run format:check` e `npm run build` antes do deploy.

---

## 7. Esforço, riscos e ordem

| Item                                   | Esforço   | Risco       | Mitigação                                                                                                                                                                                                          |
| -------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Tela apartada `/notificacoes/saude` | M (~3h)   | Baixo       | Ordem das entradas de regex em `rotas.ts`/`Layout.tsx` (sub-rota antes do prefixo); não tocar em `isFluxoFocado`; gate admin pós-hooks.                                                                            |
| B. Filtros combináveis                 | S-M (~2h) | Baixo       | `saude()` exportada (regra única); filtro direto em `useMemo` (sem debounce); `CampoBusca` + `ModalSelecionarOpcao` reutilizados; sem `useCache`.                                                                  |
| C. Push por atleta (migration)         | M (~2-3h) | Médio-baixo | `DROP FUNCTION IF EXISTS` da assinatura antiga (evita overload — lição 088); `DEFAULT NULL` retrocompatível; pré-checagem de aparelhos na RPC; `ConfirmDialog` + Snackbar honesto; `database.types.ts` atualizado. |
| **Total**                              | **~7-8h** |             |                                                                                                                                                                                                                    |

- **Risco 1 — numeração da migration disputada com o plano P2**: ambos apontam para 108. **Mitigação**: regra do §4 — `ls supabase/migrations | tail -3` no momento da execução e usar o próximo livre; quem executar primeiro ganha o número.
- **Risco 2 — ordem deploy front × db push**: front novo chamando RPC nova sem migration aplicada quebra só o botão de teste. **Mitigação**: migration primeiro na ordem de execução; falha isolada via `formatarMensagemErro` (§5).
- **Risco 3 — regressão na `/notificacoes`**: a remoção da seção 4 toca estados/efeitos existentes. **Mitigação**: remoção limpa (estados `painel*` inteiros), validação manual do form de config no §6.3.
- **Risco 4 — `setTimeout(10_000)` pós-unmount**: se o admin sair da tela em <10s, `carregar()` rodaria pós-unmount. **Mitigação**: já incorporada ao esboço do §4.4 — `timerRef` + cleanup `window.clearTimeout` no unmount (espírito do AGENTS §5.2; sem setState pós-unmount).
- **Ordem sugerida**: 4.1 (migration + push + validação SQL §6.1) → 4.2 (lib) → 4.3/4.8 (seção + skeleton) → 4.4 (tela nova) → 4.5-4.7 (roteamento/Layout) → 4.9 (tela-mãe) → 4.10 (lint/format/build) → §6 (validação UI/REST). Migration primeiro valida gate e mensagens antes de qualquer UI existir.

---

## 8. Escopo fechado

Faz **apenas** os 3 pedidos (§3.1-§3.3). **Não faz**:

- Não exibir `cron_execucoes` / `obter_execucoes_cron` na UI (saúde do _pipeline_; item "deixar para depois" da análise §3.4).
- Não filtrar/agregar na RPC (`obter_painel_entregas_push` sem parâmetros novos) e sem `useCache`, paginação, virtualização ou ordenação alternável na tela nova.
- Não ações em lote (testar N atletas de uma vez), não limpeza manual de subscrições, não exportação.
- Não alterar `isFluxoFocado` nem a TabBar; não criar segunda RPC de teste (overload foi **removido**, não criado); não chamar Edge Function do client nem expor secrets; não tocar nas demais Edge Functions; não expor endpoint FCM completo, `p256dh` ou `auth`.
- Não renomear/remunerar seções 1-3 da `/notificacoes` (o card de atalho não é seção numerada).
