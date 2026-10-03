# Análise das bibliotecas da Opção A

Esta análise aprofunda as tecnologias e bibliotecas da Opção A do [comparativo de stacks v2](./comparativo_stacks_v2.md), considerando a decisão de manter uma PWA sem publicação em lojas.

## Contexto do projeto

A base existente já usa React, Vite, TypeScript, Tailwind CSS, React Router e Supabase. Há também um fluxo próprio de instalação PWA e um service worker com tratamento de Web Push. Referências: [`package.json`](../../package.json), [`vite.config.ts`](../../vite.config.ts), [`src/lib/pwa.ts`](../../src/lib/pwa.ts), [`public/sw.js`](../../public/sw.js) e [`BotaoInstalar.tsx`](../../src/components/BotaoInstalar.tsx).

As ferramentas abaixo não são todas do mesmo tipo: React é uma biblioteca de UI; Vite é uma ferramenta de build; TypeScript é uma linguagem; Tailwind é um framework CSS; Supabase é uma plataforma backend com SDK cliente.

## Base atual — manter

### React

**Papel:** construir a interface com componentes.

**Prós**

- Ecossistema amplo e grande disponibilidade de conhecimento e ferramentas.
- Componentes podem ser compostos e reutilizados entre telas.
- Aproveita o código e o conhecimento já existentes no projeto.

**Contras**

- Não inclui roteamento, cache de dados do servidor ou gerenciamento de formulários.
- Estado e efeitos podem ficar difíceis de manter sem limites claros entre componentes.
- O ecossistema oferece várias alternativas para cada problema, exigindo escolhas e convenções.

**Avaliação:** manter. A adoção de React não resolve arquitetura por si só; a organização do código continua importante.

### Vite

**Papel:** servidor de desenvolvimento e ferramenta de build para a aplicação web.

**Prós**

- Inicialização e atualização durante o desenvolvimento rápidas.
- Configuração adequada para uma SPA React e integração com plugins.
- Build de produção simples e compatível com deploy estático.

**Contras**

- Não é um framework full-stack e não define padrões de dados, rotas ou formulários.
- A aplicação precisa configurar corretamente fallback de rotas no host.
- Recursos como manifest e service worker dependem de código próprio ou plugins.

**Avaliação:** manter. O projeto já usa Vite e configura nele a integração necessária ao service worker.

### TypeScript

**Papel:** adicionar tipos estáticos ao JavaScript.

**Prós**

- Detecta incompatibilidades antes da execução.
- Melhora autocomplete e torna alterações em modelos e funções mais seguras.
- Pode usar tipos gerados do Supabase para reduzir divergências entre código e banco.

**Contras**

- Os tipos são removidos no build e não validam dados em tempo de execução.
- Tipos genéricos ou excessivamente complexos podem dificultar a leitura.
- Tipos gerados não substituem validação de dados externos nem políticas de segurança no banco.

**Avaliação:** manter. Usar tipos explícitos onde tornam contratos mais claros; validar dados nas fronteiras em que entram no sistema.

### Tailwind CSS

**Papel:** aplicar estilos por meio de classes utilitárias.

**Prós**

- Acelera ajustes de layout e estilo diretamente nos componentes.
- Permite compartilhar tokens e convenções visuais.
- Integra-se naturalmente ao fluxo React/Vite já usado.

**Contras**

- Muitos nomes de classe podem deixar o JSX extenso.
- Valores arbitrários e estilos inconsistentes podem enfraquecer o design system.
- Não fornece comportamento de componentes, como foco, navegação por teclado ou diálogos.

**Avaliação:** manter. A consistência depende de tokens e componentes reutilizáveis, não apenas do uso de classes utilitárias.

### React Router

**Papel:** definir navegação, rotas e layouts.

**Prós**

- Já está presente no projeto.
- Atende navegação e layouts sem trocar a base atual.
- Evita custo e risco de uma migração de roteador.

**Contras**

- Exige convenções próprias para organização de rotas e carregamento de dados.
- Não oferece, por si só, cache de consultas equivalente ao TanStack Query.

**Avaliação:** manter enquanto resolver as necessidades atuais. TanStack Router é uma alternativa, não uma dependência complementar.

