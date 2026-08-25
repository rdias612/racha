# Plano de Implementação: Gestão de Goleiros, Seleção na Divisão dos Times e Pagamento PIX

Este plano consolida a arquitetura unificada para os goleiros do racha, utilizando a entidade `jogadores` com campos adicionais (`chave_pix`, `telefone`), suporte a atletas híbridos (que podem jogar no gol ou na linha), seleção dos 2 goleiros diretamente na tela de divisão dos times, regra de votação baseada na posição atuada e geração de despesa de R$ 30 com cópia de chave PIX.

---

## 📌 Resumo das Regras de Negócio e Decisões

1. **Estrutura de Dados Unificada (`jogadores`)**:
   - Novos campos em `jogadores`: `chave_pix text`, `telefone text`.
   - Sem duplicação de tabelas ou quebra de chaves estrangeiras: todos os atletas (linha, goleiros da casa e goleiros convidados) são mantidos em `jogadores`.
2. **Confirmação Semanal vs. Seleção dos Goleiros**:
   - **Jogadores de Linha**: Seguem a confirmação semanal padrão estrita a **14 vagas** (`PartidaDetalhe.tsx`). Se um goleiro da casa (ex: *Dudu* ou *Pedrinho*) for jogar na **linha**, ele confirma presença normalmente como qualquer jogador de linha.
   - **Goleiros da Partida**: Na tela de divisão dos times (`/partida/:id/times`), o administrador escolhe os **2 goleiros da partida** através de dropdowns dedicados no topo do Time Preto e do Time Branco (com opção de "+ Cadastrar Novo Goleiro" rápido via modal inline).
3. **Comportamento Dinâmico Baseado na Posição Atuada na Partida**:
   - **Quem jogou no GOL (`posicao = 'goleiro'`)**:
     - **Votação**: **Não vota** na cédula pós-jogo (mesmo que tenha login de atleta).
     - **Notas**: **Recebe notas** normalmente dos 14 jogadores de linha e concorre ao Craque da Partida.
     - **Financeiro**: Recebe automaticamente o crédito de **R$ 30,00** de diária de goleiro (despesa do racha) e fica **isento** da taxa de avulso.
   - **Quem jogou na LINHA (`posicao <> 'goleiro'`)**:
     - **Votação**: Vota normalmente na cédula pós-jogo.
     - **Notas**: Recebe notas normalmente.
     - **Financeiro**: Paga taxa de avulso de R$ 20,00 (se não for mensalista) e não recebe os R$ 30.
4. **Módulo Financeiro e Chave PIX**:
   - Ao finalizar/publicar a partida, são geradas 2 despesas de **R$ 30,00** (uma para cada goleiro escalado).
   - No painel financeiro (`/administrador`), cada pagamento de goleiro exibe a Chave PIX e o botão **"Copiar Chave PIX"**.
   - No `/perfil`, o próprio atleta pode cadastrar e atualizar sua Chave PIX e Telefone.
   - Tela/seção administrativa de **Gestão de Goleiros** para listar, cadastrar e editar rapidamente os goleiros da casa e convidados.

---

## 🛠️ Arquivos Modificados e Criados

```
racha/
├── supabase/
│   ├── migrations/
│   │   └── 081_goleiros_pix_e_escalacao.sql    # [NEW] Colunas chave_pix/telefone, RPCs de escalação e financeiro
│   └── aplicar_tudo.sql                         # [MODIFY] Sincronização de colunas e RPCs
├── src/
│   ├── lib/
│   │   ├── jogadores.ts                         # [MODIFY] Campos chave_pix/telefone e helpers de goleiro
│   │   ├── partidas.ts                          # [MODIFY] Tipagem e validações de escalação com goleiros
│   │   └── rotas.ts                             # [MODIFY] Registro de rotas lazy
│   ├── components/
│   │   ├── EscalacaoTimesEditor.tsx             # [MODIFY] Seletores de Goleiro Preto/Branco e modal rápido
│   │   └── ModalNovoGoleiro.tsx                 # [NEW] Modal ágil para cadastro rápido de novo goleiro
│   ├── routes/
│   │   ├── PartidaTimes.tsx                     # [MODIFY] Fluxo completo de divisão 7x7 + 2 goleiros
│   │   ├── GestaoGoleiros.tsx                   # [NEW] Tela administrativa de gestão de goleiros (PIX, tel, status)
│   │   ├── GestaoJogadores.tsx                  # [MODIFY] Exibição de PIX/telefone na listagem geral
│   │   ├── Perfil.tsx                           # [MODIFY] Edição própria de Chave PIX e Telefone
│   │   ├── Administrador.tsx                    # [MODIFY] Botão de cópia rápida de PIX nas despesas de goleiro
│   │   ├── PartidaAoVivo.tsx                    # [MODIFY] Visualização dos 2 goleiros na súmula
│   │   ├── PartidaDetalhe.tsx                   # [MODIFY] Exibição clara dos goleiros nos cards de time
│   │   └── PartidaVotar.tsx                     # [MODIFY] Bloqueio de voto para quem jogou no gol e cédula completa
│   └── App.tsx                                  # [MODIFY] Rota /gestao-goleiros
├── AGENTS.md                                    # [MODIFY] Atualização canônica das regras de goleiros e PIX
└── design-system.md                             # [MODIFY] Padrões visuais dos seletores de goleiro e PIX
```

