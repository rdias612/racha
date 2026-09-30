# 09 · Peças das listas financeiras — Registro de Execução e Validação

> Registro da execução do plano [09-pecas-listas-financeiras.md](../09-pecas-listas-financeiras.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (2 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção.

## 1. Execução

- **2 commits** (`242c1e2` → `92c494c`), 1 passo = 1 commit, `npm run build` e `npm run lint` verdes em ambos. Diff total: 4 arquivos (+61 / −47 linhas).
- **Passo 1** (`242c1e2`, `extrai ChipTipoLancamento com COR_TIPO privada (A6)`):
  - Criação de `src/components/ui/ChipTipoLancamento.tsx` (adotando convenção da pasta `ui/` já existente, conforme §3 do plano).
  - `COR_TIPO` declarada como constante privada no módulo (sem `export`); mapa dos 6 tipos de dívida encapsulado.
  - Eliminação do acoplamento invertido: remoção do `export const COR_TIPO` em `ListaReceitasAbertas.tsx` e do `import { COR_TIPO }` em `ListaDespesasAbertas.tsx`.
  - Migração dos spans para `<ChipTipoLancamento tipo={d.tipo} />` e remoção dos imports de domínio não mais utilizados diretamente pelas listas (`labelTipoDivida`, `TipoDivida`).
- **Passo 2** (`92c494c`, `extrai LinhaMetaLancamento encapsulando metadados de receita e despesa (A6)`):
  - Criação de `src/components/ui/LinhaMetaLancamento.tsx` encapsulando o container flex com Badge de natureza (`variante="ok"`/`"Receita"` vs `"perigo"`/`"Despesa"`), `ChipTipoLancamento`, referência condicional (`ref. ...`) e data formatada.
  - Migração de `ListaReceitasAbertas.tsx` e `ListaDespesasAbertas.tsx` para `<LinhaMetaLancamento natureza={d.natureza} tipo={d.tipo} referencia={d.referencia} data={d.data_divida} />`.
  - Limpeza de imports que se tornaram obsoletos em `ListaDespesasAbertas.tsx` (`Badge`, `formatarDataLista`, `ChipTipoLancamento`). Em `ListaReceitasAbertas.tsx`, `Badge` (usado no chip "mensalista") e `formatarDataLista` (usado em `montarLembreteWhatsApp`) foram corretamente preservados.

## 2. Confirmações técnicas da auditoria

- **Acoplamento invertido 100% eliminado**: `ListaDespesasAbertas.tsx` não importa mais nada de `ListaReceitasAbertas.tsx`. O único consumidor remanescente de `ListaReceitasAbertas` é a rota `Administrador.tsx`.
- **`COR_TIPO` privada**: mantida sem export dentro de `ChipTipoLancamento.tsx`, garantindo que estilos de apresentação não vazem para camadas de domínio nem entre componentes irmãos.
- **Fidelidade visual e geométrica**: classes Tailwind do chip (`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold`) e do container de metadados (`flex flex-wrap items-center gap-1.5`) preservadas byte a byte.
- **Fora de escopo intocado**: botões de quitação ("Pagar", "Quitar todas"), bloco de chave PIX, botão "Copiar PIX", lembrete WhatsApp, links de partida (`/partida/:id`) e descrições permaneceram intactos.
- `npm run build` e `npm run lint` passaram com sucesso e código de saída 0.

## 3. Divergências plano × código real

1. **Localização em `src/components/ui/`**: como o diretório `src/components/ui/` já existia no projeto (criado a partir dos planos 01, 02 e 04), os novos componentes nasceram lá conforme a regra condicional da Seção 3 do plano ("Se a pasta `ui/` já existir na hora da execução, nascer lá").
2. **Deslocamento de linhas pré-existentes**: ligeira variação nas linhas originais citadas no doc do plano (~2–4 linhas em cada arquivo) em razão dos commits anteriores que migraram botões para `Botao` (A2) e chip para `Badge` mini (A8).

## 4. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] **Receitas em aberto**: em Administrador → "Receitas em aberto", expandir o grupo de um jogador. Verificar se cada lançamento exibe:
  - Badge verde com rótulo "Receita";
  - Chip colorido do tipo (mensalidade âmbar, avulso verde, goleiro/campo/outro neutros);
  - "ref. [código]" apenas quando preenchido;
  - Data no formato de lista;
  - Badge mini "mensalista" no cabeçalho do grupo preservado.
- [ ] **Despesas em aberto**: em Administrador → "Despesas em aberto", verificar se cada lançamento exibe:
  - Badge vermelho com rótulo "Despesa";
  - Chip colorido com tipo correspondente;
  - Campo "ref." e data idênticos ao layout anterior;
  - Bloco de chave PIX e botão "Copiar PIX" funcionando normalmente.
- [ ] **Ações de quitação e WhatsApp**:
  - Clicar no botão de WhatsApp em uma receita com dívida e testar se copia a mensagem formatada para o clipboard;
  - Confirmar que as ações de pagamento individual e "Quitar todas" continuam abrindo as confirmações normalmente.
