# 08 · Migrar `DialogoEvento` para `ModalBase` — Plano de Implementação

> Ref.: item **A5** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#8 (nota 5,5)**, Tier 2 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: médio · Prioridade global do plano: P2

## 1. Objetivo

Reescrever o `DialogoEvento` sobre o `ModalBase`, eliminando a **terceira implementação completa do shell de modal** do app (portal, overlay com clique-fora, focus trap e ARIA duplicados do shell canônico). Ao contrário das cópias visuais simples, esta duplicação é **estrutural inteira**: qualquer correção de acessibilidade ou comportamento feita no `ModalBase` (safe-area, foco inicial, animação, scrim) não chega ao diálogo de gols. É a última cópia do shell — o `ConfirmDialog` fica de fora por decisão do plano — encerrando o problema com um único arquivo reescrito e nenhum call site alterado.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

- `src/components/DialogoEvento.tsx:59-76` reimplementa o shell completo que `src/components/ModalBase.tsx:63-85` já encapsula: `createPortal(..., document.body)`, overlay `fixed inset-0 z-50` com fecho por `onMouseDown` fora do painel, `ref={containerRef}` + `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + `tabIndex={-1}` + `onKeyDown`, todos alimentados por uma chamada própria de `useModalA11y` (`DialogoEvento.tsx:39-43`, com `disableEscape: salvando`).
- A chamada duplicada de `useModalA11y` é o ponto de maior drift: dois consumidores do mesmo hook mantêm duas noções independentes de "modal aberto" na mesma árvore de `PartidaAoVivo`.
- Divergências já existentes entre as duas cascas (drift real): scrim `bg-black/70` vs `bg-black/75`; animação `translate-y` vs `scale`; painel sem `max-h`/rolagem vs corpo `flex-1 overflow-y-auto` com `max-h-[90vh]`; ausência de `paddingBottom: env(safe-area-inset-bottom)` vs presença.
- `src/components/ModalBase.tsx:13-15` confirma a API necessária para a migração: `tamanhoMaximo?: 'sm' | 'md' | 'lg'`, `posicao?: 'bottom-sheet' | 'centro'` e `mostrarBotaoFechar?: boolean`; além de `titulo`/`subtitulo` dinâmicos (suficientes para o cabeçalho trocar por etapa) e `disableEscape` (paridade com o atual).
- Guarda de fechamento durante salvamento: hoje o overlay fecha só com `!salvando` (`DialogoEvento.tsx:61-63`) e o Escape é bloqueado por `disableEscape: salvando` (`:42`). O `ModalBase` **não** tem guarda no clique do overlay (chama `onClose` direto, `ModalBase.tsx:65-67`) — a guarda precisa ser preservada no reescrito (ver Passo 1).
- O fluxo de 2 etapas (`etapa: 'tipo' | 'assistencia'`, `DialogoEvento.tsx:22,37,77,160`) e a confirmação com haptics (`vibrateGoal`, `:54-57`) são lógica de conteúdo, não de shell — migram intatos.
- O `<select>` de troca de jogador usa `optgroup` "Time Preto/Branco" (`DialogoEvento.tsx:102-120`, sobre o select de `:94-121`) — restrição conhecida: é débito do **A10** (plano 34), que exige `optgroup` no `SelectSumula` antes de qualquer migração. Neste plano o select permanece como está.
- Call site único confirmado por grep: `src/routes/PartidaAoVivo.tsx:396-412` (import em `:5`). As props públicas do `DialogoEvento` não mudam, então **nenhum call site é tocado**.
- `ConfirmDialog` tem **10 arquivos chamadores** (12 pontos de uso) e **fica como está**: unificá-lo exigiria props de exceção no shell canônico — piora o canônico para eliminar uma cópia.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** O `ModalBase` já existe e é o canônico; este plano não depende dos planos 01–06.
- **Restrição de janela (obrigatória)**: executar **FORA de partida ao vivo**. O `DialogoEvento` é a tela crítica de registro de gols do modo ao vivo (`PartidaAoVivo.tsx:396`); a migração muda a casca visual e o comportamento de fechamento desse diálogo, e a validação manual completa (seção 5) precisa acontecer antes do próximo racha, com tempo para rollback tranquilo.
- **Decisão do dono já tomada** (registrada no plano de origem, seção Fase 3): janela fora de ao-vivo; `ConfirmDialog` não participa. Nenhuma decisão pendente.
- **Sinergia (não bloqueia)**: o plano 02 (`Botao`) migraria de graça os botões internos do diálogo depois; aqui eles ficam intatos para confinar o diff ao shell (ver seção 6).

## 4. Plano de execução (1 passo = 1 commit)

**Abordagem: reescrita interna de `DialogoEvento` sobre `ModalBase`, mantendo a assinatura pública intacta.** O componente continua sendo o dono do fluxo de 2 etapas e da lógica de domínio (etapas, haptics, `onConfirmar`); apenas a casca (portal/overlay/focus trap/ARIA/cabeçalho) passa a ser delegada.

### Passo 1 — Reescrever o shell do `DialogoEvento` sobre `ModalBase` · 1 commit

- **`src/components/DialogoEvento.tsx`** — alterações:
  1. Remover do arquivo: `createPortal`, `useId`, o `useModalA11y` local e todo o JSX de casca (`DialogoEvento.tsx:59-76`, `:211-214`). O `MouseEvent` importado também sai.
  2. Adicionar `import { ModalBase } from './ModalBase'` (import relativo de irmão, padrão do diretório).
  3. Preservar a guarda de fechamento durante salvamento: `ModalBase` chama `onClose` direto no clique do overlay, então o componente cria `const fechar = () => { if (!salvando) onClose(); }` e passa `onClose={fechar}` + `disableEscape={salvando}` ao `ModalBase` — paridade exata com `DialogoEvento.tsx:42,61-63` de hoje.
  4. Renderizar `<ModalBase open={Boolean(jogador)} onClose={fechar} disableEscape={salvando} mostrarBotaoFechar={false} tamanhoMaximo="sm" posicao="bottom-sheet" className="p-5" titulo={...} subtitulo={...}>` com o conteúdo das duas etapas como `children`, intato.
  5. Cabeçalho por etapa via props dinâmicas: etapa `tipo` → `titulo={editando ? 'Editar evento' : \`Evento: ${nome}\`}`, `subtitulo` conforme `editando`; etapa `assistencia` → `titulo={\`Assistência no gol de ${nome}\`}`, `subtitulo="Quem deu o passe pro gol?"`.
  6. Manter `if (!jogador) return null` antes do retorno (o `ModalBase` também trata `open=false`, mas o `nome`/`jogador.jogador_id` no corpo dependem do guard explícito).
  7. `mostrarBotaoFechar={false}` preserva o padrão atual: o diálogo fecha pelo botão "Cancelar"/"← Voltar" de conteúdo, não por um "X" de shell.
- **Nenhum outro arquivo é tocado.** A assinatura de `DialogoEventoProps` (`:9-20`) não muda; `PartidaAoVivo.tsx:396-412` permanece byte-idêntico.
- Normalizações visuais aceitas (intencionais — é o ponto da migração): scrim `bg-black/70` → `bg-black/75`; animação `translate-y` → `scale`; título `h2` → `h3` do header canônico com barra `bg-superficie-2`; ganho de `max-h` com corpo rolável e `safe-area-inset-bottom` no bottom-sheet.
- Validar com `tsc -b` (zero erros; `grep -rn "createPortal\|useModalA11y" src/components/DialogoEvento.tsx` vazio).
- Commit: "migra DialogoEvento para o shell canônico ModalBase (A5)".

Total: 1 commit, 1 arquivo reescrito, ~25 linhas líquidas removidas, zero mudança de API.

## 5. Validação manual

Risco médio (tela crítica de gols ao vivo) → **validação manual completa obrigatória**, sem testes automáticos (AGENTS.md). Executar no aparelho, FORA de partida ao vivo real, exercitando o fluxo de 2 etapas inteiro:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Fluxo completo de gol**: tocar jogador → etapa "tipo" → "⚽ Gol" → etapa "assistência" → escolher companheiro → evento gravado; conferir haptics de gol no toque final.
- [ ] **Gol individual**: na etapa "assistência", escolher "Sem assistência (Gol Individual)" → grava sem assistência.
- [ ] **Gol contra**: na etapa "tipo", "Gol contra" confirma direto (sem passar pela etapa 2) e grava.
- [ ] **Cancelar/voltar**: "Cancelar" fecha na etapa 1; "← Voltar ao tipo de evento" retorna à etapa 1 sem gravar.
- [ ] **Edição**: abrir evento existente para editar → título "Editar evento"; trocar jogador pelo select com grupos **"Time Preto" e "Time Branco"** visíveis e corretos; estado atual (tipo/assistência) aparece destacado.
- [ ] **Salvamento**: durante `salvando`, clicar no overlay, pressionar Escape/voltar e tocar "Cancelar" **não fecham** o diálogo.
- [ ] **Fechamento por fora**: clique no overlay (fora do painel) e tecla Escape fecham o diálogo quando NÃO está salvando.
- [ ] **Geometria**: em mobile (largura estreita) o diálogo abre como bottom-sheet colado no rodapé; em `sm:` centraliza; conteúdo longo (muitos companheiros) rola dentro do corpo sem estourar a tela.
- [ ] **A11y**: diálogo anunciado como dialog; foco preso dentro; labels de etapa ("O que rolou na jogada?" / "Quem deu o passe pro gol?") visíveis.
- [ ] **Sem regressão no resto da partida**: registrar gol de cada tipo e conferir placar/sumula atualizando como antes (a lógica de `onConfirmar` não foi tocada).

## 6. Fora de escopo

- **Não** migrar o `ConfirmDialog` para `ModalBase` (10 arquivos chamadores; unificá-lo adicionaria props de exceção ao canônico — decisão do plano de origem).
- **Não** migrar o `<select>` interno para `SelectSumula` nem tocar o bloco de `optgroup` "Time Preto/Branco" (`DialogoEvento.tsx:102-120`) — é o débito **A10** (plano 34), que depende de `SelectSumula` ganhar suporte a `optgroup`.
- **Não** migrar os botões internos para o `Botao` do plano 02 — manteria o diff confinado ao shell e evita acoplar dois planos no mesmo arquivo; a migração dos botões acontece naturalmente quando o plano 02 passar por aqui.
- **Não** tocar o token de scrim (`bg-black/70` vs `bg-black/75` converge pelo canônico, mas a extração do token `--cor-scrim` é o item **C3**, plano próprio).
- **Não** alterar nenhuma prop pública de `DialogoEvento` nem o contrato com `PartidaAoVivo` (props, callbacks, semântica de `onClose`).
- **Não** mexer no `ModalBase` (nenhuma mudança no canônico — a API confirmada em `ModalBase.tsx:13-15` já suporta tudo que a migração precisa).
- **Não** alterar a lógica de etapas, `vibrateGoal` ou o payload de `onConfirmar`.

## 7. Riscos e rollback

- **Risco funcional: médio** — é o único item Tier 2 que toca a tela de gols ao vivo. Mitigação: janela fora de ao-vivo (seção 3), diff confinado a 1 arquivo, validação manual completa (seção 5) e nenhuma mudança de API no call site único.
- **Risco de comportamento de fechamento**: o `ModalBase` fecha por overlay sem guarda interna; se a adaptação do Passo 1 (item 3) for esquecida, o diálogo poderia fechar durante o salvamento. A verificação "salvando bloqueia fecho" do checklist cobre exatamente esse caso.
- **Risco visual**: pequenas divergências aceitas (scrim, animação, `h2`→`h3`, barra de header) — são normalizações intencionais para o canônico, não regressões; validar a geometria bottom-sheet/centro no checklist.
- **Rollback**: `git revert` do commit único restaura `DialogoEvento.tsx` integralmente (portal/`useModalA11y` próprios voltam a existir no arquivo) e **não há outros arquivos tocados** — reversão atômica e sem resíduos. Se a validação em aparelho falhar, reverter e reagendar para a próxima janela fora de ao-vivo.
- **Débito a registrar (não corrigir aqui)**: o `<select>` com `optgroup` permanece inline — já registrado no A10/plano 34; nada novo a registrar além do que lá consta.
