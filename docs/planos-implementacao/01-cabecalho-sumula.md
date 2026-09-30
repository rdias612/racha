# 01 · CabecalhoSumula — Plano de Implementação

> Ref.: item **A1** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#1 (nota 9,5)**, Tier 1 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: M · Risco: baixo · Prioridade global do plano: P0

## 1. Objetivo

Extrair o bloco de cabeçalho editorial "Súmula de Quinta" (kicker mono + título `font-display` + linha pontilhada `sumula-header`) para o componente único `CabecalhoSumula`, eliminando a maior duplicação literal do app (~200 LOC repetidas em 21 arquivos de tela + `Skeletons.tsx` espelhando a geometria). Toda tela nova passa a consumir o cabeçalho pronto, com hierarquia de headings (`h1`/`h2`) estável e um único ponto de mudança para o elemento visual mais recorrente.

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em 2026-09-30 (números corrigidos onde divergiam dos docs de origem):

- **22 arquivos** contêm `sumula-header` (grep confirmado; o ranking dizia 23 — número corrigido): **18 rotas** em `src/routes/` + **3 componentes de seção** + `src/components/Skeletons.tsx`.
- Componentes de seção citados: `src/components/ListaReceitasAbertas.tsx:62`, `src/components/ListaDespesasAbertas.tsx:25`, `src/components/EscalacaoTimesEditor.tsx:231` — todos conferidos.
- As 4 telas do módulo notificações carregam blocos byte-idênticos entre si (linha do container idêntica nos 4 arquivos): `src/routes/NotificacoesConfirmacao.tsx:136`, `src/routes/NotificacoesVotacao.tsx:103`, `src/routes/NotificacoesTestes.tsx:124`, `src/routes/NotificacoesSaude.tsx:70`.
- `src/components/Skeletons.tsx` espelha a geometria do cabeçalho em 7 pontos: linhas **17, 60, 100, 145, 189, 362, 413** (todas conferidas).
- Drifts já visíveis:
  - `font-black` só em `src/routes/GestaoGoleiros.tsx:190` (cabeçalho na linha 184; demais telas usam `font-bold`) — conferido.
  - Mistura sem hierarquia estável: `h1 text-2xl` em `src/routes/Resumo.tsx:128` vs `h2 text-xl` nas demais rotas — conferido.
- Variações do bloco hoje: kicker **abaixo** do título na maioria (ex.: `Jogos.tsx:110-118`, `NovoJogador.tsx:98-107`); kicker **acima** só no `Resumo.tsx:125-130`; slot à direita com meta de texto (`Oficial CBO` em `Ranking.tsx:223-230`), contador (`Resumo.tsx:132-134`), CTA-Link (`Jogos.tsx:119-122`) ou bloco de Badge/countdown (`PartidaDetalhe.tsx:181-183`, `PartidaVotar.tsx:290-294`).
- `BotaoVoltar` fica **sempre fora** do bloco (irmão anterior no JSX — ex.: `NotificacoesConfirmacao.tsx:134`).

## 3. Pré-condições e dependências

- **Plano 17 (pasta `ui/`)**: conforme o README ("custa ~zero se aplicado no commit de criação"), o Passo 1 já adota a convenção — `CabecalhoSumula` nasce em `src/components/ui/CabecalhoSumula.tsx`. Não é bloqueante, mas deve ser executado **junto** (mesmo commit), nunca depois como mudança separada.
- Sem dependência dos planos 02 (`Botao`), 03 (invalidação) e 04 (`CampoTexto`) — este plano é independente e pode ser o primeiro da onda anti-slop (ordem recomendada: 03 → **01** → 02 → 04).
- **Decisões do dono**: nenhuma pendente para este item (o README lista decisões apenas para os planos 02, 24, 26 e 08). Normalizações deliberadas de migração estão registradas na seção 4 e devem ser validadas visualmente, não decididas caso a caso.
- Restrição de janela: nenhuma (markup puro, sem estado, sem chamada de rede). Pode ser executado a qualquer momento; `PartidaAoVivo.tsx` é migração mecânica de markup, sem risco de fluxo.

## 4. Plano de execução (1 passo = 1 commit)

Cada passo é pequeno, reversível por `git revert` isolado e revisável isoladamente. Migração **rota por rota**, começando pelas 4 cópias byte-idênticas do módulo notificações. **Sem mudança visual** em nenhuma migração (exceto as duas normalizações registradas nos passos 17 e 18).

### Passo 1 — Criar o componente (adoção do plano 17 neste commit)

- Criar `src/components/ui/CabecalhoSumula.tsx` (diretório novo — convenção do plano 17; os 63 componentes existentes **não se movem**).
- Seguir o estilo das primitivas existentes (ex.: `Badge.tsx`: interface de props explícita, props em pt-BR, `ReactNode` para slots).

Assinatura proposta:

