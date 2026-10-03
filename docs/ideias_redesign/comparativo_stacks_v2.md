# Racha v2 — Comparativo de stacks para distribuição PWA

Esta v2 revisa o comparativo original considerando a decisão de manter a distribuição como PWA, sem publicação na Play Store ou na App Store.

## Objetivo

Escolher uma base sustentável para evoluir o Racha sem trocar de plataforma por uma necessidade de distribuição que não existe. A escolha da stack, a decisão de reescrever em um novo repositório e a arquitetura multi-grupo são decisões relacionadas, mas independentes.

## Premissas

- O produto será distribuído por URL e instalado pelo navegador como PWA em Android e iOS.
- Não está prevista distribuição pela Play Store ou pela App Store, agora ou no futuro.
- A aplicação atual usa React, Vite, TypeScript, Tailwind CSS, React Router e Supabase.
- Já existem fluxo de instalação PWA, service worker próprio e implementação de Web Push. Consulte [`package.json`](../../package.json), [`vite.config.ts`](../../vite.config.ts), [`src/lib/pwa.ts`](../../src/lib/pwa.ts), [`public/sw.js`](../../public/sw.js) e [`BotaoInstalar.tsx`](../../src/components/BotaoInstalar.tsx).
- Supabase permanece como backend, com Postgres, Auth, Storage e Realtime.
- Login por magic link ou código por e-mail continua sendo o fluxo desejado.
- A experiência atual da pessoa responsável pelo projeto é principalmente TypeScript e React.
- A reescrita em um repositório novo, migrando tela por tela, ainda precisa ser justificada separadamente; não é consequência da escolha de uma stack PWA.
- Multi-grupo desde o início é um requisito de produto, mas seu modelo de dados e segurança deve ser definido em uma decisão arquitetural própria.

## Critérios de decisão

1. Ser uma boa aplicação web instalável, sem depender de lojas.
2. Aproveitar a base e o conhecimento já existentes.
3. Evitar migração de framework e mudanças de bibliotecas sem benefício comprovado.
4. Atender aos requisitos reais de UX, acessibilidade, desempenho, autenticação e notificações nos aparelhos-alvo.
5. Resolver problemas de manutenção pela organização e pelos limites do código, não apenas pela troca de stack.

## Comparativo resumido

| Opção | Distribuição web sem loja | Reaproveitamento da base atual | Principal benefício | Encaixe |
|---|---|---|---|---|
| A. React + Vite PWA atual | Direta; é o modelo pretendido | Alto | Evolução incremental, mantendo React e a experiência web | **Excelente — recomendada** |
| B. Expo / React Native | Pode gerar uma versão web; qualidade de PWA precisa ser validada separadamente | Parcial | Interface e APIs nativas quando existe um app nativo distribuído | Fraco para o objetivo atual |
| C. Flutter | Pode gerar uma versão web; qualidade de PWA precisa ser validada separadamente | Baixo | Aplicação nativa com uma base Flutter | Fraco para o objetivo atual |
| D. Ionic React | Pode ser servido como aplicação web/PWA; Capacitor é opcional | Parcial/alto | Componentes e convenções de interface voltados a apps | Possível, sem motivo atual para trocar |

As versões web de Expo e Flutter não dependem de publicação em loja para serem hospedadas. Isso não significa que ofereçam automaticamente a mesma experiência PWA da opção A: instalação, cache, acessibilidade, desempenho, notificações e navegação precisam ser avaliados no produto real. As vantagens nativas dessas opções não ajudam enquanto a distribuição desejada for apenas PWA.

## Opção A — Continuar com React + Vite PWA

**Base:** React · Vite · TypeScript · Tailwind CSS · React Router · Supabase · service worker existente.

**Recomendação:** preservar essa base e evoluí-la incrementalmente. A aplicação já atende ao modelo de distribuição desejado e mantém o ecossistema de desenvolvimento conhecido.

**Vantagens**

- Mantém a distribuição por navegador e instalação PWA em Android e iOS.
- Evita reescrever a aplicação em outro framework.
- Reaproveita a base React, TypeScript, Tailwind, Supabase e as funcionalidades PWA existentes.
- Permite publicar atualizações web sem um ciclo de revisão de loja.
- Permite focar a evolução na organização por domínio/feature e na qualidade do fluxo de dados.

**Limitações a considerar**

- Instalação e funcionalidades disponíveis variam por navegador e sistema. No iOS, a instalação é manual pelo Safari.
- Web Push não deve ser comparado diretamente com push nativo: os requisitos e as condições de suporte são diferentes.
- Cache, armazenamento local e inscrições de push podem ser removidos ou invalidados pelo sistema. Isso não deve ser descrito como perda dos dados mantidos no Supabase; a aplicação precisa conseguir sincronizar o estado remoto novamente.
- Interações, safe areas, teclado virtual, gestos e estados offline precisam ser verificados nos aparelhos-alvo.

### Bibliotecas adicionais: adotar sob necessidade

A permanência em React + Vite não exige adotar todas as bibliotecas listadas no comparativo original.

- **TanStack Query:** considerar se cache, invalidação e sincronização das consultas se tornarem um problema concreto.
- **TanStack Router:** manter React Router enquanto atender aos fluxos; trocar apenas diante de uma necessidade que justifique a migração.
- **React Hook Form e Zod:** considerar para formulários e validações que se beneficiem dessas ferramentas.
- **shadcn/ui, Radix, Vaul e Sonner:** avaliar componente a componente, alinhando com o design system existente.
- **vite-plugin-pwa:** comparar com o service worker próprio antes de adotar. Evitar manter duas estratégias concorrentes; validar cache, atualização e Web Push se houver migração.

