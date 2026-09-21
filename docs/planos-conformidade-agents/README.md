# Planos de conformidade com `AGENTS.md`

Planos executáveis dos itens A1 a A5 identificados no [relatório de conformidade](../relatorio-conformidade-agents.md). A análise dos arquivos, símbolos, contratos e dependências já está registrada em cada plano; a execução não deve começar por uma nova fase genérica de mapeamento.

## Planos

1. [A1 - Encapsular acesso Supabase nas telas](./A1-encapsular-acesso-supabase.md)
2. [A2 - Reduzir responsabilidades de componentes de rota](./A2-componentes-de-rota.md)
3. [A3 - Tratar falhas assíncronas](./A3-falhas-assincronas.md)
4. [A4 - Fortalecer tipagem nas fronteiras Supabase](./A4-tipagem-supabase.md)
5. [A5 - Unificar regra de username](./A5-regra-username.md)

## Dependências e ordem de execução

| Ordem | Plano | Dependência e motivo                                                                                              |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | A1    | Primeiro define as funções de integração que serão consumidas pelas telas e altera `partidas.ts`.                 |
| 2     | A4    | Depois tipa as novas e antigas fronteiras de `partidas.ts` sem trabalhar sobre contratos intermediários.          |
| 3     | A2    | Extrai a apresentação de `Comparador` e `GestaoGoleiros`; deve ser isolado de mudanças simultâneas na mesma rota. |
| 4     | A3    | Fecha o comportamento assíncrono de `Comparador` depois das extrações e de `PartidaAoVivo`/PWA.                   |
| 5     | A5    | Pode ser executado separadamente, mas exige pré-validação do banco antes da migration de unicidade.               |

Não executar A2 e A3 em paralelo: ambos alteram `Comparador.tsx`. A1 e A4 também devem ser sequenciais porque ambos mexem em `src/lib/partidas.ts`.

## Critério comum de conclusão

- Todas as tasks do plano estão marcadas como concluídas no próprio plano durante a execução.
- `npm run lint` e `npm run build` passam após cada checkpoint indicado.
- O fluxo funcional afetado foi validado com sucesso e erros, dados vazios e respostas atrasadas quando aplicável.
- O diff não altera regra de negócio fora do escopo nem introduz abstrações genéricas sem consumidor real.

## Convenções

- Cada plano preserva a arquitetura atual e nomeia os arquivos e contratos que devem ser alterados.
- Migrations do Supabase devem ser novas e incrementais; migrations aplicadas não devem ser editadas.
- O `AGENTS.md` orienta que não sejam criados testes automaticamente neste momento. Os planos registram validações manuais e casos que devem virar testes quando a estratégia de testes for aprovada.