```tsx
import type { ReactNode } from 'react';

export interface CabecalhoSumulaProps {
  titulo: string;
  /** Linha mono acima de nada / abaixo do título — caso de 16/18 rotas. */
  kicker?: string;
  /** Ícone à esquerda do título (ex.: <Bell className="size-5 text-destaque-texto" />). */
  icone?: ReactNode;
  /** Slot à direita: meta "Oficial CBO", contador, CTA-Link, Badge, countdown. */
  acao?: ReactNode;
  /** md = text-xl (padrão) · lg = text-2xl (caso Resumo). */
  tamanho?: 'md' | 'lg';
  /** Tag do heading. Padrão 'h2'. Resumo usa 'h1'. */
  nivel?: 'h1' | 'h2' | 'h3';
  /** Escape raro no container (mesmo padrão de className no Badge). */
  className?: string;
}
```

Markup canônico (replica exatamente as classes dominantes atuais — não inventar estilo novo):

```tsx
export function CabecalhoSumula({ titulo, kicker, icone, acao, tamanho = 'md', nivel: Tag = 'h2', className }: CabecalhoSumulaProps) {
  return (
    <div className={`flex items-end justify-between gap-3 sumula-header pb-2 ${className ?? ''}`}>
      <div>
        <Tag className={`font-display font-bold uppercase tracking-wider text-giz ${tamanho === 'lg' ? 'text-2xl' : 'text-xl'} ${icone ? 'flex items-center gap-2' : ''}`}>
          {icone}
          {titulo}
        </Tag>
        {kicker && (
          <p className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco mt-0.5">{kicker}</p>
        )}
      </div>
      {acao}
    </div>
  );
}
```

(Ajustar detalhes na implementação para replicar 1:1 os padrões de `Jogos.tsx:110-118` e `NovoJogador.tsx:98-107`; sem dependência nova, sem helper de merge de classes.)

### Passos 2–5 — Módulo notificações (as 4 cópias byte-idênticas)

Um commit por rota, nesta ordem:

1. **Passo 2**: `src/routes/NotificacoesConfirmacao.tsx:136` → `<CabecalhoSumula titulo="Gestão de Notificações" icone={<Bell ... />} acao={<span ...>Painel Push</span>} />`
2. **Passo 3**: `src/routes/NotificacoesVotacao.tsx:103` (mesmos props)
3. **Passo 4**: `src/routes/NotificacoesSaude.tsx:70` (mesmos props)
4. **Passo 5**: `src/routes/NotificacoesTestes.tsx:124` (mesmos props)

### Passos 6–11 — Rotas simples (título + meta de texto à direita)

Um commit por rota; cada migração é remover o bloco inline e chamar o componente:

| Passo | Arquivo | Props principais |
|---|---|---|
| 6 | `src/routes/Ranking.tsx:223` | `titulo={configuracao.titulo}` `acao="Oficial CBO"` |
| 7 | `src/routes/Estatisticas.tsx:163` | `titulo` (com sufixo condicional) `acao="Oficial CBO"` |
| 8 | `src/routes/EstatisticasRacha.tsx:148` | `titulo="Estatísticas do Racha"` `acao="Oficial CBO"` |
| 9 | `src/routes/Comparador.tsx:205` | `titulo="Confronto Direto"` `acao="Estatísticas CBO"` |
| 10 | `src/routes/PartidaNova.tsx:187` | `titulo="Nova Partida da Súmula"` `acao="14 Titulares"` (meta em `text-destaque-texto` — repassar via `acao` com o `<span>` existente) |
| 11 | `src/routes/Administrador.tsx:199` | `titulo="Controle Financeiro"` `icone={<Wallet ... />}` `acao="Súmula CBO"` |

### Passos 12–14 — Rotas com ícone + kicker abaixo do título

| Passo | Arquivo | Props principais |
|---|---|---|
| 12 | `src/routes/GestaoJogadores.tsx:286` | `titulo="Gestão de Atletas"` `icone={<Users ... />}` `kicker={...}` (usa `MAX_MENSALISTAS`) |
| 13 | `src/routes/NovoJogador.tsx:98` | `titulo="Novo Jogador da Súmula"` `icone={<UserPlus ... />}` `kicker="Cadastro oficial de atleta do racha"` |
| 14 | `src/routes/Jogos.tsx:110` | `titulo="Mural de Jogos"` `kicker="Temporada Oficial"` `acao={<Link to="/partida/nova" ...>}` (o CTA-Link inteiro entra no slot `acao`, sem alteração) |

### Passos 15–19 — Rotas complexas (uma normalização registrada cada)

