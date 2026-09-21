# A5 - Unificar a regra de username

**Origem:** item A5 do [relatório de conformidade](../relatorio-conformidade-agents.md).  
**Prioridade:** P1.  
**Objetivo:** fazer frontend, RPCs e banco aceitarem exatamente os mesmos usernames, com unicidade case-insensitive e sem depender de validação da UI.

## Estado atual confirmado

| Camada                  | Evidência                                                                         | Problema de implementação                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Validação compartilhada | [jogadores.ts](../../src/lib/jogadores.ts), `validarFormatoUsername`              | Mensagem diz aceitar números, mas a regex atual não contém `0-9`; `isRandomUsername` deve continuar bloqueando `random%`.          |
| Criação de jogador      | [NovoJogador.tsx](../../src/routes/NovoJogador.tsx) e RPC de `011`                | Formulário só exige valor não vazio e a RPC `criar_jogador` insere diretamente; não aplica tamanho, formato ou prefixo.            |
| Alteração               | RPC efetiva de [096](../../supabase/migrations/096_username_apenas_unicidade.sql) | `096` substitui a lógica de `075`; valida formato/prefixo e unicidade por consulta, mas não há índice único por `lower(username)`. |
| Armazenamento           | [001_create_jogadores.sql](../../supabase/migrations/001_create_jogadores.sql)    | Constraint `UNIQUE` é case-sensitive e não impede corrida entre duas alterações/criações.                                          |
| Perfil                  | [Perfil.tsx](../../src/routes/Perfil.tsx)                                         | Já chama `validarFormatoUsername`, mas preserva a caixa enquanto `NovoJogador` força lowercase.                                    |

## Regra canônica decidida

- Normalizar apenas `trim`; preservar maiúsculas/minúsculas armazenadas.
- Aceitar de 2 a 30 caracteres.
- Aceitar `^[a-zA-ZÀ-ÖØ-öø-ÿ0-9_]+$`.
- Rejeitar qualquer username cujo prefixo, em comparação case-insensitive, seja `random`.
- Garantir unicidade por `lower(username)` no banco, inclusive sob concorrência.
- Identificar superadmins por ID; não reservar nomes de superadmin.
- `fazer_login` continua tolerante a caixa por sua comparação case-insensitive existente.

## Tasks de implementação

### A5.1 - Criar a pré-validação de dados existentes

Antes de criar índice ou alterar RPC, executar no banco remoto:

```sql
SELECT lower(trim(username)) AS chave, count(*) AS quantidade,
	   array_agg(id ORDER BY id) AS ids
FROM public.jogadores
GROUP BY lower(trim(username))
HAVING count(*) > 1 OR count(*) FILTER (WHERE username <> trim(username)) > 0;
```

1. Registrar duplicidades case-insensitive, espaços e valores fora do formato.
2. Definir correção manual/aprovada para cada registro conflitante; não escolher automaticamente qual jogador manter.
3. Bloquear a criação do índice até a consulta retornar zero conflitos.
4. Verificar o estado real de `096_username_apenas_unicidade.sql` com `supabase migration list --linked` ou procedimento equivalente autorizado.

**Saída:** lista de pré-condições aprovada e evidência de que o banco remoto está no histórico esperado.

### A5.2 - Corrigir a validação compartilhada do frontend

**Arquivo:** `src/lib/jogadores.ts`.

1. Alterar a regex para incluir `0-9`.
2. Manter limites, trim, mensagem de caracteres e bloqueio de `isRandomUsername`.
3. Não colocar validação de unicidade no frontend; essa regra permanece no RPC/índice.
4. Criar uma função de caso de teste local ou tabela de validação somente se a infraestrutura de testes existente for aprovada; não adicionar framework nesta tarefa.

### A5.3 - Alinhar o formulário de criação

**Arquivos:** `src/routes/NovoJogador.tsx` e função `criarJogador` em `src/lib/jogadores.ts`.

