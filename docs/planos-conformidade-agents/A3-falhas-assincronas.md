# A3 - Tratar falhas assíncronas

**Origem:** item A3 do [relatório de conformidade](../relatorio-conformidade-agents.md).  
**Prioridade:** P1.  
**Objetivo:** definir o comportamento de cada falha assíncrona, preservar dados válidos durante indisponibilidade e impedir que erros críticos desapareçam sem diagnóstico.

## Estado atual confirmado

| Ocorrência                                                                       | Categoria definida | Implementação planejada                                                                                                         |
| -------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [Comparador.tsx](../../src/routes/Comparador.tsx), falha ao listar jogadores     | Tolerada           | Manter confronto/cache utilizável, registrar contexto técnico sanitizado e indicar no código por que os seletores ficam vazios. |
| [Estatisticas.tsx](../../src/routes/Estatisticas.tsx), falha ao listar jogadores | Tolerada           | Manter dados estatísticos/cache utilizáveis, sem confundir lista vazia com resposta válida.                                     |
| [PartidaAoVivo.tsx](../../src/routes/PartidaAoVivo.tsx), carregamento inicial    | Visível            | Manter `formatarMensagemErro`, `erro` recuperável e proteção de ciclo de vida.                                                  |
| `PartidaAoVivo`, polling de 10 s                                                 | Best-effort        | Impedir chamadas concorrentes, manter último estado válido, registrar falha técnica e tentar novamente.                         |
| `PartidaAoVivo`, disparo de push após publicação                                 | Best-effort        | Não bloquear publicação; registrar somente contexto não sensível.                                                               |
| [Perfil.tsx](../../src/routes/Perfil.tsx), carregamento de estatísticas          | Visível            | Não reduzir silenciosamente a tela a `stats = null`; exibir erro recuperável ou estado de retry.                                |
| [pwa.ts](../../src/lib/pwa.ts), leitura/gravação de `localStorage`               | Tolerada           | Usar fallback atual, com comentário de contrato; storage indisponível não bloqueia o app.                                       |
| `pwa.ts`, auto-cura de push                                                      | Best-effort        | Manter silenciosa para o usuário, registrar diagnóstico sanitizado e tentar na próxima sincronização.                           |

O achado original citava quatro arquivos; `Perfil.tsx` entra como ocorrência adjacente descoberta na análise porque seu `catch` também transforma falha de carregamento em estado vazio sem informar o usuário.

## Política técnica fechada

1. Falha visível usa `formatarMensagemErro`, estado de erro existente e ação de retry quando a tela já oferece esse fluxo.
2. Falha tolerada mantém os dados anteriores e usa `console.debug` com operação, código/mensagem sanitizada e timestamp; nunca registra senha, token, endpoint, payload ou chave VAPID.
3. Polling ao vivo usa duas proteções: `ref` de request em andamento para single-flight e geração/flag de ciclo de vida para impedir resposta obsoleta após desmontagem ou troca de partida.
4. O intervalo não cria uma nova chamada enquanto a anterior estiver em voo. A falha não limpa `partida`, `participantes` ou `eventos`.
5. Comentários identificam `TOLERADA`, `BEST-EFFORT` ou `VISÍVEL` somente nos pontos em que o comportamento silencioso é deliberado.

## Tasks de implementação

### A3.1 - Corrigir carregamentos de seletores

**Arquivos:** `Comparador.tsx` e `Estatisticas.tsx`.

1. Substituir o comentário genérico dos `catch` por justificativa explícita: a lista de seleção é auxiliar e os dados principais podem continuar em cache.
2. Registrar `console.debug` sanitizado com operação (`listarTodosJogadores` ou equivalente), mensagem e timestamp, sem lista de jogadores nem dados pessoais.
3. Manter `setJogadores([])`/estado equivalente somente quando a tela já depende desse fallback; não apagar dados estatísticos existentes.
4. Se a tela não diferenciar “sem resultado” de “lista indisponível”, adicionar uma flag local de indisponibilidade para evitar mensagem enganosa.

**Checkpoint:** offline com dados principais em cache continua exibindo os dados e deixa claro que apenas os seletores falharam.

### A3.2 - Fechar o carregamento visível de `PartidaAoVivo`

**Arquivo:** [PartidaAoVivo.tsx](../../src/routes/PartidaAoVivo.tsx).

