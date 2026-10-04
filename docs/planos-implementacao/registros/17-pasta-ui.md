# 17 · Pasta `ui/` para novas primitivas — Registro de Execução e Validação

> Registro da execução do plano 17 em **04/10/2026**, na branch `main`. Veredito da auditoria: **aprovado com ressalvas** — ressalva = desvio de acoplamento confirmado em 2 componentes de `ui/`, tratado como débito (Passo 8 do plano 34), exatamente como a seção 4 do plano prescreve. Ciclo executor → auditor fechado sem corretor de código.

## 1. Contexto

Plano de convenção/adoção, não de código: o que restava era registrar a regra em documentação e validar a conformidade do que já existe em `ui/`. O pedido do dono fechou as duas decisões da seção 3 (aprovação da regra e dos destinos do registro). BASE: `0ad685a`. Nota: o plano estava 1 dia defasado — dizia 6 componentes e listava o plano 15 como pendente; hoje a `ui/` tem 7 (o `PilulaFiltro` nasceu lá pelo plano 15 nesta mesma data). Os números foram tratados como realidade e o doc do plano corrigido na fonte no commit do registro.

## 2. Execução

- **Passo 1 — registro documental** · commit `5de5b13` · `Registrar convencao da pasta ui de primitivas na documentacao`
  - `DESIGN.md` §3: entrada `ui/` na árvore de diretórios + blockquote canônico dentro da seção — primitivas reutilizáveis e sem domínio nascem em `src/components/ui/`; raiz congelada para novos arquivos; migração existente só por toque funcional, um arquivo por commit; regra de bolso completa; origem da adoção = planos 01, 02, 04, 09 e 15.
  - `docs/planos-implementacao/README.md`: regra permanente registrada como blockquote no cabeçalho (2-3 linhas, condensada), apontando o plano 17 como origem.
  - Diff: 5 inserções, 1 remoção — só os 2 arquivos de documentação; nenhum arquivo de `src/`.
  - Build (`✓ built in ~450ms`) e lint com exit 0.
- **Passo 2 — validação de conformidade** (sem commit, conforme o plano):
  - Os 5 componentes `Botao`, `CabecalhoSumula`, `CampoTexto`, `CampoTextoLongo` e `PilulaFiltro`: **conformes** (imports apenas de tipos do React; sem rotas, sem domínio).
  - `ChipTipoLancamento` e `LinhaMetaLancamento`: **desvio parcial confirmado** — importam de `lib/dividas` (`TipoDivida`, `NaturezaLancamento`, `labelTipoDivida`), acoplamento a domínio financeiro que viola a regra de bolso. Nada foi movido, como o plano manda; desvio registrado como débito (seção 3).
  - Grep de imports: zero paths aspirados ou componentes fantasma — os 7 componentes têm consumidores reais (na raiz de `src/components/`, os imports são relativos `./ui/…`; o critério original do plano só cobria `components/ui`, corrigido na fonte).
  - Nada foi movido: raiz de `src/components/` segue com 68 arquivos, `ui/` com 7.

## 3. Divergências plano × código real / decisões

1. **Desvio de acoplamento (achado Important da auditoria, confirmado)**: `ChipTipoLancamento.tsx:1` e `LinhaMetaLancamento.tsx:4` importam de `lib/dividas`. **Decisão**: registrar como **Passo 8** do `34-debitos-registrados.md` ("Componentes de `ui/` acoplados a domínio financeiro", gatilho "ao tocar os arquivos") — caminho que a própria seção 4 do plano 17 prescreve ("registrar o desvio como débito… e tratá-lo na migração por toque"). Movê-los ou desacoplá-los agora seria fora do escopo. A colocação em `ui/` foi decisão deliberada do plano 09, então não é erro de local a corrigir no toque.
2. **Doc do plano defasado (1 dia)**: 6 → 7 componentes; plano 15 removido da lista de adoção pendente (satisfeito); critério de grep da seção 5 ampliado para `grep -rn "from '.*ui/"` — corrigido na fonte no commit do registro.
3. Sem outras divergências: §3 do `DESIGN.md` existia com o nome exato; nenhum passo histórico foi re-executado.

## 4. Observações operacionais

- A modificação pendente do dono em `src/index.css` (fora de escopo, tema escuro) foi preservada intacta — não commitada nem revertida.
- `main` ficou 2 commits à frente de `origin/main` (`0ad685a` registro do 16 + `5de5b13` deste plano) — desta vez **sem push indevido**; o push é do dono.

## 5. Pendente de validação humana (dono)

- [ ] Revisar o diff do commit `5de5b13` (regra registrada em `DESIGN.md` §3 e no README dos planos) antes do push.
- [ ] Validar visualmente que nada mudou em runtime (nenhum arquivo de `src/` tocado).
- [ ] Decidir, quando o gatilho do débito do Passo 8 do plano 34 disparar, entre desacoplar ou realocar os 2 componentes financeiros.
