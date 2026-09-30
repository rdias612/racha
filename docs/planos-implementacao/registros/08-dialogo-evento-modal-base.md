# 08 · Migrar `DialogoEvento` para `ModalBase` — Registro de Execução e Validação

> Registro da execução do plano [08-dialogo-evento-modal-base.md](../08-dialogo-evento-modal-base.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (1 passo) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção. Executado fora de janela de racha ao vivo; a validação manual em aparelho é **obrigatória antes do próximo racha** (tela crítica de gols).

## 1. Execução

- **1 commit** (`d7b677c`): `migra DialogoEvento para o shell canônico ModalBase (A5)` — 1 arquivo (`DialogoEvento.tsx`, +135/−153, ~18 linhas líquidas removidas). Nenhum outro arquivo tocado.
- Shell próprio eliminado: `createPortal`, `useId`, `useModalA11y` local, `MouseEvent` importado e todo o JSX de casca (overlay/focus trap/ARIA/cabeçalho) removidos; `import { ModalBase } from './ModalBase'` entra.
- Renderização: `<ModalBase open={Boolean(jogador)} onClose={fechar} disableEscape={salvando} mostrarBotaoFechar={false} tamanhoMaximo="sm" posicao="bottom-sheet" className="p-5" titulo={...} subtitulo={...}>`.
- **Guarda de salvamento preservada**: `const fechar = () => { if (!salvando) onClose(); }` como `onClose` + `disableEscape={salvando}` — o `ModalBase` chama `onClose` direto no overlay, e a guarda vive no componente, paridade exata com o comportamento antigo.
- **API pública intacta**: `DialogoEventoProps` campo a campo idêntica; call site único `PartidaAoVivo.tsx:395-411` byte-idêntico (que tem, ele próprio, guarda `!salvando` no `onClose`); `ModalBase.tsx` zero mudanças.
- **Conteúdo byte-idêntico** (conferido trecho a trecho pela auditoria): as 2 etapas (68 + 40 linhas, diff mecânico de indentação apenas), select com `optgroup` "Time Preto/Branco", `vibrateGoal`, payload de `onConfirmar`, botões "Cancelar"/"← Voltar".
- Cabeçalho por etapa via props dinâmicas: `Evento: ${nome}` / `O que rolou na jogada?`; `Editar evento` / `Altere o jogador, o tipo ou a assistência.`; `Assistência no gol de ${nome}` / `Quem deu o passe pro gol?`.
- Critério de encerramento: `grep "createPortal|useModalA11y|useId|MouseEvent"` no arquivo → vazio; nenhum import morto.
- Fora de escopo confirmados intocados: `ConfirmDialog`, `ModalBase`, token de scrim, botões internos, lógica de etapas/haptics/payload.

## 2. Confirmações técnicas da auditoria

- **Guarda de salvamento sem brechas** (ponto de maior risco): overlay bloqueado por `fechar`; Escape bloqueado por `disableEscape` (e mesmo se escapasse, cairia em `fechar` — o hook atualiza refs a cada render); botão X não renderiza (`mostrarBotaoFechar={false}`); "Cancelar" é `disabled={salvando}` (inalcançável durante salvamento, byte-idêntico ao antigo). Nenhum outro caminho de fecho no `ModalBase`/`useModalA11y`.
- **`className="p-5"`** vai para o corpo do `ModalBase` (`:124`: `flex-1 overflow-y-auto ${className}`), reproduzindo o padding do painel antigo agora que o header vive na barra canônica — uso idiomático da API existente, sem conflito.
- Normalizações aceitas (intencionais): scrim `/70`→`/75`, animação `translate-y`→`scale`, `h2`→`h3` na barra `bg-superficie-2`, ganho de `max-h-[90vh]` com corpo rolável e `safe-area-inset-bottom`.
- `npm run build` e `npm run lint` verdes.

## 3. Observações da auditoria (normalizações aceitas; validar em aparelho)

1. **Subtítulos do header canônico têm `truncate`** (`ModalBase.tsx:103`): "Assistência no gol de [nome longo]" pode cortar em telas estreitas — o antigo quebrava linha. Cenário coberto pelo checklist abaixo.
2. Título `h2 text-lg` → `h3 text-sm` na barra do header: perda de destaque visual, normalização aceita pelo plano.
3. Os dois primeiros elementos de conteúdo carregam `mt-3`/`mt-4` herdados do espaço do `h2` antigo; agora o espaçamento vem do `p-5` do corpo — cosmético, sem impacto de lógica.

## 4. Débitos

Nenhum novo. O `<select>` com `optgroup` permanece inline — já registrado no A10/[plano 34](../34-debitos-registrados.md) (depende de `SelectSumula` ganhar `optgroup`). Os botões internos migram de graça quando o plano 02 passar pelo arquivo.

## 5. Pendente de validação humana (visual/fluxo, no aparelho — FORA de partida ao vivo, antes do próximo racha)

- [ ] **Fluxo completo de gol**: jogador → "⚽ Gol" → etapa assistência → companheiro → gravado; haptics no toque final.
- [ ] **Gol individual**: "Sem assistência (Gol Individual)" grava sem assistência.
- [ ] **Gol contra**: confirma direto na etapa 1.
- [ ] **Cancelar/voltar**: "Cancelar" fecha na etapa 1; "← Voltar" retorna sem gravar.
- [ ] **Edição**: título "Editar evento"; grupos "Time Preto"/"Time Branco" corretos; estado atual destacado.
- [ ] **Salvamento bloqueia fecho**: durante `salvando`, overlay, Escape/voltar e "Cancelar" NÃO fecham.
- [ ] **Fechamento por fora**: overlay e Escape fecham quando NÃO está salvando.
- [ ] **Geometria**: bottom-sheet no rodapé em mobile, centralizado em `sm:`; conteúdo longo rola no corpo.
- [ ] **Nome longo**: subtítulo "Assistência no gol de…" com nome comprido em tela estreita — conferir se o `truncate` é aceitável (observação 1).
- [ ] **A11y**: dialog anunciado, foco preso, labels de etapa visíveis.
- [ ] **Sem regressão na partida**: placar/súmula atualizam para cada tipo de evento.
- [ ] Se qualquer item falhar: `git revert d7b677c` (reversão atômica, sem resíduos) e reagendar para a próxima janela fora de ao-vivo.
