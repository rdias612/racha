# Plano — Refatoração da Gestão de Notificações em Rotas e Abas Independentes

> **Status**: Planejamento arquitetural (apenas plano, sem execução prévia de código).  
> **Origem**: Diretriz de arquitetura do usuário — separar o componente monolítico `/notificacoes` em 4 rotas/telas coesas com uma barra de navegação compartilhada (`AbasNotificacoes`), espelhando o padrão canônico do módulo `/estatisticas` (`/estatisticas/jogador`, `/estatisticas/racha`, `/estatisticas/comparar`).

---

## 1. Diagnóstico e Motivação Arquitetural

### 1.1 O Problema do Componente Monolítico Atual (`Notificacoes.tsx`)

Atualmente, `src/routes/Notificacoes.tsx` opera como um "God Component" que concentra responsabilidades heterogêneas e descorrelacionadas:

1. **Violação do Princípio da Responsabilidade Única (SRP)**:
   - Configurações de domínio da presença semanal (dia, horário, reforço, variáveis de template).
   - Configurações de domínio da votação pós-jogo (toggles de 5 buckets, templates de cópia).
   - Ações operacionais imediatas (teste individual de push e reenvio emergencial de convite para partida draft).
   - Auditoria e observabilidade técnica (quadro com dezenas de registros do ledger de entregas e aparelhos ativos de todos os atletas).

2. **Inchaço de Network e Desperdício de Queries**:
   - Um administrador que entra para checar a saúde dos aparelhos dos atletas no dia do jogo é obrigado a disparar:
     - `obterConfiguracoesNotificacoes()` (busca configs no banco)
     - `obterPartidaDraftAtual()` (busca rascunho de partida)
     - `statusPush()` (consulta API do Service Worker / PushManager)
     - `obterPainelEntregasPush()` (RPC pesada do ledger de entregas)
   - Um administrador que quer apenas ajustar o horário da quarta-feira baixa e processa todo o quadro de saúde dos 30+ atletas sem necessidade.

3. **Incompatibilidade com o Padrão do Projeto**:
   - No módulo de estatísticas, o projeto já adota a arquitetura canônica de **sub-rotas lazy com barra de abas unificada** (`AbasEstatisticas.tsx` gerenciando `/estatisticas/jogador`, `/estatisticas/racha` e `/estatisticas/comparar`).
   - Separar `/notificacoes` em rotas próprias traz paridade arquitetural, melhora o code-splitting e permite URLs diretas compartilháveis e bookmarkáveis (deep linking).

---

## 2. Nova Arquitetura Proposta

### 2.1 Mapeamento de Rotas e Responsabilidades

| Rota                        | Tela               | Tipo de Operação             | Queries Executadas                      | Componente                                            |
| :-------------------------- | :----------------- | :--------------------------- | :-------------------------------------- | :---------------------------------------------------- |
| `/notificacoes`             | _Redirect_         | Navegação                    | Nenhuma (`replace` para `/confirmacao`) | `<Navigate to="/notificacoes/confirmacao" replace />` |
| `/notificacoes/confirmacao` | **1. Confirmação** | Formulário / Configuração    | `obterConfiguracoesNotificacoes`        | `NotificacoesConfirmacao.tsx`                         |
| `/notificacoes/votacao`     | **2. Votação**     | Formulário / Configuração    | `obterConfiguracoesNotificacoes`        | `NotificacoesVotacao.tsx`                             |
| `/notificacoes/testes`      | **3. Testes**      | Operação Imediata / Disparos | `statusPush`, `obterPartidaDraftAtual`  | `NotificacoesTestes.tsx`                              |
| `/notificacoes/saude`       | **4. Saúde**       | Auditoria / Leitura          | `obterPainelEntregasPush`               | `NotificacoesSaude.tsx`                               |

---

### 2.2 Componente Compartilhado: `src/components/AbasNotificacoes.tsx`

Seguindo exatamente a implementação de `src/components/AbasEstatisticas.tsx` e o Design System (`DESIGN.md`):

