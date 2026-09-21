# Relatório de conformidade com `AGENTS.md`

**Data da análise:** 21/09/2026

**Estado analisado:** commit `e1422fe` (`refactor: remove numbering from notification section titles for consistency`)

**Escopo:** revisão estática do código, migrations, configuração, documentação e scripts do projeto.

## Resumo executivo

O projeto está parcialmente alinhado com `AGENTS.md`. A base usa TypeScript estrito, separa parte das integrações Supabase em `src/lib` e mantém uma arquitetura relativamente simples. Porém, há desalinhamentos relevantes:

- **Críticos:** permissões públicas excessivas no banco, armazenamento de senhas em texto puro e autorização baseada em IDs enviados pelo cliente.
- **Arquitetura:** rotas ainda acessam o Supabase diretamente e algumas telas concentram responsabilidades demais.
- **Qualidade:** exceções são descartadas silenciosamente, há casts que bypassam a tipagem e não há testes executáveis. A checagem de formatação foi regularizada nesta revisão.
- **Documentação:** as referências quebradas foram corrigidas nesta revisão; ainda há pontos de manutenção documental a acompanhar.

As verificações executadas foram: `npm run build` **passou**, `npm run lint` **passou**, `npm run format:check` **passou após a correção de Q2** e não foram encontrados arquivos `*.test.*` ou `*.spec.*` no projeto.

## Achados críticos

### C1. Banco concede escrita direta aos papéis públicos

