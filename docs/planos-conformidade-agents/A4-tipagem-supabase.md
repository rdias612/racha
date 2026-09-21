# A4 - Fortalecer tipagem nas fronteiras Supabase

**Origem:** item A4 do [relatório de conformidade](../relatorio-conformidade-agents.md).  
**Prioridade:** P1.  
**Objetivo:** tornar explícita a conversão entre respostas Supabase e modelos de domínio, removendo somente casts estruturais que escondem incompatibilidades reais.

## Fonte de verdade e escopo confirmado

O tipo gerado está em [database.types.ts](../../src/lib/database.types.ts), dentro de `Database.public.Tables`, `Views` e `Functions`. Os arquivos de fronteira são [partidas.ts](../../src/lib/partidas.ts) e [jogadores.ts](../../src/lib/jogadores.ts).

| Função/trecho                                    | Situação                                           | Decisão de implementação                                                                               |
| ------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `carregarPartida`                                | `data as Partida \| null`                          | Comparar Row gerado com o domínio; usar mapper se status/nulabilidade diferirem, sem trocar por `any`. |
| `carregarPlacar`                                 | `data as Placar \| null`                           | Comparar tipo da view `partida_placar` e mapear campos opcionais explicitamente.                       |
| `carregarParticipantes`                          | `(data ?? []) as unknown as ParticipanteJoinRow[]` | Remover cast duplo; criar tipo bruto do join e `mapearParticipante`.                                   |
| `carregarNotas`                                  | `data as NotaPartida[]`                            | Confirmar View Row gerado; manter cast apenas se a equivalência estiver demonstrada, senão mapear.     |
| `carregarPartidaDraft`                           | `data as PartidaDraftAtual \| null`                | Verificar se o tipo local representa view/RPC; documentar conversões ou criar mapper.                  |
| Contagem de partidas em `jogadores.ts`           | cast para `{ jogador_id: number }[]`               | Usar tipo local nomeado ou tipo gerado da tabela e validar nulabilidade.                               |
| `confronto_direto` e `confronto_direto_partidas` | Rows locais com `number \| string`                 | Manter tipos de RPC, mas converter numeric/string em mapper único antes do domínio.                    |

## Decisões fechadas

1. `database.types.ts` é a fonte do schema; não será editado manualmente para silenciar erros.
2. Tipos crus de joins/RPCs podem ser locais quando o cliente não infere a forma, mas devem ser usados por uma função de mapeamento nomeada.
3. Casts de unions de domínio, como `PosicaoId`, só permanecem se houver narrowing/validação imediatamente anterior e isso estiver registrado na tabela de revisão.
4. Não haverá `as unknown as` no caminho de `carregarParticipantes`.
5. Conversões PostgreSQL `numeric`/`bigint` para `number` serão explícitas e centralizadas no mapper da operação.

## Tasks de implementação

### A4.1 - Congelar o inventário de tipos

1. Abrir os Row/Views/Functions correspondentes em `database.types.ts` para cada operação da tabela acima.
2. Registrar para cada campo: tipo bruto, nulabilidade, tipo de domínio e conversão necessária.
3. Confirmar como os tipos são regenerados no projeto antes de qualquer alteração; se não houver script, registrar o comando usado no ambiente Supabase sem incluir credenciais.
4. Não iniciar a refatoração enquanto uma diferença de schema não estiver classificada como real ou apenas limitação do inferidor.

**Entrega:** a tabela acima fica preenchida com referências aos tipos gerados e a decisão `mapper`, `inferência` ou `cast seguro` para cada ocorrência.

### A4.2 - Corrigir `carregarParticipantes`

**Arquivo:** `src/lib/partidas.ts`.

1. Criar `ParticipanteRowBruta` contendo os campos selecionados e `jogadores: { username: string | null } | null`.
2. Criar `mapearParticipante(row: ParticipanteRowBruta): Participante`.
3. Validar/narrowear campos que o tipo gerado marca como opcionais antes de construir o domínio.
4. Substituir `(data ?? []) as unknown as ParticipanteJoinRow[]` por entrada no mapper.
5. Preservar `username` como `undefined` quando o join não retornar jogador.

**Checkpoint:** partidas com join completo, join sem jogador e lista vazia carregam sem exceção e sem cast duplo.

### A4.3 - Corrigir tabelas, views e notas

**Arquivo:** `src/lib/partidas.ts`.

1. Para `carregarPartida`, mapear `id`, data, status, datas de fechamento e criador a partir do Row real.
2. Para `carregarPlacar`, mapear `partida_id`, gols e vencedor, tratando `null` conforme o domínio.
3. Para `carregarNotas`, usar View Row gerado ou mapper explícito; não aceitar um array arbitrário apenas porque o cast compila.
4. Para `carregarPartidaDraft`, manter o tipo de domínio separado se o retorno da view/RPC possuir campos opcionais diferentes.

**Checkpoint:** defaults atuais, `null`, status e campos de placar continuam iguais para a UI.

### A4.4 - Corrigir RPCs e consultas de `jogadores.ts`

1. Criar tipo nomeado para a consulta de contagem de participações e converter `jogador_id` somente depois do narrowing.
2. Manter `LinhaConfrontoRow` e `PartidaConfrontoRow` como tipos crus de RPC, mas criar mappers que convertam todos os `number | string` com `Number()` e tratem `null`.
3. Validar unions (`lado`, `bloco`, posição/status) antes de atribuí-los ao domínio; valor fora do conjunto deve lançar erro de contrato, não ser forçado por cast.
4. Revisar outros casts próximos que alimentam `StatsJogador`, parcerias ou eventos e classificar cada um na tabela de inventário.

### A4.5 - Revisão dos casts mantidos

1. Gerar lista com `rg " as [A-Za-z]" src/lib/partidas.ts src/lib/jogadores.ts`.
2. Para cada cast mantido, documentar no plano/PR: origem do tipo, por que o cliente não infere e qual verificação o torna seguro.
3. Remover casts que só existem para vencer o compilador; substituir por tipo gerado, mapper ou narrowing.
4. Não adicionar `any`, `unknown` sem narrowing ou validação executada em todo render.

### A4.6 - Validação integrada

1. Confirmar que não existe `as unknown as` no caminho de participantes.
2. Executar `npm run lint` e `npm run build`.
3. Validar partidas, placar, notas, ranking, estatísticas e comparador com dados completos, `null`, numeric/string e joins incompletos.
4. Comparar payloads antes/depois para garantir que nenhum campo foi renomeado ou omitido.

## Critérios de aceite

- Cada cast do inventário tem decisão explícita e justificativa.
- `carregarParticipantes` usa mapper tipado sem cast duplo.
- Rows de views/RPCs chegam ao domínio por inferência ou mapper verificável.
- Campos opcionais e numeric/string são tratados explicitamente.
- Não há `any` usado para mascarar incompatibilidade.
- `npm run lint` e `npm run build` passam sem alterar o comportamento das telas.

## Riscos e limites

- Não regenerar tipos sem confirmar a fonte de verdade do banco.
- Não editar migrations para corrigir apenas um tipo de frontend.
- Não remover casts legítimos de unions sem substituir por narrowing equivalente.