1. Manter `formatarMensagemErro` no `catch` inicial.
2. Garantir que `recarregar` não faça `setPartida`, `setParticipantes` ou `setEventos` depois de a partida mudar ou o componente desmontar.
3. Usar a mesma geração/request token no carregamento inicial e no polling; a resposta aceita deve ser a mais recente e ainda ativa.
4. Não modificar a mensagem de erro de usuário sem necessidade funcional.

**Checkpoint:** uma resposta atrasada do carregamento anterior não sobrescreve a partida atual.

### A3.3 - Tornar o polling single-flight e diagnosticável

**Arquivo:** `PartidaAoVivo.tsx`.

1. Criar `recarregandoRef` ou equivalente para ignorar o tick de 10 s quando houver request em andamento.
2. Fazer o `setInterval` chamar uma função de polling que captura o erro best-effort sem limpar estado válido.
3. Registrar com `console.debug` apenas `partida_id`, operação, mensagem sanitizada e timestamp; não registrar resposta RPC ou dados de jogadores.
4. Manter o polling somente quando `partida.status === 'live'` e limpar o intervalo no cleanup.

**Checkpoint:** respostas atrasadas e erros alternados não geram requests concorrentes nem regressão do placar.

### A3.4 - Documentar push best-effort pós-publicação

**Arquivo:** `PartidaAoVivo.tsx` no disparo de `dispararPushVotacaoAberta`.

1. Trocar `catch(() => {})` por callback nomeado com comentário `BEST-EFFORT`.
2. Registrar falha técnica sanitizada sem bloquear a publicação e sem duplicar tentativa no mesmo evento.
3. Confirmar que o erro não chega ao snackbar de operação principal.

### A3.5 - Expor falha de estatísticas do perfil

**Arquivo:** [Perfil.tsx](../../src/routes/Perfil.tsx).

1. Adicionar estado `erroStats` separado de `stats = null`.
2. No `catch`, preservar estatísticas anteriores quando existirem; na primeira carga, exibir mensagem de erro recuperável em vez de estado vazio indistinguível.
3. Reutilizar `formatarMensagemErro` e o componente de estado já usado pelo perfil.
4. Manter `ativo` no cleanup para não atualizar estado após desmontagem.

### A3.6 - Formalizar tolerância do PWA

**Arquivo:** [pwa.ts](../../src/lib/pwa.ts).

1. Documentar `lerFlagDesativado` e `gravarFlagDesativado` como tolerantes a modo privado/quota/storage indisponível.
2. Documentar `garantirInscricaoPush` como auto-cura que nunca bloqueia login ou renderização.
3. No `catch` de auto-cura, registrar apenas operação e erro sanitizado, se o padrão de logging do projeto permitir; caso contrário, manter silêncio com comentário explícito e registrar a limitação no diff.
4. Não alterar permissões, endpoint, subscription ou chave VAPID.

### A3.7 - Validação integrada

1. Revisar cada ocorrência com `rg "catch|\.catch" src/routes/Comparador.tsx src/routes/Estatisticas.tsx src/routes/PartidaAoVivo.tsx src/routes/Perfil.tsx src/lib/pwa.ts`.
2. Confirmar que cada ocorrência aparece na matriz deste plano ou tem justificativa equivalente.
3. Executar `npm run lint` e `npm run build`.
4. Simular offline nas listas do comparador/estatísticas e confirmar que cache e mensagens não se contradizem.
5. Simular erro inicial, resposta atrasada e erro de polling em partida ao vivo.
6. Confirmar falha de push e de storage sem bloquear login, publicação ou carregamento do app.

## Critérios de aceite

- Todo `catch` do escopo tem categoria e comportamento definidos.
- Falhas críticas são visíveis e recuperáveis; falhas best-effort não destroem o último estado válido.
- Polling não sobrepõe requests e respostas obsoletas não vencem respostas atuais.
- Logs, quando usados, não contêm tokens, senhas, endpoints completos, chaves VAPID ou payloads.
- `npm run lint` e `npm run build` passam.

## Riscos e limites

- Não transformar polling em alerta visual repetitivo.
- Não adicionar um logger genérico para um único uso sem necessidade real.
- Não tratar ausência legítima de dados como falha de rede.