---

## 🗄️ Detalhamento da Implementação

### 1. Banco de Dados e RPCs (PostgreSQL)

#### `[NEW] supabase/migrations/081_goleiros_pix_e_escalacao.sql`
- **Novas colunas em `jogadores`**:
  ```sql
  ALTER TABLE jogadores
    ADD COLUMN IF NOT EXISTS chave_pix text,
    ADD COLUMN IF NOT EXISTS telefone text;
  ```
- **RPC `salvar_times_e_goleiros_partida`**:
  - Salva atomicamente os 14 jogadores de linha nos times `a` (7) e `b` (7), e adiciona/atualiza os 2 goleiros selecionados (`p_goleiro_a_id`, `p_goleiro_b_id`) em `partidas_participantes` com `posicao = 'goleiro'` e `status_confirmacao = 'confirmado'`.
- **RPC `abrir_partida`**:
  - Valida se o Time Preto tem 7 de linha + 1 goleiro (8 total) e o Time Branco tem 7 de linha + 1 goleiro (8 total).
- **RPC `gerar_eventos_fim_partida` / `publicar_partida`**:
  - Identifica os participantes que jogaram com `posicao = 'goleiro'`.
  - Insere as 2 despesas de R$ 30,00 (`tipo = 'goleiro'`, `natureza = 'despesa'`, `descricao = 'Diária Goleiro @username'`) associadas ao `jogador_id` correspondente.

---

### 2. Frontend: Divisão de Times e Seleção dos Goleiros

#### `src/components/EscalacaoTimesEditor.tsx` & `src/routes/PartidaTimes.tsx`
- **Interface de Escalação**:
  - Topo do Time Preto (`a`): Seletor `🧤 Goleiro Time Preto` (lista goleiros com prioridade para quem tem posição `goleiro`, além de busca geral).
  - Topo do Time Branco (`b`): Seletor `🧤 Goleiro Time Branco` (lista goleiros).
  - Botão "+ Novo Goleiro" que abre o modal inline `ModalNovoGoleiro.tsx`.
- **Validação de Salvamento (`podeSalvar`)**:
  - Time Preto: exatamente 7 jogadores de linha + 1 goleiro selecionado.
  - Time Branco: exatamente 7 jogadores de linha + 1 goleiro selecionado.
  - Goleiros do Time Preto e Branco devem ser diferentes.

---

### 3. Frontend: Votação Pós-Jogo e Perfil

#### `src/routes/PartidaVotar.tsx`
- Verifica se o jogador logado participou daquela partida com `posicao === 'goleiro'`:
  - Se jogou no gol: exibe aviso `MensagemEstado` funcional ("Goleiros da partida não participam da votação") e impede o envio de votos.
  - Se jogou na linha: cédula normal de votação, podendo avaliar todos os participantes (incluindo os 2 goleiros que jogaram).

#### `src/routes/Perfil.tsx`
- Adiciona seção "Dados de Pagamento / PIX":
  - Campo "Chave PIX" (CPF, e-mail, telefone ou chave aleatória).
  - Campo "Telefone / WhatsApp".
  - Salva diretamente no registro do atleta em `jogadores`.

---

### 4. Frontend: Módulo Financeiro e Gestão de Goleiros

#### `src/routes/Administrador.tsx`
- Nas linhas de despesa de goleiros (R$ 30,00):
  - Exibe a Chave PIX do atleta (ou badge "PIX não informado").
  - Botão de ação rápida com ícone de cópia para copiar a chave PIX direto para a área de transferência com feedback tátil e visual (`Snackbar`).

#### `src/routes/GestaoGoleiros.tsx`
- Painel para listar todos os goleiros cadastrados, editar telefone/PIX, ativar/desativar status e cadastrar novos goleiros.

---

## 🧪 Plano de Verificação

### 1. Validação de Build e Tipos
- `npx tsc -b`: Checagem estrita de tipos TypeScript sem erros.
- `npx vite build`: Build de produção.
- `npx prettier --write .`: Formatação consistente.

### 2. Testes de Casos de Uso
1. **Dudu/Pedrinho no GOL**:
   - Escalar Dudu no Time Preto e Pedrinho no Time Branco.
   - Finalizar partida: verificar se foram geradas 2 despesas de R$ 30 com as chaves PIX de Dudu e Pedrinho.
   - Logar com Dudu: verificar que ele é impedido de votar em `/partida/:id/votar` (jogou no gol).
2. **Dudu/Pedrinho na LINHA**:
   - Confirmar Dudu entre os 14 de linha e escalá-lo na linha (ex: `meia`).
   - Escalar outros 2 goleiros.
   - Finalizar partida: verificar que Dudu vota normalmente e não recebe crédito de R$ 30.
3. **Cópia de PIX no Financeiro**:
   - Acessar `/administrador` e testar o clique no botão de copiar a chave PIX do goleiro.
