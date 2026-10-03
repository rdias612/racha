# Racha v2 — Comparativo de Stacks

## Contexto e premissas

- App para acompanhar o racha semanal, **Android e iOS**.
- Distribuição inicial: **instalação pelo navegador (PWA)**; loja não é requisito agora.
- Uso próprio no início, mas **arquitetura multi-grupo** (multi-tenant) desde o começo.
- Login por **magic link / código por e-mail**.
- Reescrita em **repo novo**, migrando **tela por tela**.
- Backend atual: **Supabase** (Postgres + Auth + Storage + Realtime) — mantido em todas as opções.
- Experiência atual do dev: TypeScript + React.

---

## Opção A — React + Vite PWA (Capacitor opcional no futuro) ⭐ recomendada

**Stack:** React · Vite · TypeScript · Tailwind · shadcn/ui (Radix) · Vaul · Sonner · TanStack Query · TanStack Router · React Hook Form + Zod · vite-plugin-pwa · Supabase. Capacitor se/quando precisar de loja.

**Prós**
- Aproveita 100% do conhecimento atual (TS/React/Tailwind/Supabase) — curva de aprendizado quase zero.
- Melhor resultado possível como **PWA**: bundle leve, abre rápido, texto/teclado/acessibilidade nativos do browser.
- Deploy instantâneo na Vercel; atualização chega a todos sem passar por loja.
- Ecossistema de componentes prontos é o maior de todos (shadcn blocks, Radix, TanStack).
- Lógica de domínio atual (`src/lib`: ranking, escalação, dívidas…) pode ser portada quase direto.
- Caminho para loja existe sem reescrever: **Capacitor** empacota o mesmo código e dá push nativo, haptics, câmera.

**Contras**
- No iOS, PWA tem limitações: push só com app instalado na tela inicial, sem presença na App Store, Safari pode limpar dados após longos períodos sem uso.
- Gestos e animações são "quase nativos", não nativos — exige cuidado (Vaul, safe-area, `touch-action`).
- Com Capacitor, a UI continua sendo web dentro de WebView (alguns usuários percebem).
- Risco de repetir a bagunça atual se não houver disciplina de arquitetura (organização por feature).

**Custo:** baixo · **Risco:** baixo · **Encaixe com premissas:** excelente

---

## Opção B — Expo (React Native) universal

**Stack:** Expo · Expo Router · React Native · TypeScript · NativeWind (Tailwind para RN) · Tamagui ou Gluestack UI · TanStack Query · Zod · EAS Build · Supabase.

**Prós**
- UI **nativa de verdade** no Android e iOS: gestos, scroll, animações a 60fps (Reanimated), haptics.
- Continua TypeScript + React — boa parte do raciocínio é transferível.
- Push notifications confiáveis em ambas as plataformas (Expo Notifications).
- Pronto para lojas quando o produto crescer; EAS Build compila iOS sem ter Mac.
- Atualizações OTA (EAS Update) sem passar por revisão de loja para mudanças de JS.
- Gera também versão web (react-native-web).

**Contras**
- **PWA/web fica como cidadão de segunda classe**: web gerada é mais pesada e menos polida que a opção A. Como hoje a distribuição é pelo navegador, isso pesa.
- Sem loja, distribuir no iOS é inviável (sem TestFlight/App Store não instala) — **na prática força publicar na App Store (US$ 99/ano)** para usuários iPhone.
- Não usa as libs web (shadcn, Radix, Vaul, Sonner) — ecossistema de componentes diferente e menor.
- Curva de aprendizado: layout com Flexbox do RN, primitives próprias (`View`, `Text`), builds nativos, configuração de push/certificados.
- Ciclo de desenvolvimento mais lento (builds, simuladores, revisão de loja).

**Custo:** médio · **Risco:** médio · **Encaixe com premissas:** bom se loja virar requisito; fraco para "instalar pelo navegador"

---

## Opção C — Flutter

**Stack:** Flutter · Dart · Riverpod/Bloc · go_router · supabase_flutter · Material 3 / Cupertino.

**Prós**
- UI nativa e muito consistente entre Android e iOS, performance excelente.
- Componentes Material/Cupertino completos "de fábrica" — pouca lib externa para UI.
- Ótima ferramenta (hot reload, DevTools), tipagem forte.
- SDK oficial do Supabase para Dart é maduro.

**Contras**
- **Flutter Web é fraco como PWA**: renderiza em canvas, bundle grande (vários MB), carregamento lento no 4G, seleção de texto/teclado/acessibilidade estranhos.
- Linguagem nova (Dart) e ecossistema novo — **nada do código ou conhecimento atual é reaproveitado**, nem a lógica de domínio.
- Mesmo problema da opção B no iOS: sem App Store, não há distribuição viável fora da web.
- Para um projeto de uma pessoa, o custo de reaprender tudo é o maior entre as opções.

**Custo:** alto · **Risco:** alto · **Encaixe com premissas:** fraco

---

## Opção D — Ionic React + Capacitor

**Stack:** Ionic Framework (React) · Capacitor · TypeScript · TanStack Query · Supabase.

**Prós**
- Componentes que **imitam iOS e Android automaticamente** (navegação com back nativo, tabs, action sheets, transições de página).
- Mesmo código vira PWA e app de loja (Capacitor é do mesmo time).
- Continua React + TypeScript.

**Contras**
- Biblioteca grande e opinativa; customizar o visual para fugir do "cara de Ionic" dá trabalho.
- Convive mal com Tailwind/shadcn (sistemas de estilo concorrentes).
- Comunidade e ritmo de evolução menores que o ecossistema React "puro".
- Roteamento e ciclo de vida de páginas próprios do Ionic adicionam complexidade.

**Custo:** baixo-médio · **Risco:** médio · **Encaixe com premissas:** bom, mas a opção A entrega o mesmo com mais liberdade visual

---

## Resumo

| Critério | A. React PWA | B. Expo | C. Flutter | D. Ionic |
|---|---|---|---|---|
| Qualidade como PWA | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| Sensação nativa | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Reaproveita conhecimento/código | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| Componentes prontos | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Push no iOS | ⭐⭐ (⭐⭐⭐⭐ c/ Capacitor) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Pronto para lojas | via Capacitor | nativo | nativo | nativo |
| Custo de lojas | só se quiser | obrigatório p/ iOS | obrigatório p/ iOS | só se quiser |
| Curva de aprendizado | mínima | média | alta | baixa |

## Recomendação

**Opção A.** Ela atende todas as premissas atuais (PWA, uso próprio, multi-grupo, e-mail) com o menor custo, e mantém uma porta aberta (Capacitor) caso o produto cresça e loja vire requisito.

Reavaliar **Opção B (Expo)** se: muitos usuários forem iPhone e push confiável virar crítico, ou se a ambição de produto exigir presença nas lojas desde o lançamento.

## Independente da stack (o que de fato resolve "difícil de manter")

- Organização **por feature** (`features/partidas`, `features/financeiro`, `features/comparador`…), não por tipo de arquivo.
- Regras de domínio em funções puras, separadas de UI e de acesso a dados.
- Acesso ao Supabase isolado em camada de dados (queries/mutations do TanStack Query por feature).
- Multi-tenant: entidade `grupo`, `grupo_id` em todas as tabelas, RLS por grupo, papéis por grupo (dono/admin/jogador), convites.
- Tipos do banco gerados (`supabase gen types`) e validação de entrada com Zod.
