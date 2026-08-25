# Plano de Implementação: Separação de Goleiros, Seleção na Divisão dos Times e Gestão Financeira com PIX

Este plano estabelece a arquitetura completa para isolar os goleiros da tabela `jogadores` em uma tabela própria `goleiros`, integrando a escolha dos 2 goleiros (Time Preto e Time Branco) diretamente na tela de divisão dos times, além de garantir o fluxo de votação pós-jogo e geração automática de despesas financeiras com chave PIX.

---

## 📌 Resumo dos Requisitos Alinhados

1. **Tabela Própria `goleiros`**:
   - Campos: `id`, `nome`, `telefone`, `chave_pix`, `is_ativo`, `created_at`.
   - Goleiros não possuem login/senha de atleta (são geridos pelos administradores).
   - Migração dos goleiros atuais de `jogadores` para `goleiros`.
2. **Confirmação e Divisão dos Times**:
   - A confirmação semanal continua estrita aos **14 jogadores de linha**.
   - Na tela de divisão dos times (`/partida/:id/times`), o administrador:
     - Distribui os 14 jogadores de linha (7 Preto e 7 Branco) com auxílio do botão de balanceamento automático.
     - Seleciona o **Goleiro do Time Preto** e o **Goleiro do Time Branco** através de dropdowns dedicados no topo de cada time.
     - Pode cadastrar um novo goleiro rapidamente via modal inline sem sair da tela.
3. **Partida ao Vivo e Súmula**:
   - Os 2 goleiros integram a súmula oficial da partida (`partidas_participantes` com `goleiro_id`), totalizando 8 atletas por time no jogo (7 de linha + 1 goleiro).
4. **Votação de Notas Pós-Jogo**:
   - Goleiros recebem notas na cédula de votação pós-jogo e concorrem ao Craque da Partida (mas não votam por não terem login).
5. **Módulo Financeiro e Pagamentos PIX**:
   - Ao finalizar/publicar a partida, o sistema gera automaticamente 2 despesas de **R$ 30,00** (uma para cada goleiro participante).
   - O painel financeiro em `/administrador` exibe a chave PIX do goleiro e oferece o botão "Copiar Chave PIX".
   - Nova tela de gerenciamento (`/gestao-goleiros` ou seção na administração) para cadastro e edição dos goleiros.

---

## 🛠️ Modificações Propostas

```
racha/
├── supabase/
│   ├── migrations/
│   │   └── 081_tabela_goleiros_e_escalacao.sql  # [NEW] Criação da tabela goleiros, migração de dados e RPCs
│   └── aplicar_tudo.sql                         # [MODIFY] Sincronização dos schemas e RPCs
├── src/
│   ├── lib/
│   │   ├── goleiros.ts                          # [NEW] Tipos e funções de consulta/mutação de goleiros
│   │   ├── partidas.ts                          # [MODIFY] Tipagem de Participante e suporte a goleiro_id
│   │   └── rotas.ts                             # [MODIFY] Registro lazy da rota de Gestão de Goleiros
│   ├── components/
│   │   ├── EscalacaoTimesEditor.tsx             # [MODIFY] Dropdowns de seleção de goleiros por time e modal inline
│   │   └── ModalNovoGoleiro.tsx                 # [NEW] Modal ágil para cadastrar novo goleiro
│   ├── routes/
│   │   ├── PartidaTimes.tsx                     # [MODIFY] Carregamento de goleiros ativos e persistência com goleiros
│   │   ├── GestaoGoleiros.tsx                   # [NEW] Tela administrativa de cadastro e edição de goleiros
│   │   ├── Administrador.tsx                    # [MODIFY] Botão de cópia de PIX e atalho para gestão de goleiros
│   │   ├── PartidaAoVivo.tsx                    # [MODIFY] Exibição dos goleiros na súmula ao vivo
│   │   ├── PartidaDetalhe.tsx                   # [MODIFY] Exibição dos goleiros nos cards de escalação
│   │   └── PartidaVotar.tsx                     # [MODIFY] Cédula com notas para os goleiros
│   └── App.tsx                                  # [MODIFY] Rota /gestao-goleiros protegida para admins
├── AGENTS.md                                    # [MODIFY] Documentação da arquitetura de goleiros
└── design-system.md                             # [MODIFY] Tokens e componentes da gestão de goleiros
```

---

## 🗄️ Detalhamento das Alterações

### 1. Banco de Dados e RPCs (PostgreSQL)

#### `[NEW] supabase/migrations/081_tabela_goleiros_e_escalacao.sql`
- **Tabela `goleiros`**:
  ```sql
  CREATE TABLE goleiros (
    id          bigserial PRIMARY KEY,
    nome        text NOT NULL,
    telefone    text,
    chave_pix   text,
    is_ativo    boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  ```