### Supabase e `supabase-js`

**Papel:** Supabase é a plataforma backend; `supabase-js` é o SDK usado pela aplicação para acessá-la.

**Prós**

- Integra Postgres, Auth, Storage e Realtime.
- Reduz a quantidade de infraestrutura backend que o projeto precisa operar.
- O SDK e os tipos TypeScript apoiam o desenvolvimento no stack atual.

**Contras**

- A aplicação fica acoplada às APIs e aos serviços do Supabase.
- Políticas RLS incorretas podem expor ou bloquear dados.
- Realtime, autorização e regras de negócio precisam de tratamento explícito; não são resolvidos apenas pelo SDK.

**Avaliação:** manter, como já definido. A chave pública usada no cliente não substitui autorização no banco: o isolamento deve ser garantido por políticas e regras adequadas.

## Opcionais — adotar conforme necessidade

### TanStack Query

**Papel:** gerenciar dados remotos no cliente, incluindo cache e sincronização de consultas.

**Prós**

- Evita chamadas duplicadas em situações compatíveis com a mesma query.
- Padroniza estados de carregamento, erro, atualização e cache.
- Facilita invalidação e atualização após mutations.

**Contras**

- Exige convenções consistentes para query keys e invalidação.
- Adiciona uma camada de estado/cache que precisa ser entendida pela equipe.
- Não substitui Supabase, estado local ou formulários.
- Não sincroniza automaticamente eventos do Supabase Realtime com o cache; essa integração precisa ser definida.

**Avaliação:** considerar se cache, refetch e atualização dos dados remotos estiverem gerando complexidade. Não adotar apenas por ser comum em aplicações React.

### TanStack Router

**Papel:** roteador para aplicações React, com suporte forte a tipos em rotas e parâmetros.

**Prós**

- Tipagem de rotas e parâmetros de busca pode reduzir erros de navegação.
- Oferece estrutura para layouts, loaders e divisão de código.

**Contras**

- Exige migração e aprendizado, sem melhorar por si só a qualidade PWA.
- Sobrepõe-se ao React Router já usado.

**Avaliação:** não trocar sem um problema concreto que o React Router atual não resolva. Não usar ambos para o mesmo conjunto de rotas.

### React Hook Form

**Papel:** organizar estado, validação e submissão de formulários.

**Prós**

- Ajuda em formulários longos, condicionais ou com campos dinâmicos.
- Evita atualizações desnecessárias em formulários maiores.
- Integra-se com bibliotecas de validação, incluindo Zod.

**Contras**

- Introduz uma API própria e conceitos adicionais.
- Componentes controlados podem precisar de integração específica.
- É desnecessário para formulários simples que o padrão atual já atende.

**Avaliação:** adotar em formulários com complexidade suficiente para justificar a abstração, não automaticamente em todo formulário.

### Zod

**Papel:** declarar schemas e validar dados em tempo de execução, inferindo tipos TypeScript.

**Prós**

- Um schema pode servir para validação e inferência de tipos.
- Útil para dados recebidos de formulários, URLs, arquivos ou serviços externos.
- Integra-se com React Hook Form.

**Contras**

- Schemas precisam ser mantidos e podem duplicar contratos já descritos em outros lugares.
- Validação no cliente adiciona código ao bundle.
- Não substitui validação no servidor, constraints no banco ou RLS.

**Avaliação:** útil nas fronteiras de entrada de dados. Evitar criar schemas redundantes para todo objeto interno sem necessidade.

### Radix UI

**Papel:** primitives de UI sem estilo visual, voltadas a comportamentos como dialogs, menus e popovers.

**Prós**

- Separa comportamento e aparência.
- Ajuda a implementar foco, teclado e semântica de componentes interativos.
- Pode servir como base para componentes alinhados ao design system próprio.

**Contras**

- A aparência precisa ser construída e mantida no projeto.
- A API e a composição podem aumentar a complexidade de componentes simples.
- Acessibilidade precisa continuar sendo verificada no produto real.

**Avaliação:** usar quando for preciso construir componentes próprios sobre primitives acessíveis. Não é obrigatório se componentes atuais já atenderem.

