# Partida ao vivo (`feat/open-match`)

Registro de gols **durante o jogo**, em vez de lançar o placar só no fim.

Antes, o admin criava a partida (`draft`), ia em **Finalizar** e digitava gols/assists/gols contra na mão. Só então a partida virava `published` e a votação abria.

Agora o ciclo é:

```
draft  →  live  →  published  →  closed
         (ao vivo)  (votação)    (craque)
```

| Status | Significado |
|---|---|
| `draft` | Times montados, jogo ainda não começou |
| `live` | Partida aberta. Admin lança eventos no campo. **Não entra no ranking** |
| `published` | Jogo encerrado. Contadores gravados. Votação 24h |
| `closed` | Votação encerrada (cron, como antes) |

---

## O que o admin faz

1. **Cria a partida** — mesmo fluxo de sempre: escolher 16, confirmar, escalar Preto/Branco 8×8. Continua salvando como `draft`.
2. **Abre a partida** — no detalhe, CTA **Abrir partida**. Vai para `/partida/:id/ao-vivo`.
3. **Lança eventos** — toca no jogador no campo:
   - **Gol** → segundo passo: quem deu a assistência (ou “Sem assistência”).
   - **Gol contra** — sem assistência.
4. **Acompanha o placar** — calculado pelos eventos (gol soma no time do autor; gol contra soma no adversário).
5. **Edita ou desfaz** se errou (só enquanto estiver `live`): tipo, jogador e assistência.
6. **Finaliza** — agrega gols/assists/gols contra em `partidas_participantes`, status `published`, `voting_closes_at = now()+24h`. Os 16 da partida podem votar.

Quem não é admin vê o campo e o placar, mas não lança evento.

Atalho antigo permanece: **Lançar resultado sem acompanhar** (tela de steppers) para jogo que já acabou e não foi acompanhado ao vivo.

---

## Regras

- Só abre se estiver `draft` e tiver 8 no Preto e 8 no Branco.
- Só registra/edita/remove evento em `live`.
- Assistência só em gol, do **mesmo time**, e não pode ser o próprio autor.
- Eventos são gravados **na hora** (refresh não perde gol). Ao finalizar, os contadores são recalculados a partir do log (fonte da verdade).
- Ranking, stats, parcerias e resumo do ano **continuam só com `published` + `closed`**. Partida `live` não pontua.
- Lista de Jogos: `draft` mostra `— × —`; `live` já mostra o placar atual.

Tipos de evento hoje: `gol` e `gol_contra`. A tabela aceita novos tipos no futuro (cartão, etc.) com migration.

---

## Banco (`047_partida_live_eventos.sql` + `048_rpc_editar_evento.sql`)

**Obrigatório aplicar no SQL Editor do Supabase** antes de testar. Sem isso, as RPCs não existem.

### Status

`partidas.status` passa a aceitar `live`.

### Tabela `partida_eventos`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | bigserial | PK |
| `partida_id` | bigint | FK `partidas`, cascade |
| `tipo` | text | `gol` \| `gol_contra` |
| `jogador_id` | bigint | quem fez o gol / gol contra |
| `assistencia_jogador_id` | bigint nullable | só em gol; ≠ autor |
| `created_at` | timestamptz | |

CHECK: gol contra não pode ter assistência.

### Funções

| RPC | Efeito |
|---|---|
| `abrir_partida(id)` | `draft` → `live`. Zera contadores e eventos. Exige 8+8. |
| `registrar_evento(partida, tipo, jogador, assist?)` | Insert + sincroniza contadores. Só `live`. |
| `editar_evento(evento_id, tipo, jogador, assist?)` | Update + sincroniza contadores. Só `live`. |
| `remover_evento(evento_id)` | Delete + sincroniza. Só `live`. |
| `finalizar_partida(id)` | Sincroniza, `live` → `published`, abre votação 24h. |
| `sincronizar_contadores_partida(id)` | Interna. Recalcula `gols`, `assistencias`, `gols_contra` a partir do log. Sem GRANT a `anon`. |

A view `partida_placar` não mudou: ela soma os contadores. Como a sincronização roda a cada evento, a lista de Jogos reflete o placar ao vivo.

Segurança igual ao resto do app (Regra 6): sem RLS; o client é confiável; admin só na UI.

---

## Front

### Novos

| Arquivo | Papel |
|---|---|
| `src/routes/PartidaAoVivo.tsx` | Tela `/partida/:id/ao-vivo`: campo, eventos, abrir/finalizar |
| `src/components/CampoPartida.tsx` | Campo: Branco em cima (claro), Preto embaixo (escuro), placar no meio |
| `src/components/DialogoEvento.tsx` | Popup: tipo do evento → assistência |

### Alterados

| Arquivo | O que mudou |
|---|---|
| `src/App.tsx` | Rota `/partida/:id/ao-vivo` |
| `src/lib/partidas.ts` | Status `live`; labels; `EventoPartida`; helpers/RPCs de evento; `placarDeEventos` |
| `src/lib/times.ts` | `LINHAS_CAMPO` (goleiro → zagueiro/lateral → meia → atacante) |
| `src/routes/PartidaDetalhe.tsx` | CTAs Abrir / Registrar eventos / Lançar sem acompanhar. Sem placar no `draft` |
| `src/routes/Jogos.tsx` | Badge “Em andamento”; card `live` vai direto ao campo; placar `— × —` no draft |
| `src/routes/PartidaEditar.tsx` | Se a partida está `live`, redireciona para o campo |

Votação, ranking, perfil, push e cron de fechamento **não foram alterados**. Continuam reagindo só a `published`.

---

## Como testar

1. Aplicar `047_partida_live_eventos.sql` e `048_rpc_editar_evento.sql` no SQL Editor do Supabase.
2. Logar como admin → Jogos → Nova partida → escalar times → Criar.
3. **Abrir partida** → tocar num jogador → gol + assistência (e um gol contra).
4. Conferir placar e lista de eventos. **Editar** um (trocar jogador/tipo/assistência) e **Desfazer** outro.
5. Recarregar a página: eventos e placar permanecem.
6. **Finalizar partida** → detalhe com placar, gols/assists por jogador e botão **Votar**.
7. Logar como jogador da partida e votar.
8. Conferir que o jogo ainda `live` **não** aparece no ranking; depois de finalizar, aparece.

---

## Fora desta entrega

- Outros eventos (cartão, substituição, etc.).
- Editar times depois de criada a partida.
- Trava server-side de “só admin chama as RPCs” (igual ao restante do app).
- Relógio / minuto do gol.