```tsx
import { NavLink } from 'react-router-dom';
import { preCarregarRota } from '../lib/rotas';

const ABAS = [
  { to: '/notificacoes/confirmacao', label: '1. Confirmação' },
  { to: '/notificacoes/votacao', label: '2. Votação' },
  { to: '/notificacoes/testes', label: '3. Testes' },
  { to: '/notificacoes/saude', label: '4. Saúde' },
] as const;

export interface AbasNotificacoesProps {
  className?: string;
}

export function AbasNotificacoes({ className = '' }: AbasNotificacoesProps) {
  return (
    <nav
      aria-label="Abas de notificações"
      className={`flex gap-1 overflow-x-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-xs no-scrollbar ${className}`}
    >
      {ABAS.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.to}
          onTouchStart={() => preCarregarRota(aba.to)}
          onMouseEnter={() => preCarregarRota(aba.to)}
          onFocus={() => preCarregarRota(aba.to)}
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-[3px] px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap transition min-h-[44px] flex items-center justify-center cursor-pointer ${
              isActive
                ? 'bg-destaque text-destaque-tinta shadow-xs'
                : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`
          }
        >
          {aba.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

### 2.3 Gestos Touch (Swipe Nativo) entre as Rotas

Em cada uma das 4 telas de rota, utiliza-se o hook `useSwipeTabs`:

```tsx
const { handlers: swipeHandlers } = useSwipeTabs({
  tabs: [
    '/notificacoes/confirmacao',
    '/notificacoes/votacao',
    '/notificacoes/testes',
    '/notificacoes/saude',
  ],
  activeTab: '/notificacoes/confirmacao', // ou respectiva rota ativa
});
```

Como `onChangeTab` é omitido, o próprio `useSwipeTabs` executa `navigate(targetTab)` com trava vertical e haptic feedback (`vibrateLight`), garantindo uma transição fluida entre telas no celular.

---

## 3. Detalhamento das Telas / Rotas Especializadas

### 3.1 `src/routes/NotificacoesConfirmacao.tsx`

- **Responsabilidade**: Gerenciar o disparo do convite semanal de presença.
- **Estado**: Carrega somente `obterConfiguracoesNotificacoes`.
- **UI**:
  - Cabeçalho Súmula CBO + `BotaoVoltar fallback="/"`
  - `<AbasNotificacoes />`
  - Form com `<SecaoNotificacaoConfirmacao />`
  - Botão Salvar Alterações (específico deste formulário)
  - Modais: `ModalSelecionarAgendamento` e `ModalSelecionarOpcao` (reforço).
  - Feedback via `Snackbar`.
- **Benefício**: Se a RPC do painel de entregas falhar ou demorar, a configuração de presença abre instantaneamente.

### 3.2 `src/routes/NotificacoesVotacao.tsx`

- **Responsabilidade**: Gerenciar lembretes e templates de avaliação pós-jogo.
- **Estado**: Carrega somente `obterConfiguracoesNotificacoes`.
- **UI**:
  - Cabeçalho Súmula CBO + `BotaoVoltar fallback="/"`
  - `<AbasNotificacoes />`
  - Form com `<SecaoNotificacaoVotacao />` (5 buckets e acordeão de mensagens)
  - Botão Salvar Alterações (específico deste formulário)
  - Feedback via `Snackbar`.
- **Benefício**: Zero dependência de status PWA local ou drafts de jogos.

### 3.3 `src/routes/NotificacoesTestes.tsx`

- **Responsabilidade**: Realizar testes manuais e disparos de emergência.
- **Estado**: Carrega somente `statusPush(jogador.id)` e `obterPartidaDraftAtual()`.
- **UI**:
  - Cabeçalho Súmula CBO + `BotaoVoltar fallback="/"`
  - `<AbasNotificacoes />`
  - `<SecaoNotificacaoTestes />` (card de teste no celular + card de reenvio para rascunho)
  - Modal `ConfirmDialog` de reenvio.
  - Feedback via `Snackbar`.
- **Benefício**: Não possui botão salvar (não há formulário de banco). Ações puramente transacionais.

### 3.4 `src/routes/NotificacoesSaude.tsx`

- **Responsabilidade**: Painel de observabilidade das entregas e aparelhos inscritos por atleta.
- **Estado**: Carrega somente `obterPainelEntregasPush(jogador.id)`.
- **UI**:
  - Cabeçalho Súmula CBO + `BotaoVoltar fallback="/"`
  - `<AbasNotificacoes />`
  - `<SecaoNotificacaoSaude />` (lista de atletas, contadores de saúde, drill-down de aparelhos e botão atualizar)
- **Benefício**: O carregamento pesado do ledger de auditoria fica restrito a quem realmente deseja auditar entregas.

---

## 4. Integração no Core da Aplicação

### 4.1 Declaração em `src/App.tsx`

Substituir a linha única `<Route path="/notificacoes" element={<Notificacoes />} />` por:

```tsx
<Route path="/notificacoes" element={<Navigate to="/notificacoes/confirmacao" replace />} />
<Route path="/notificacoes/confirmacao" element={<NotificacoesConfirmacao />} />
<Route path="/notificacoes/votacao" element={<NotificacoesVotacao />} />
<Route path="/notificacoes/testes" element={<NotificacoesTestes />} />
<Route path="/notificacoes/saude" element={<NotificacoesSaude />} />
```

### 4.2 Code-Splitting e Prefetch em `src/lib/rotas.ts`

1. Definir os 4 loaders dinâmicos:
   ```ts
   const carregarNotificacoesConfirmacao = () => import('../routes/NotificacoesConfirmacao');
   const carregarNotificacoesVotacao = () => import('../routes/NotificacoesVotacao');
   const carregarNotificacoesTestes = () => import('../routes/NotificacoesTestes');
   const carregarNotificacoesSaude = () => import('../routes/NotificacoesSaude');
   ```
2. Exportar os componentes lazy:
   ```ts
   export const NotificacoesConfirmacao = lazy(() =>
     carregarNotificacoesConfirmacao().then((m) => ({ default: m.NotificacoesConfirmacao }))
   );
   export const NotificacoesVotacao = lazy(() =>
     carregarNotificacoesVotacao().then((m) => ({ default: m.NotificacoesVotacao }))
   );
   export const NotificacoesTestes = lazy(() =>
     carregarNotificacoesTestes().then((m) => ({ default: m.NotificacoesTestes }))
   );
   export const NotificacoesSaude = lazy(() =>
     carregarNotificacoesSaude().then((m) => ({ default: m.NotificacoesSaude }))
   );
   ```
3. Registrar na `TABELA_PRE_CARREGAMENTO`:
   ```ts
   { padrao: /^\/notificacoes\/confirmacao/, carregar: carregarNotificacoesConfirmacao },
   { padrao: /^\/notificacoes\/votacao/, carregar: carregarNotificacoesVotacao },
   { padrao: /^\/notificacoes\/testes/, carregar: carregarNotificacoesTestes },
   { padrao: /^\/notificacoes\/saude/, carregar: carregarNotificacoesSaude },
   ```

### 4.3 Skeletons Estruturais e Eliminação de CLS

1. **`src/components/Skeletons.tsx`**:
   - `SkeletonNotificacoes`: esqueleto contendo cabeçalho, `AbasNotificacoes` e card de formulário + botão salvar.
   - `SkeletonNotificacoesSaude`: esqueleto contendo cabeçalho, `AbasNotificacoes` e linhas da tabela de atletas.
2. **`src/routes/Layout.tsx`**:
   - Associar os padrões de rota aos skeletons corretos em `SKELETONS_POR_ROTA`:
     ```ts
     { padrao: /^\/notificacoes\/saude/, Skeleton: SkeletonNotificacoesSaude },
     { padrao: /^\/notificacoes/, Skeleton: SkeletonNotificacoes },
     ```

### 4.4 Limpeza de Código Órfão (Zero Code Slop)

- Remover o antigo arquivo monolítico `src/routes/Notificacoes.tsx`.

---

## 5. Tarefas de Implementação Passo a Passo

### Fase 1: Infraestrutura de Navegação e Skeletons

- [ ] **Task 1.1**: Criar `src/components/AbasNotificacoes.tsx` com `NavLink`, estilos e prefetch.
- [ ] **Task 1.2**: Atualizar `SkeletonNotificacoes` e criar `SkeletonNotificacoesSaude` em `src/components/Skeletons.tsx`.
- [ ] **Task 1.3**: Configurar mapa de skeletons em `src/routes/Layout.tsx`.

### Fase 2: Criação das Novas Rotas Especializadas

- [ ] **Task 2.1**: Criar `src/routes/NotificacoesConfirmacao.tsx`.
- [ ] **Task 2.2**: Criar `src/routes/NotificacoesVotacao.tsx`.
- [ ] **Task 2.3**: Criar `src/routes/NotificacoesTestes.tsx`.
- [ ] **Task 2.4**: Criar `src/routes/NotificacoesSaude.tsx`.

### Fase 3: Roteamento, Prefetch e Limpeza

- [ ] **Task 3.1**: Atualizar lazy loaders e tabela de prefetch em `src/lib/rotas.ts`.
- [ ] **Task 3.2**: Registrar as sub-rotas e o redirect em `src/App.tsx`.
- [ ] **Task 3.3**: Excluir o monolítico `src/routes/Notificacoes.tsx`.

---

## 6. Plano de Verificação

### 6.1 Compilação e Linter

- `npm run build` (`tsc -b && vite build`): verificar se todos os chunks são criados sem erros de tipagem.
- `npm run lint` (`tsc -b && eslint`): verificar se não há violações de regras ou imports órfãos.

### 6.2 Verificação Manual

1. **Navegação pelas Abas**:
   - Entrar em `/notificacoes` e checar se o redirecionamento automático envia para `/notificacoes/confirmacao`.
   - Clicar sucessivamente em cada aba da barra superior e checar se a URL e a tela mudam instantaneamente.
2. **Isolamento de Estado e Formulários**:
   - Na rota `/notificacoes/confirmacao`, alterar um valor e salvar. Conferir feedback toast.
   - Na rota `/notificacoes/votacao`, alterar um bucket e salvar. Conferir feedback toast.
   - Na rota `/notificacoes/testes`, clicar no push de teste e testar o modal de reenvio de convite.
   - Na rota `/notificacoes/saude`, verificar carregamento da lista de atletas e clique no botão de atualizar.
3. **Mobile e Gestos**:
   - Em emulador mobile (390px), deslizar horizontalmente entre as 4 telas via swipe gesture.
   - Conferir se a barra superior faz scroll suave sem barra nativa feia (`no-scrollbar`).
   - Conferir alvo de toque (mínimo 44px).