- **Migração de Dados**:
  ```sql
  INSERT INTO goleiros (nome, is_ativo)
  SELECT username, is_ativo FROM jogadores WHERE posicao = 'goleiro'
  ON CONFLICT DO NOTHING;
  ```
- **Adaptação de `partidas_participantes`**:
  - Adiciona `goleiro_id bigint REFERENCES goleiros(id) ON DELETE RESTRICT`.
  - Altera `jogador_id` para `DROP NOT NULL`.
  - Adiciona constraint:
    ```sql
    CHECK (
      (jogador_id IS NOT NULL AND goleiro_id IS NULL) OR
      (jogador_id IS NULL AND goleiro_id IS NOT NULL)
    )
    ```
- **Adaptação de `votes`**:
  - Permite avaliar tanto `target_id` (jogador de linha) quanto `target_goleiro_id` (goleiro).
- **RPC `salvar_times_partida_com_goleiros`**:
  - Salva em uma única transação atômica os 14 jogadores de linha e os 2 goleiros (um para o time `a` e um para o time `b`).
- **RPC `abrir_partida`**:
  - Valida se o time `a` tem 7 de linha + 1 goleiro (8 total) e se o time `b` tem 7 de linha + 1 goleiro (8 total).

---

### 2. Frontend Core & API

#### `[NEW] src/lib/goleiros.ts`
- Interfaces TypeScript:
  ```ts
  export interface Goleiro {
    id: number;
    nome: string;
    telefone: string | null;
    chave_pix: string | null;
    is_ativo: boolean;
    created_at: string;
  }
  ```
- Funções CRUD:
  - `listarGoleirosAtivos()`
  - `listarTodosGoleiros()`
  - `criarGoleiro({ nome, telefone, chave_pix })`
  - `atualizarGoleiro(id, { nome, telefone, chave_pix, is_ativo })`

---

### 3. Interface e Experiência do Usuário

#### `[MODIFY] src/components/EscalacaoTimesEditor.tsx` & `[MODIFY] src/routes/PartidaTimes.tsx`
- No topo do Time Preto (`a`): Dropdown `🧤 Goleiro Time Preto` (com lista de goleiros ativos + opção `+ Cadastrar Novo Goleiro`).
- No topo do Time Branco (`b`): Dropdown `🧤 Goleiro Time Branco` (com lista de goleiros ativos + opção `+ Cadastrar Novo Goleiro`).
- Modal inline rápido `ModalNovoGoleiro.tsx` para adicionar um goleiro e já selecioná-lo automaticamente no dropdown.
- Botão "Salvar Times" habilitado quando:
  - 7 jogadores de linha no Time Preto
  - 7 jogadores de linha no Time Branco
  - 1 goleiro selecionado no Time Preto
  - 1 goleiro selecionado no Time Branco (goleiros distintos)

#### `[NEW] src/routes/GestaoGoleiros.tsx`
- Lista de goleiros com cards compactos no padrão *Súmula de Quinta*.
- Ações: cadastrar, editar telefone/chave PIX, ativar/desativar status.
- Acesso fácil via botão na aba de Administração (`/administrador`).

#### `[MODIFY] src/routes/Administrador.tsx`
- No extrato financeiro das despesas de goleiros (R$ 30,00):
  - Exibe o nome do goleiro e botão com ícone de cópia rápida da chave PIX (`navigator.clipboard.writeText`).
  - Toast/Snackbar de confirmação: "Chave PIX copiada!".

---

## 🧪 Plano de Verificação

### 1. Testes Automatizados e Compilação
- Execução de checagem de tipos estrita: `npx tsc -b`
- Build de produção do Vite: `npx vite build`
- Formatação e linting: `npx prettier --check .`

### 2. Testes Manuais de Fluxo
- **Fluxo de Escalação**:
  1. Acessar `/partida/:id/times` de uma partida com 14 confirmados.
  2. Verificar os seletores de goleiro no Time Preto e Branco.
  3. Clicar em "+ Novo Goleiro", cadastrar com chave PIX e verificar se ele é selecionado.
  4. Balancear os 14 jogadores de linha e salvar os times.
- **Fluxo de Jogo ao Vivo e Votação**:
  1. Iniciar a partida ao vivo e verificar os 2 goleiros escalados com a luva 🧤.
  2. Finalizar a partida e acessar a cédula de votação (`/partida/:id/votar`), checando se os 2 goleiros aparecem para receber notas.
- **Fluxo Financeiro**:
  1. Acessar `/administrador` e verificar o lançamento automático dos R$ 30,00 de cada goleiro.
  2. Clicar no botão de copiar a chave PIX e conferir o feedback.