Essas bibliotecas são opções, não pré-requisitos para continuar como PWA.

## Opção B — Expo / React Native

Expo é adequado quando a prioridade é construir e distribuir aplicações nativas Android/iOS. Também pode gerar uma versão web usando React Native Web; essa versão pode ser hospedada sem loja, mas precisa ser avaliada como produto web e configurada para os requisitos PWA desejados.

**Para este projeto**

- As vantagens de UI e push nativos não se aplicam automaticamente à versão web.
- Componentes web existentes não são diretamente intercambiáveis com os componentes React Native.
- Migrar exigiria reavaliar UI, navegação, bibliotecas e comportamento em navegador.
- Um binário nativo e uma versão web/PWA são alvos de distribuição distintos. A ausência de loja não impede hospedagem web, mas também não entrega por si só uma instalação nativa pública no iOS.

**Encaixe:** fraco enquanto o requisito for continuar apenas com PWA.

## Opção C — Flutter

Flutter pode gerar aplicações nativas e uma versão web, que pode ser hospedada sem publicação em loja. A qualidade da experiência web para este produto deve ser medida, não presumida a partir das capacidades nativas do framework.

**Para este projeto**

- Exigiria adotar Dart e um novo ecossistema.
- A lógica existente em TypeScript não seria reaproveitada diretamente.
- Desempenho inicial, tamanho, acessibilidade, seleção de texto e experiência PWA devem ser avaliados em um protótipo representativo antes de qualquer decisão.
- Os benefícios nativos não compensam a migração se o produto continuar sendo distribuído como PWA.

**Encaixe:** fraco enquanto o requisito for continuar apenas com PWA.

## Opção D — Ionic React + Capacitor

Ionic React pode ser usado como aplicação web/PWA sem publicação em loja. Capacitor acrescenta um contêiner nativo e integração com recursos do aparelho; ele não é necessário para distribuir a aplicação como PWA.

**Para este projeto**

- Ionic pode fazer sentido se seus componentes e padrões de navegação forem desejados.
- Adiciona convenções próprias de UI e ciclo de vida; a adoção deve resolver uma necessidade concreta.
- Capacitor e recursos nativos não são benefícios da distribuição PWA e ficam fora do escopo atual.

**Encaixe:** possível, mas sem vantagem suficiente para substituir a base atual.

## Web Push, instalação e distribuição

- Compare separadamente **Web Push em PWA** e **push nativo em aplicação instalada**.
- Documente e teste as condições de suporte do Web Push nos sistemas e navegadores efetivamente usados, incluindo instalação, permissões e recuperação de inscrições invalidadas.
- O fluxo de instalação iOS já orienta a pessoa a usar “Adicionar à Tela de Início” no Safari; o Android/Chrome oferece o fluxo de instalação do navegador.
- Mantenha o Supabase como fonte dos dados duráveis. Cache, storage local e inscrições de push são estado local e podem exigir recuperação.
- Não inclua custos ou requisitos de publicação em lojas na pontuação das opções enquanto lojas estiverem fora do escopo.

## Manutenção e arquitetura multi-grupo

A troca de framework não resolve, por si só, dificuldades de manutenção. Independente da stack:

- Organize código por feature/domínio, evitando concentrar a estrutura apenas por tipo de arquivo.
- Mantenha regras de domínio separadas de UI e persistência quando isso melhorar o entendimento e os testes.
- Isole o acesso ao Supabase em módulos coesos, sem criar camadas genéricas sem necessidade.
- Gere tipos do banco quando aplicável e valide entradas nas fronteiras que recebem dados externos.
- Modele multi-grupo em um plano próprio: associação entre pessoas e grupos, papéis, convites, isolamento entre tenants e políticas RLS. Não presuma que adicionar `grupo_id` a toda tabela seja suficiente para garantir isolamento.

## Plano recomendado

1. **Fixar a decisão de distribuição:** PWA via navegador; lojas e binários nativos fora do escopo.
2. **Manter a stack React + Vite existente:** não trocar framework, roteador ou service worker sem uma necessidade identificada.
3. **Justificar a reescrita separadamente:** listar problemas concretos de manutenção e comparar reescrita com evolução incremental antes de criar outro repositório.
4. **Migrar por fatia vertical, se a reescrita for aprovada:** validar uma feature completa em Android e iOS antes de migrar todas as telas.
5. **Validar a PWA nos aparelhos-alvo:** instalação, login por e-mail, navegação, teclado/safe areas, Web Push, atualização do service worker e recuperação após perda de estado local.
6. **Adicionar bibliotecas sob demanda:** cada dependência nova deve resolver um problema observado e reduzir, não ampliar, a complexidade.
7. **Reabrir a decisão de stack apenas com um requisito não atendido:** por exemplo, uma capacidade exclusivamente nativa que seja indispensável e um canal de distribuição compatível com as restrições do produto.

## Decisão

**Continuar com React + Vite PWA.** A stack atual já corresponde à distribuição pretendida; a recomendação é evoluí-la, não trocar para Expo, Flutter ou Ionic. Não planejar Capacitor enquanto não houver requisito nativo e canal de distribuição aprovado.