| Passo | Arquivo | Observações |
|---|---|---|
| 15 | `src/routes/PartidaDetalhe.tsx:171` | `titulo="Partida #{id}"` `kicker` (data responsiva — extrair para prop ou manter o `<p>` via `kicker` aceitando ReactNode, decidir na implementação) + `acao` = bloco de Badges à direita |
| 16 | `src/routes/PartidaAoVivo.tsx:244` | Mesmo formato do Passo 15; validar tela crítica manualmente |
| 17 | `src/routes/GestaoGoleiros.tsx:184` | **Normalização deliberada**: `font-black` (linha 190) cai para o `font-bold` canônico — ou, se o dono preferir peso preservado, usar `className` no heading via escape; registrar na validação. `kicker` = linha PIX/total |
| 18 | `src/routes/Resumo.tsx:123` | `nivel="h1"` `tamanho="lg"` (preserva `h1 text-2xl` da linha 128). **Normalização deliberada**: kicker "BOLETIM OFICIAL DO RACHA" move de acima para abaixo do título (caso 16/18). `acao` = contador de partidas (`tabular-nums`) |
| 19 | `src/routes/PartidaVotar.tsx:286` | Título composto condicional (`editando ? ... : ...`) + `acao` = bloco countdown/label (layout interno do slot preservado) |

### Passos 20–22 — Componentes de seção (não são rotas)

| Passo | Arquivo | Observações |
|---|---|---|
| 20 | `src/components/ListaReceitasAbertas.tsx:62` | Cabeçalho da seção; validar dentro da tela que a hospeda |
| 21 | `src/components/ListaDespesasAbertas.tsx:25` | Idem |
| 22 | `src/components/EscalacaoTimesEditor.tsx:231` | Último call site; ao encerrar, `grep -rn "sumula-header" src/` só deve restar em `Skeletons.tsx` + o próprio `CabecalhoSumula.tsx` |

## 5. Validação manual

Sem testes automáticos (conforme AGENTS.md). A cada commit:

- [ ] `npm run build` passa (TypeScript sem erro de props).
- [ ] Rota migrada aberta no navegador/aparelho: cabeçalho **visualmente idêntico** ao anterior (comparar lado a lado com a versão anterior via `git stash` ou build anterior, se necessário) — exceto as normalizações registradas nos passos 17 e 18.
- [ ] Tag do heading no DOM correto (`h1` no Resumo, `h2` nas demais — inspecionar via DevTools).
- [ ] Linha pontilhada `sumula-header` presente e alinhada; sem scroll horizontal novo; slot `acao` clicável e posicionado como antes.
- [ ] Módulo notificações (passos 2–5): navegar entre as 4 abas/telas e confirmar cabeçalho idêntico nas quatro.
- [ ] Skeletons **não** mudaram de alinhamento (a geometria do componente deve reproduzir exatamente as classes antigas — se o skeleton "sobra" ou "falta" pixel, o markup canônico divergiu; corrigir antes de seguir).
- [ ] Ao final (passo 22): `grep -rn "sumula-header" src/` retorna apenas `ui/CabecalhoSumula.tsx` e `Skeletons.tsx`.

## 6. Fora de escopo

- **`Skeletons.tsx` NÃO migra**: os 7 pontos (linhas 17, 60, 100, 145, 189, 362, 413) são formas neutras para CLS=0; acoplá-los ao componente criaria dependência bidirecional. O comentário de referência no topo de `Skeletons.tsx` apontando `CabecalhoSumula` é escopo do **plano 34** (A10).
- **`BotaoVoltar` continua fora** do componente (hoje é irmão anterior no JSX em todas as telas — preservar o layout).
- Não mover os 63 componentes existentes de `src/components/` para `ui/` (só o plano 17, por toque).
- Não normalizar hierarquia de headings além do que as props `nivel`/`tamanho` preservam (Resumo continua `h1 text-2xl`; nenhuma tela muda de tag).
- Não unificar o peso `font-black` de `GestaoGoleiros` além do registrado no passo 17; sem tocar `Botao`, campos ou qualquer outro bloco (planos 02 e 04).
- Sem novas bibliotecas, sem helper de classes, sem testes automáticos.

## 7. Riscos e rollback

- **Risco principal: drift visual silencioso** — o componente replicar as classes com pequena diferença (padding, tracking, peso) e o erro se multiplicar por 21 telas. Mitigação: markup canônico copiado 1:1 dos blocos dominantes atuais; checklist de comparação visual por rota (seção 5); skeleton como detector de geometria.
- **Risco: slot `acao` heterogêneo** — metas de texto, Links, Badges e countdowns têm alinhamentos próprios (`items-baseline` vs `items-center` vs `items-start`). Mitigação: o slot é `ReactNode` puro; o bloco externo de cada caso complexo pode exigir `className` de escape; se um caso não couber sem mudança visual, adiar o passo e registrar.
- **Rollback**: todo passo é 1 commit isolado → `git revert <commit>` restaura a rota para o bloco inline sem afetar as demais. O Passo 1 (criação) pode ser revertido sozinho apenas se nenhum passo seguinte tiver acontecido; caso contrário, reverter os passos de migração em ordem inversa. Nenhuma migração altera dados, rotas do roteador ou o service worker.