**Evidência:** [016_grants_baseline.sql](../supabase/migrations/016_grants_baseline.sql#L3-L19) concede `INSERT`, `UPDATE` e `DELETE` em `partidas`, `partidas_participantes` e `votes` a `anon` e `authenticated`, declarando explicitamente “SEM RLS, SEM policies”. A busca nas migrations não encontrou `ENABLE ROW LEVEL SECURITY` nem `CREATE POLICY`.

**Desalinhamento:** regras de domínio e persistência ficam contornáveis pela API REST. Isso contraria a separação de responsabilidades prevista em `AGENTS.md`, segundo a qual repositories/DAOs e services devem concentrar persistência e regras, e cria risco de corrupção de partidas, escalações e votos por chamadas fora da UI.

**Prioridade:** P0.

**Recomendação:** revogar DML direto dos papéis públicos e usar RLS com policies mínimas ou RPCs `SECURITY DEFINER` que validem identidade, autorização e estado da operação. Validar as permissões efetivas no banco remoto antes e depois da mudança.

### C2. Senhas são armazenadas e comparadas em texto puro

**Evidência:** [021_plaintext_passwords.sql](../supabase/migrations/021_plaintext_passwords.sql#L1-L86) compara `p_senha` diretamente com `senha_hash`, grava a senha nova sem hash e cria jogadores com a senha fixa `123`. A mesma comparação permanece em [102_fix_fazer_login_coluna_ambigua.sql](../supabase/migrations/102_fix_fazer_login_coluna_ambigua.sql#L30-L35).

**Desalinhamento:** a implementação expõe credenciais em caso de vazamento e mantém uma credencial inicial previsível. Também deixa a responsabilidade de segurança em uma RPC pública sem uma fronteira de autenticação robusta, incompatível com o objetivo de código sustentável e com a exigência de não esconder riscos operacionais.

**Prioridade:** P0.

**Recomendação:** migrar para Supabase Auth ou hashes adaptativos; remover comparações em claro; substituir a senha padrão por ativação/troca obrigatória e invalidar credenciais legadas de forma controlada.

### C3. Gates administrativos confiam em IDs controlados pelo cliente

**Evidência:** a sessão é reconstruída a partir de um objeto salvo em `localStorage` em [SessaoContext.tsx](../src/context/SessaoContext.tsx#L24-L34). As RPCs corrigidas em [091_fix_admin_gates_bypassaveis.sql](../supabase/migrations/091_fix_admin_gates_bypassaveis.sql#L20-L40) verificam apenas se o `p_admin_id` recebido corresponde a uma linha com `is_admin = true`; a função continua com `GRANT EXECUTE` para `anon` e `authenticated`.

**Desalinhamento:** a UI pode esconder ações, mas a autorização não está vinculada a uma identidade autenticada pelo servidor. Conhecer um ID administrativo permite tentar chamar RPCs privilegiadas fora da aplicação. Isso coloca regra de domínio e autorização na fronteira errada, contrariando a organização de camadas do `AGENTS.md`.

**Prioridade:** P0.

**Recomendação:** vincular autorização a `auth.uid()`/Supabase Auth e a uma associação interna com o jogador; remover IDs de autoridade dos parâmetros confiáveis; adicionar validações negativas para chamadas anônimas e IDs de terceiros.

## Desalinhamentos de arquitetura e manutenção

### A1. Rotas e componentes ainda acessam o cliente Supabase diretamente

**Evidência:** [Jogos.tsx](../src/routes/Jogos.tsx#L1-L108), [Ranking.tsx](../src/routes/Ranking.tsx#L1-L113), [PartidaNova.tsx](../src/routes/PartidaNova.tsx#L150-L169) e [BannerLembrete.tsx](../src/components/BannerLembrete.tsx#L32-L58) importam `supabase` e fazem queries/RPCs diretamente.

**Desalinhamento:** `AGENTS.md` orienta que clients/gateways encapsulem comunicação externa e que controllers/resources deleguem. Nas telas, renderização, estado, tratamento de erro e detalhes de schema ficam misturados.

**Prioridade:** P1.

**Recomendação:** mover cada consulta/mutação para funções nomeadas em `src/lib`, mantendo nas rotas apenas coordenação, estado e feedback visual.

### A2. Componentes de rota concentram responsabilidades demais

**Evidência:** [Comparador.tsx](../src/routes/Comparador.tsx#L78-L150) tem 548 linhas e combina carregamento, cache, seleção, cálculo e apresentação. [GestaoGoleiros.tsx](../src/routes/GestaoGoleiros.tsx#L31-L150) tem 469 linhas e combina carregamento, busca, edição, clipboard, confirmação, snackbar, modal e listagem.

**Desalinhamento:** esses arquivos excedem uma responsabilidade clara e dificultam manutenção, testes e revisão, contrariando SRP, coesão e a orientação de extrair métodos/componentes quando isso melhora a legibilidade.

**Prioridade:** P1.

**Recomendação:** extrair primeiro operações de domínio/estado para hooks ou funções de `src/lib` e depois separar subcomponentes de apresentação, sem alterar contratos públicos.

### A3. Falhas assíncronas são descartadas silenciosamente

**Evidência:** [Comparador.tsx](../src/routes/Comparador.tsx#L100-L110), [Estatisticas.tsx](../src/routes/Estatisticas.tsx#L54-L68), [PartidaAoVivo.tsx](../src/routes/PartidaAoVivo.tsx#L88-L94) e [pwa.ts](../src/lib/pwa.ts#L292-L302) usam `catch` vazio ou retornam estado vazio sem registrar contexto.

**Desalinhamento:** `AGENTS.md` determina que exceções não sejam escondidas silenciosamente. Em alguns casos a operação pode ser best-effort, mas a mesma estratégia também é usada em carregamentos que deixam a tela vazia ou stale, dificultando diagnóstico.

**Prioridade:** P1.

**Recomendação:** classificar cada operação como tolerante ou visível ao usuário; para as últimas, propagar `formatarMensagemErro`; para as primeiras, registrar contexto técnico sem dados sensíveis e documentar o contrato.

### A4. Casts estruturais bypassam a tipagem nas fronteiras Supabase

**Evidência:** [partidas.ts](../src/lib/partidas.ts#L73-L117) usa `data as Partida`, `data as Placar` e `as unknown as ParticipanteJoinRow`. Há padrão semelhante em [jogadores.ts](../src/lib/jogadores.ts#L300-L318).

**Desalinhamento:** mudanças no schema, nulabilidade ou joins podem compilar e falhar em runtime. Isso reduz a clareza e a proteção oferecidas pelo TypeScript estrito configurado em [tsconfig.app.json](../tsconfig.app.json#L14-L25).

**Prioridade:** P1.

**Recomendação:** usar os tipos gerados do banco onde possível e mappers/narrowing explícitos para joins e RPCs que não sejam inferidos pelo cliente.

### A5. Regra de username diverge entre mensagem, frontend e banco

**Evidência:** [jogadores.ts](../src/lib/jogadores.ts#L11-L24) diz aceitar números, mas a regex `^[a-zA-ZÀ-ÖØ-öø-ÿ_]+$` não aceita dígitos. A migration que define a regra no banco é [095_superadmin_por_id.sql](../supabase/migrations/095_superadmin_por_id.sql#L45-L49).

**Desalinhamento:** a mesma regra de domínio não está centralizada nem consistente entre camadas, o que pode rejeitar no frontend um valor aceito pelo servidor. Isso viola coesão e clareza da regra de negócio.

**Prioridade:** P1.

**Recomendação:** definir uma regra canônica e alinhar regex, mensagem, migration e documentação; cobrir também unicidade case-insensitive e prefixos reservados.

## Lacunas de qualidade e documentação

### Q1. Não há testes executáveis apesar de `vitest` estar instalado

**Evidência:** [package.json](../package.json#L5-L27) declara `vitest`, mas não há script de teste e a busca por `*.test.*`/`*.spec.*` não encontrou arquivos.

**Desalinhamento:** não é uma instrução para criar testes automaticamente; o próprio `AGENTS.md` pede apenas sinalizar a necessidade quando houver risco funcional. O projeto, porém, não tem regressão automatizada observável para regras como placar, votação, cache e autorização.

**Prioridade:** P1.

**Recomendação:** decidir entre remover a dependência inerte ou configurar testes focados para funções puras e contratos de autorização. Esta análise não criou testes, conforme a regra do repositório.

### Q2. [CORRIGIDO] Checagem de formatação estava quebrada

**Evidência:** a análise inicial encontrou falhas em `.prettierrc`, [App.tsx](../src/App.tsx), [Skeletons.tsx](../src/components/Skeletons.tsx) e [NotificacoesSaude.tsx](../src/routes/NotificacoesSaude.tsx). Esses quatro arquivos foram formatados com o Prettier, e a checagem posterior passou.

**Estado atual:** resolvido. O contrato de qualidade declarado no `package.json` está verde após a correção.

**Prioridade:** resolvido.

**Recomendação:** manter `npm run format:check` na validação antes de futuras alterações.

### Q3. [CORRIGIDO] Documentação continha links quebrados

**Evidência:** a análise inicial encontrou referências a `design-system.md` no [README.md](../README.md#L25-L35), no [DESIGN.md](../DESIGN.md#L1-L10) e em documentos de `docs/`, embora o arquivo existente seja `DESIGN.md`. O plano [plano-p1-4-componentes-gigantes.md](plano-p1-4-componentes-gigantes.md#L1-L10) também apontava para o inexistente `docs/plano-refatoracoes.md`.

**Estado atual:** resolvido. As referências foram alinhadas a `DESIGN.md`, e o link para o plano inexistente foi removido sem criar uma fonte artificial.

**Prioridade:** resolvido.

**Recomendação:** manter `DESIGN.md` como nome canônico e validar links Markdown quando novos documentos forem adicionados.

## Configurações que merecem acompanhamento

Em [eslint.config.js](../eslint.config.js#L11-L29), `react-hooks/set-state-in-effect`, `react-hooks/purity` e `react-hooks/static-components` estão desativadas globalmente. Os comentários justificam a decisão e, portanto, não classifico isso como violação direta de `AGENTS.md`; ainda assim, o próprio arquivo registra problemas conhecidos e deixa de detectá-los.

Recomendação: criar uma baseline por regra, corrigir os componentes gradualmente e reativar as regras por etapas. Não vale misturar essa refatoração com os achados P0.

## Pontos positivos verificados

- `npm run build` passou, incluindo TypeScript e build Vite.
- `npm run lint` passou.
- `tsconfig.app.json` mantém `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` e outras salvaguardas úteis.
- Existem módulos de integração em `src/lib`, hooks reutilizáveis e componentes compartilhados; o problema é a adoção incompleta desse padrão, não a ausência total de estrutura.
- Não foram identificadas bibliotecas ou padrões arquiteturais novos e desnecessários nesta revisão.

## Ordem recomendada de tratamento

1. Corrigir autenticação, autorização e grants/RLS no banco; validar chamadas anônimas e fluxos legítimos no ambiente remoto.
2. Encapsular acessos Supabase restantes e separar os componentes grandes por responsabilidade.
3. Parar de engolir falhas não tolerantes e remover casts estruturais nas fronteiras críticas.
4. Corrigir a regra de username; Q2 e Q3 já foram regularizados nesta revisão.
5. Decidir a estratégia de testes e manter as validações de formatação e links.

## Limitações

Esta é uma revisão estática do conteúdo versionado. Não houve alteração de código de produção, execução de fluxos no navegador, consulta ao banco remoto ou teste de exploração das permissões. Os achados P0 devem ser confirmados no ambiente remoto antes da aplicação da correção, mas já possuem evidência suficiente no código versionado para bloquear uma aceitação sem revisão de segurança.