1. Remover a conversão automática para lowercase em `NovoJogador`; usar trim e preservar caixa.
2. Chamar `validarFormatoUsername` antes da RPC e mostrar a mesma mensagem de erro usada no Perfil.
3. Manter a mensagem de senha padrão apenas como comportamento legado documentado; não ampliar este plano para corrigir autenticação.
4. Fazer a função de lib rejeitar entrada claramente inválida antes da rede, sem substituir a validação server-side.
5. Manter tratamento de `23505` para colisões.

### A5.4 - Criar migration incremental de unicidade e criação

**Novo arquivo:** próxima migration livre em `supabase/migrations/`.

1. Após a pré-validação, criar índice único em `lower(trim(username))` ou em `lower(username)` conforme a normalização definitiva adotada; a escolha deve coincidir com o valor salvo pelas RPCs.
2. Atualizar `criar_jogador` com trim, limites, regex, prefixo reservado e mensagem consistente antes do `INSERT`.
3. Preservar a proteção de administrador existente fora deste item e não confiar no caller para autenticação.
4. Atualizar `alterar_username` para manter a mesma regra e deixar o índice impedir corrida de unicidade.
5. Usar `CREATE OR REPLACE FUNCTION` na nova migration; não editar `075` ou `096`.
6. Decidir explicitamente se a constraint antiga case-sensitive permanece como redundância ou é removida depois de validar o novo índice.

### A5.5 - Alinhar erros e alteração no Perfil

1. Confirmar que `Perfil.tsx` envia o valor sem lowercase e que `atualizarUsernameJogador` não o transforma novamente.
2. Mapear erros de formato, prefixo reservado, duplicidade (`23505`/exceção da RPC) e username igual ao atual para mensagens compreensíveis.
3. Permitir alteração apenas de caixa quando essa é a regra canônica, sem alterar `SUPERADMIN_IDS`.
4. Confirmar que login case-insensitive continua encontrando o username armazenado.

### A5.6 - Validar rollout remoto e comportamento

1. Aplicar a nova migration somente depois da pré-validação e revisar o SQL gerado.
2. Confirmar que o índice existe e que `criar_jogador`/`alterar_username` estão na assinatura esperada.
3. Executar a matriz abaixo no frontend e no banco/RPC:

| Caso                              | Resultado esperado                |
| --------------------------------- | --------------------------------- |
| `john`                            | Aceito                            |
| `john123`                         | Aceito                            |
| `joão`                            | Aceito                            |
| `john_doe`                        | Aceito                            |
| `j` ou 31 caracteres              | Rejeitado                         |
| `random`, `random1`, `RANDOM_x`   | Rejeitado                         |
| espaço, hífen ou ponto            | Rejeitado                         |
| `john` versus `JOHN`              | Segunda operação rejeitada        |
| alteração `john` → `John`         | Aceita se não houver outro `john` |
| superadmin por ID alterando caixa | Mantém privilégio                 |

4. Executar `npm run lint` e `npm run build`.
5. Registrar a confirmação de migration remota e os resultados da matriz; sem essa evidência o plano permanece bloqueado.

## Critérios de aceite

- Criação e alteração usam a mesma regra canônica no frontend e no banco.
- Números são aceitos; `random%`, caracteres inválidos, limites e duplicidade case-insensitive são rejeitados.
- Unicidade é garantida por índice/constraint no banco, não apenas por `SELECT` dentro da RPC.
- `NovoJogador` e `Perfil` têm normalização consistente e mensagens equivalentes.
- Superadmins continuam identificados por ID.
- Migration nova aplicada e verificada remotamente.
- `npm run lint` e `npm run build` passam.

## Riscos e limites

- Não editar migrations históricas.
- Não corrigir duplicidades existentes automaticamente.
- Não confundir este plano de validação com a correção P0 de autenticação e autorização.
- Não remover a constraint antiga antes de provar que o índice case-insensitive cobre todos os registros.