### shadcn/ui

**Papel:** conjunto de componentes fornecidos como código para adicionar e adaptar no próprio projeto; não funciona como uma biblioteca tradicional de componentes pronta e centralizada.

**Prós**

- O código dos componentes fica sob controle do projeto.
- Componentes podem ser adaptados ao design sem depender de uma API fechada.
- Pode acelerar a montagem de elementos comuns de interface.

**Contras**

- Atualizações e divergências do código copiado ficam sob responsabilidade do projeto.
- Pode duplicar componentes próprios ou convenções visuais existentes.
- Alguns componentes dependem de Radix e de outras utilidades; adotar o conjunto amplia dependências.

**Avaliação:** adotar componente a componente se combinar com o design system existente. Não importar o catálogo completo por padrão.

### Vaul

**Papel:** implementar drawers e bottom sheets com gestos em aplicações React.

**Prós**

- Acelera a criação de painéis móveis que podem ser fechados por gesto.
- Pode oferecer uma interação adequada para ações contextuais em telas pequenas.

**Contras**

- Resolve um padrão específico, não uma necessidade geral de UI.
- Gestos, rolagem, foco e safe areas podem exigir ajustes e testes.
- Adiciona uma dependência mesmo que o padrão seja usado em poucas telas.

**Avaliação:** usar apenas se bottom sheets forem parte recorrente da experiência e a implementação própria não for suficiente.

### Sonner

**Papel:** exibir notificações temporárias (toasts).

**Prós**

- API simples para feedback breve, inclusive em operações assíncronas.
- Reduz o esforço de criar e posicionar uma área de notificações.

**Contras**

- Mensagens temporárias podem desaparecer antes de serem lidas.
- Toast não deve ser a única apresentação de erros importantes ou validações.
- Uso excessivo gera ruído e dificulta a compreensão do estado da aplicação.

**Avaliação:** útil para confirmações e avisos breves. Erros que exigem ação devem permanecer visíveis junto ao contexto correspondente.

### `vite-plugin-pwa`

**Papel:** integrar ao build do Vite recursos como manifest, registro de service worker e estratégias de cache com Workbox.

**Prós**

- Automatiza partes comuns da configuração de uma PWA.
- Pode simplificar geração de arquivos e políticas de precache.
- Workbox oferece estratégias reutilizáveis para cache.

**Contras**

- Cache e ciclo de atualização do service worker podem servir arquivos desatualizados se configurados incorretamente.
- Adiciona configuração e comportamento implícito ao build.
- Não cria automaticamente uma boa experiência offline nem resolve a UX de instalação ou notificações.
- Pode sobrepor-se ao service worker próprio já existente.

**Avaliação:** só migrar se reduzir a manutenção atual sem perder os comportamentos de instalação, cache e Web Push. Escolher uma estratégia de service worker; não manter o plugin e a configuração própria como sistemas concorrentes.

## Fora do escopo atual: Capacitor

Capacitor empacota a aplicação web em um contêiner nativo e permite acessar APIs do aparelho por plugins.

**Prós**

- Reaproveita boa parte da interface web.
- Pode oferecer integração com recursos nativos, como câmera ou haptics.

**Contras**

- Introduz builds e manutenção de projetos nativos.
- A interface continua sendo executada em uma WebView.
- O contêiner não elimina a necessidade de decidir como distribuir e atualizar o app nativo.

**Avaliação:** não planejar enquanto o produto permanecer exclusivamente PWA e não houver requisito nativo indispensável.

## Seleção recomendada

1. **Manter:** React, Vite, TypeScript, Tailwind, React Router e Supabase.
2. **Avaliar por dor observada:** TanStack Query para dados remotos e Zod para validar entradas.
3. **Aplicar seletivamente:** React Hook Form em formulários complexos; Radix/shadcn para componentes que o design system ainda não atende; Vaul para bottom sheets recorrentes; Sonner para feedback temporário.
4. **Não migrar por padrão:** TanStack Router e `vite-plugin-pwa`; primeiro verificar se há um problema que justifique substituir as soluções atuais.
5. **Manter fora do plano:** Capacitor, enquanto lojas e distribuição nativa não forem requisitos.
