# 23 · Tokens de contraste `--cor-ok-texto`/`--cor-perigo-texto` — Registro de Execução e Validação

> Registro da execução do plano 23 em **04/10/2026**, na branch `main`. Veredito da auditoria: **aprovado com ressalvas** — 2 Minor; um corrigido na fonte do plano (linha deslocada), outro registrado como débito (Passo 9 do plano 34). Ciclo executor → auditor fechado sem corretor de código.

## 1. Contexto

Item C2 (acessibilidade): par adaptativo para os textos verdes/vermelhos, replicando o mecanismo do âmbar (`--cor-destaque-texto`), com migração dos 16 usos como texto pequeno (6 arquivos). No escuro, zero mudança visual (tokens recebem os valores atuais); no claro, textos passam a verde/vermelho mais profundos, fundos continuam vibrantes. BASE: `940141e`. Os hexes do claro (`#2e7d32`/`#b3401e`) foram aprovados pelo pedido de execução do dono; a validação visual lado a lado segue pendente.

**Cuidado executado**: `src/index.css` tinha modificação NÃO-commitada do dono (tokens de superfície/borda do `.dark`). Procedimento: diff do dono salvo em `.superpowers/owner-index-css.patch` → arquivo restaurado ao HEAD → tokens do plano commitados → patch re-aplicado (limpo, sem conflito). Confirmado pelo auditor: os commits contêm só as 6 linhas do plano; a mudança do dono segue intacta no working tree.

## 2. Execução (1 passo = 1 commit)

- **Passo 1 — tokens** · commit `8c20eed` · `Adicionar tokens adaptativos de contraste ok-texto e perigo-texto`
  - `src/index.css` (só ele, 6 inserções): mapeamentos `--color-ok-texto`/`--color-perigo-texto` no `@theme` (`:27,29`, replicando o padrão âmbar `:21-22`); `:root` com `#b3401e` (`:51`) e `#2e7d32` (`:53`) + comentários de contraste do plano; `.dark` com `#e4572e`/`#58b368` (`:74,76`). Hexes de `--cor-ok`/`--cor-perigo` inalterados; sem tokens `-tinta`/`-borda`.
  - Build verde; utilities `.text-ok-texto`/`.text-perigo-texto` confirmadas por grep no CSS de `dist/`.
- **Passo 2 — migração dos 16 pontos** · commit `7221dd9` · `Migrar textos pequenos para os tokens ok-texto e perigo-texto`
  - Ordem do plano respeitada: `Badge.tsx` (variantes `ok`/`perigo`) e `Estado.tsx` (variantes `erro`/`sucesso`) primeiro, depois os pontos diretos — `LinhaJogadorGestao.tsx:117`, `ConfirmacoesPartida.tsx:77,105,129,140,384` (hovers → `hover:text-perigo-texto`), `ListaReceitasAbertas.tsx:58,110,160`, `ListaDespesasAbertas.tsx:30,95,104`. 16 linhas alteradas, contagem exata da tabela.
  - Classes compostas intactas (`border-ok/40`, `bg-ok/10`, `bg-perigo/20`, `hover:bg-ok/20`…); checkbox de `LinhaJogadorGestao.tsx:126` intocado; nenhuma `bg-ok-texto`/`bg-perigo-texto` usada.
  - Build e lint com exit 0.

## 3. Auditoria

Auditor read-only com review package em `.superpowers/sdd/23-tokens-contraste/etapa-1-review-package.md`. **Veredito: aprovado com ressalvas** (2 Minor, nenhum Critical/Important).

- Passo 1 e Passo 2 conferidos ponto a ponto contra a tabela e o §6: todos os 16 pontos migrados; re-grep confirma que TODOS os usos restantes de `text-ok`/`text-perigo` correspondem à lista de fora de escopo (incluindo os "pequenos deliberadamente fora" — nenhum tocado).
- Mudança do dono em `index.css` preservada (no working tree, fora dos commits).
- Conformidade AGENTS.md: mecânica, sem extras.

## 4. Divergências plano × código real / decisões

1. **Minor — linha deslocada no plano**: `Estado.tsx` citado como 63/64, real 64/65 (demais 5 arquivos exatos). Corrigido na fonte no commit do registro.
2. **Minor — utility morta `.bg-ok-texto` no bundle**: o Tailwind v4 varre o projeto fora do `.gitignore`, incluindo `docs/`; a menção literal de `bg-ok-texto` no próprio plano (`23-tokens-contraste.md:78`) fez gerar a utility sem consumidor (~60 bytes). **Decisão**: nenhum uso errado existe (grep em `src/` = 0), então o critério do passo 2 é atendido em espírito; a correção estrutural (restringir a varredura a `src/`, ex. `@source not docs`) tem implicação de build global e fica registrada como **Passo 9** do `34-debitos-registrados.md`, com gatilho "ao mexer na configuração de build". Fora do escopo deste plano.
3. Drift de linhas nos itens do §6 (fora de escopo) — mesmos pontos, refs deslocadas; nenhuma divergência de conteúdo. Não corrigido (lista de exclusão, sem risco de ambiguidade: os arquivos/valores identificam os pontos).

## 5. Observações operacionais

- Nenhum push nesta etapa: os commits dos planos 16-23 seguem locais, aguardando o dono.
- Arquivo temporário `.superpowers/owner-index-css.patch` pode ser apagado quando o dono commitar sua mudança de `src/index.css`.

## 6. Pendente de validação humana (dono)

- [ ] **Tema escuro (default)**: comparar as telas tocadas antes/depois — nenhuma diferença perceptível.
- [ ] **Tema claro**: percorrer os 6 arquivos (toggle do `LinhaJogadorGestao`, Badges verdes/vermelhos, `MensagemEstado` sucesso/erro, listas financeiras, `ConfirmacoesPartida`) — texto verde/vermelho mais profundo e legível; fundos ainda vibrantes.
- [ ] Validação lado a lado dos hexes do claro (`#2e7d32`/`#b3401e` sobre `#faf7ee`/`#f3efe4`): verde não "esverdeia demais" para oliva; vermelho não puxa para marrom. Se rejeitado, ajustar hex no `:root` (consumidores não precisam retocar).
- [ ] Nenhum texto verde/vermelho sobre fundo sólido (`bg-perigo`) usando o token novo.
- [ ] Smoke test de navegação nas telas tocadas.
