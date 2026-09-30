# 03 · Helper de invalidação pós-mutação de partida — Registro de Execução e Validação

> Registro da execução do plano [03-helper-invalidacao-partida.md](../03-helper-invalidacao-partida.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (2 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes.

## 1. Execução

- **2 commits** (`a8638c0` → `ea62c3b`), 1 passo = 1 commit, `tsc -b && vite build` verde em ambos.
- Passo 1: `invalidarCachesDependentesDePartida(): void` criada em `src/lib/chavesCache.ts` (docstring do plano, ano calculado **na chamada**, preservando a semântica da virada do ano) + migração do piloto `Jogos.tsx`.
- Passo 2: os 6 call sites restantes migrados com substituição literal (PartidaDetalhe, PartidaAoVivo ×2, PartidaEditar, PartidaTimes, PartidaNova); import de `invalidarCache` removido nos 5 arquivos onde era símbolo único.
- Diff líquido: ~27 inserções / 26 deleções — comportamento byte-equivalente, como previsto.
- Critério de encerramento: `grep -rn "invalidarCache" src/routes/` vazio; `invalidarCache` em `src/` só existe na definição (`hooks/useCache.ts:39`), no import e nas 2 chamadas do helper.
- Fora de escopo respeitado: `useCache.ts` e `sw.js` intocados, chaves não renomeadas, nenhuma abstração genérica de grupos criada, nenhum fluxo de mutação ao redor alterado.
- Cadeia de imports sem ciclo (confirmado): `chavesCache → hooks/useCache → lib/erros` (e `lib/times.ts` entra só como `import type`).

## 2. Tabela dos 7 call sites (auditoria — ponto do fluxo antes → depois)

| # | Site | Linhas (plano → real na base) | Ponto do fluxo | Equivalente |
|---|---|---|---|---|
| 1 | `Jogos.tsx` | 86-87 → 87-88 | após `setIdsExcluidos`, antes do snackbar | ✓ |
| 2 | `PartidaDetalhe.tsx` | 151-152 → 152-153 | após guard de erro, antes do `navigate(ao-vivo)` | ✓ |
| 3 | `PartidaAoVivo.tsx` (início) | 136-137 → 137-138 | após guard de erro, antes de `recarregar()` | ✓ |
| 4 | `PartidaAoVivo.tsx` (publicação) | 223-224 → 224-225 | após `setConfirmandoFim(false)`, antes do push | ✓ |
| 5 | `PartidaEditar.tsx` | 204-205 (=) | após salvar, antes do push best-effort | ✓ |
| 6 | `PartidaTimes.tsx` | 210-211 (=) | após salvar times/goleiros, antes de `setFeedback` | ✓ |
| 7 | `PartidaNova.tsx` | 173-174 → 174-175 | após try/catch de Storage, antes do `navigate(times)` | ✓ |

Em todos: mesmo ponto, mesma ordem, nenhum fluxo ao redor (snackbar, push, navegação) tocado.

## 3. Imprecisões do doc do plano detectadas (corrigidas no próprio plano em 2026-09-30)

1. **Números de linha deslocados em 1** em 4 arquivos (Jogos, Detalhe, AoVivo ×2, Nova) — derivação de outra base; contexto idêntico em todos. PartidaEditar e PartidaTimes batiam. Plano atualizado com os números reais.
2. **Critério de validação impreciso**: "grep `CHAVE_JOGOS|chaveResumo` em src/routes/ vazio" era falso por construção — `Jogos.tsx:7,73` e `Resumo.tsx:20,59` continuam usando as chaves como **leitores** legítimos (`useCache` do mural e do boletim), o que é correto. Análogo para o grep de `invalidarCache` (o nome do helper contém o substring). Critério corrigido no plano.

## 4. Validações técnicas confirmadas pela auditoria

- Cada commit toca só os arquivos do plano; `iniciar_local.bat` (commitado à parte em `11e3b43`) e `0.30.0` não entraram em nenhum deles.
- `git diff -- src/hooks/useCache.ts` vazio: a semântica de `invalidarCache` não foi alterada.
- Formato das chaves intacto (`CHAVE_JOGOS = 'jogos'`, `resumo:${ano}`).
- `npm run build` passa.

## 5. Débito registrado (não corrigido, conforme plano)

`invalidarCache` mora em `hooks/useCache.ts` sendo função de módulo; se um dia `lib/` não puder depender de `hooks/`, movê-la para `lib/` é transposição mecânica — registrar no A10 (plano 34), sem executar aqui.

## 6. Pendente de validação humana (visual/fluxo, no aparelho — fora de janela de rachas ao vivo)

- [ ] Criar partida (PartidaNova): partida nova aparece no mural e no Resumo.
- [ ] Editar partida (PartidaEditar): salvar e conferir mural atualizado.
- [ ] Escalar times (PartidaTimes): salvar e conferir Detalhe ao reabrir.
- [ ] Iniciar partida pelos **dois** sites (PartidaDetalhe e PartidaAoVivo): mural exibe "ao vivo".
- [ ] Publicar/encerrar em PartidaAoVivo: mural e Resumo atualizam; súmula no Detalhe.
- [ ] Excluir partida pelo mural (Jogos): some do mural e do Resumo.
- [ ] Revalidação em background do useCache (tela em background atualiza ao voltar, sem pull-to-refresh).
