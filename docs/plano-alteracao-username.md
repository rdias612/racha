# 📋 Plano de Implementação: Alteração de Nome de Usuário (@username) no Perfil

> **Documento de Especificação e Planejamento Técnico**  
> **Status:** Proposto / Para Análise  
> **Referência:** [`AGENTS.md`](../AGENTS.md) e [`design-system.md`](../design-system.md)

---

## 🎯 1. Visão Geral e Propósito

Permitir que cada atleta autenticado possa **alterar seu nome de usuário (`username`)** diretamente na aba de **Perfil** (`/perfil`), sem necessidade de intervenção manual de administradores no banco de dados.

### 🔍 Distinção Conceitual no Sistema:
No ecossistema do Racha Gragoatá CBO, o atleta possui duas formas de identificação com propósitos distintos:

1. **`username` (Login / `@handle`)**:
   - Identificador textual único utilizado para autenticação no combo de Login (`/login`) e menções (`@usuario`).
   - Não contém espaços; padronizado em minúsculas (`lowercase`).
2. **`nome` (Nome de Súmula / Camisa)**:
   - Nome social / apelido do atleta exibido na prancheta tática, na súmula oficial, no ranking de artilharia e nos boletins (ex: *"Dico"*, *"João Felipe"*, *"Victor Guimarães"*).
   - Já pode ser editado pelo próprio atleta na seção *"Alterar Nome na Súmula"*.

Com esta implementação, o atleta passa a ter **controle completo sobre seus dois identificadores** (seu nome de súmula e seu usuário de acesso), além de sua senha.

---

## 📐 2. Diretrizes Arquiteturais e Regras Seguidas

1. **Regra Zero UUID (AGENTS.md § 7.1)**: Todas as tabelas continuam referenciando atletas exclusivamente pela chave primária numérica imutável (`jogador_id bigint REFERENCES jogadores(id)`). Nenhuma tabela relacional utiliza `username` como chave estrangeira, garantindo integridade absoluta de histórico de jogos, gols, assistências, notas e dívidas.
2. **Migrations Sequenciais de 3 Dígitos (AGENTS.md § 7.2)**: Criação da migration `075_rpc_alterar_username.sql`.
3. **Atomicidade e Segurança em RPC PostgreSQL (AGENTS.md § 7.3 & § 7.4)**: Toda a validação, normalização e atualização ocorrerá dentro da função PL/pgSQL `alterar_username`, com modificador `SECURITY DEFINER`, `SET search_path = public` e `GRANT EXECUTE` explícito para `anon, authenticated`.
4. **Identidade Visual "Súmula de Quinta" (design-system.md)**:
   - Tipografia estrita: `font-display` nos títulos e botões (uppercase tracking-wider), `font-mono` no prefixo `@` e no campo de username, `font-sans` em alertas e instruções.
   - Cantos `rounded-[4px]`, bordas `border-borda`, superfícies `bg-superficie` e `bg-superficie-2`, sombras secas `shadow-carimbo`.
   - Cores semânticas exclusivas (`bg-fundo`, `bg-destaque`, `text-destaque-tinta`, `text-giz`, `text-giz-fraco`, `bg-perigo`, `bg-ok`).
5. **Mobile First & Feedback Tátil (AGENTS.md § 6.1 & § 6.4)**:
   - Alvos de toque `>= 44px`.
   - Feedback háptico defensivo (`vibrateSuccess` / `vibrateError`).
   - Feedback visual via `<MensagemEstado>` e `<Snackbar>`.
6. **Sincronização de Sessão e Resiliência (AGENTS.md § 5)**:
   - Atualização imediata do `localStorage` e do `SessaoContext`.
   - Ajuste na rotina de sincronização periódica de sessão para consultar pelo `id` (chave primária imutável) e não pelo `username`.

---

## 🛡️ 3. Regras de Negócio e Validações do `username`

Para preservar a governança, a segurança e a usabilidade do racha, a alteração de username obedecerá às seguintes regras estritas:

| Regra / Validação | Restrição | Justificativa Técnica / Regra de Negócio |
| :--- | :--- | :--- |
| **Normalização** | `LOWER(TRIM(novo_username))` | Evita contas duplicadas que divirjam apenas por maiúsculas/espaços. |
| **Comprimento** | Entre 2 e 30 caracteres | Garante compatibilidade com telas mobile e legibilidade. |
| **Formato / Caracteres** | `^[a-z0-9._-]+$` | Permite apenas letras minúsculas, números, pontos, sublinhados e hífens (sem espaços ou caracteres especiais). |
| **Unicidade** | `UNIQUE` no banco | Não permite que dois atletas ativos ou inativos possuam o mesmo username. |
| **Prefixos Reservados** | Proibido `random*` (`^random\d*$`) | O prefixo `random` é reservado exclusivamente para os 6 atletas convidados/placeholders temporários do sistema (`isRandomUsername`). |
| **Proteção de Superadmins** | Proibido assumir `dico`, `tadeu`, `natal` | Impede que qualquer atleta comum assuma o username reservado de governança dos superadmins. |
| **Imutabilidade de Superadmins** | Superadmins têm username fixo | Como o array de superadmins é auditado e validado em tempo de execução, superadmins não alteram seu username pela UI (deve ser feito via migration se necessário). |
| **Sem Alteração Fictícia** | `novo_username != username_atual` | Evita requisições redundantes se o usuário submeter o mesmo valor atual. |

---

## 🛠️ 4. Detalhamento das Alterações Propostas

### 4.1. Banco de Dados / Supabase

#### [NEW] `supabase/migrations/075_rpc_alterar_username.sql`

Criação da RPC `alterar_username`:

```sql
-- 075_rpc_alterar_username.sql
-- Permite que um jogador autenticado altere seu username de acesso/login.
-- Valida formato, tamanho, unicidade, prefixos reservados (random) e proteção de superadmins.

CREATE OR REPLACE FUNCTION alterar_username(
  p_jogador_id      bigint,
  p_novo_username   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jogador          jogadores%ROWTYPE;
  v_username_limpo   text;
BEGIN
  -- 1. Verifica existência e status do jogador
  SELECT * INTO v_jogador
  FROM jogadores
  WHERE id = p_jogador_id
  LIMIT 1;

  IF v_jogador.id IS NULL THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  IF NOT v_jogador.is_ativo THEN
    RAISE EXCEPTION 'Atleta inativo não pode alterar usuário de acesso.';
  END IF;

  -- 2. Normalização (trim + lowercase)
  v_username_limpo := LOWER(TRIM(p_novo_username));

  -- 3. Validação de obrigatoriedade e tamanho
  IF v_username_limpo IS NULL OR LENGTH(v_username_limpo) < 2 THEN
    RAISE EXCEPTION 'O usuário deve ter ao menos 2 caracteres.';
  END IF;

  IF LENGTH(v_username_limpo) > 30 THEN
    RAISE EXCEPTION 'O usuário deve ter no máximo 30 caracteres.';
  END IF;

  -- 4. Validação de formato (apenas letras, números, ponto, sublinhado e hífen)
  IF v_username_limpo !~ '^[a-z0-9._-]+$' THEN
    RAISE EXCEPTION 'O usuário só pode conter letras minúsculas, números, ponto, sublinhado e hífen (sem espaços).';
  END IF;

  -- 5. Validação de prefixo reservado (random)
  IF v_username_limpo ~ '^random\d*$' OR v_username_limpo ILIKE 'random%' THEN
    RAISE EXCEPTION 'O prefixo "random" é reservado para convidados temporários.';
  END IF;

  -- 6. Proteção de Superadmins (dico, tadeu, natal)
  IF v_username_limpo IN ('dico', 'tadeu', 'natal') AND v_jogador.username NOT IN ('dico', 'tadeu', 'natal') THEN
    RAISE EXCEPTION 'Este nome de usuário é reservado para a governança do racha.';
  END IF;

  IF v_jogador.username IN ('dico', 'tadeu', 'natal') THEN
    RAISE EXCEPTION 'Usuários Superadmin possuem identificador permanente por motivos de governança.';
  END IF;

  -- 7. Verifica se é igual ao atual
  IF v_username_limpo = v_jogador.username THEN
    RAISE EXCEPTION 'O novo usuário informado é igual ao atual.';
  END IF;

  -- 8. Validação de unicidade
  IF EXISTS (SELECT 1 FROM jogadores WHERE username = v_username_limpo AND id <> p_jogador_id) THEN
    RAISE EXCEPTION 'Este usuário "@%" já está sendo utilizado por outro atleta.', v_username_limpo;
  END IF;

  -- 9. Executa a alteração
  UPDATE jogadores
  SET username = v_username_limpo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION alterar_username(bigint, text) TO anon, authenticated;
```

---

### 4.2. Camada de Integração TypeScript (`src/lib/`)

#### [MODIFY] `src/lib/jogadores.ts`

1. Adicionar função de validação client-side:
   ```typescript
   export function validarFormatoUsername(username: string): string | null {
     const limpo = username.trim().toLowerCase();
     if (!limpo || limpo.length < 2) return 'O usuário deve ter ao menos 2 caracteres.';
     if (limpo.length > 30) return 'O usuário deve ter no máximo 30 caracteres.';
     if (!/^[a-z0-9._-]+$/.test(limpo)) {
       return 'Use apenas letras minúsculas, números, ponto, hífen ou sublinhado.';
     }
     if (isRandomUsername(limpo)) {
       return 'O prefixo "random" é reservado para convidados temporários.';
     }
     return null;
   }
   ```
2. Adicionar função de mutação via RPC:
   ```typescript
   export async function atualizarUsernameJogador(id: number, novoUsername: string): Promise<void> {
     const { data, error } = await supabase.rpc('alterar_username', {
       p_jogador_id: id,
       p_novo_username: novoUsername.trim().toLowerCase(),
     });

     if (error) throw error;
     if (data !== true) throw new Error('Não foi possível atualizar o usuário.');
   }
   ```

---

### 4.3. Gerenciamento de Sessão & Contexto (`src/context/`)

#### [MODIFY] `src/context/SessaoContext.tsx`

1. **Correção de robustez em `sincronizarJogador`**:
   - Atualmente busca por `.eq('username', jogador!.username)`. Se o username for alterado, a consulta deve usar a chave imutável: `.eq('id', jogador!.id)`.
   - Adicionar checagem de alteração de username no bloco de atualização:
     ```typescript
     if (
       jogadorAtualizado.id !== jogador!.id ||
       jogadorAtualizado.username !== jogador!.username || // <-- Nova detecção
       jogadorAtualizado.is_admin !== jogador!.is_admin ||
       jogadorAtualizado.is_mensalista !== jogador!.is_mensalista ||
       jogadorAtualizado.nome !== jogador!.nome ||
       jogadorAtualizado.posicao !== jogador!.posicao
     ) {
       localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadorAtualizado));
       setJogadorState(jogadorAtualizado);
     }
     ```

---

### 4.4. Interface do Usuário / Frontend (`src/routes/Perfil.tsx`)

#### [MODIFY] `src/routes/Perfil.tsx`

1. **Estado local do formulário de username**:
   ```typescript
   const [usernameNovo, setUsernameNovo] = useState('');
   const [salvandoUsername, setSalvandoUsername] = useState(false);
   const [erroUsername, setErroUsername] = useState<string | null>(null);
   const [okUsername, setOkUsername] = useState<string | null>(null);
   ```
2. **Handler `alterarUsername(e)`**:
   - Valida formato via `validarFormatoUsername`.
   - Dispara haptic de erro se inválido.
   - Chama `atualizarUsernameJogador(jogador.id, usernameNovo)`.
   - Atualiza `setJogador({ ...jogador, username: usernameFormatado })`.
   - Dispara `vibrateSuccess()` e exibe feedback: *"Usuário alterado com sucesso. Use @novo_usuario no próximo login."*.
3. **Novo Bloco Visual no Padrão "Súmula de Quinta"**:
   - Posicionado de forma coesa junto às configurações de conta.
   - Se o atleta for Superadmin (`isSuperAdmin(jogador.username)`), exibe card informativo/desabilitado explicando que o identificador é permanente para fins de governança.
   - Para os demais atletas, renderiza o formulário com o prefixo visual `@` estilizado em `font-mono text-giz-fraco`.

```tsx
{/* Alterar Usuário de Acesso */}
<section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
  <div>
    <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
      Alterar Usuário de Acesso (@username)
    </h3>
    <p className="text-[11px] font-sans text-giz-fraco mt-0.5">
      Identificador único utilizado para entrar no app e menções na súmula.
    </p>
  </div>

  {isSuperAdmin(jogador.username) ? (
    <div className="rounded-[4px] border border-borda/60 bg-superficie-2 p-2.5 text-xs font-mono text-giz-fraco">
      🛡️ Usuário Superadmin permanente. O identificador de acesso não pode ser alterado na interface.
    </div>
  ) : (
    <form onSubmit={alterarUsername} className="space-y-3">
      <div className="relative flex items-center">
        <span className="absolute left-3 text-sm font-mono font-bold text-giz-fraco select-none">
          @
        </span>
        <input
          type="text"
          placeholder={jogador.username}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          maxLength={30}
          value={usernameNovo}
          onChange={(e) => setUsernameNovo(e.target.value.toLowerCase().trim())}
          className="w-full rounded-[4px] border border-borda bg-superficie-2 pl-7 pr-3 py-2 text-sm font-mono text-giz shadow-xs focus:outline-none focus:border-destaque focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
          required
        />
      </div>
      {erroUsername && <MensagemEstado>{erroUsername}</MensagemEstado>}
      {okUsername && <MensagemEstado tipo="sucesso">{okUsername}</MensagemEstado>}
      <button
        type="submit"
        disabled={salvandoUsername}
        className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50"
      >
        {salvandoUsername ? 'Atualizando usuário…' : 'Salvar novo @usuário'}
      </button>
    </form>
  )}
</section>
```

---

## 🌐 5. Mapeamento de Impacto nos Demais Módulos

| Tela / Módulo | Como é Afetado | Ação Necessária |
| :--- | :--- | :--- |
| **Login (`Login.tsx`)** | A lista suspensa consome `listarUsernames()`, que consulta diretamente a coluna `username` da tabela `jogadores`. | Nenhuma alteração de código necessária; o novo username aparecerá automaticamente na lista do login. |
| **Ranking Anual (`Ranking.tsx`)** | O ranking consome a view `ranking` baseada em `pp.jogador_id = j.id`. | Nenhum impacto nos pontos ou dados; integridade 100% mantida. |
| **Partidas e Súmulas (`PartidaDetalhe.tsx`, `PartidaAoVivo.tsx`)** | Todas as súmulas e eventos utilizam `jogador_id`. | Nenhum impacto no histórico de gols ou participações. |
| **Votação Pós-Jogo (`PartidaVotar.tsx`)** | Utiliza `jogador.id` e `isRandomUsername(jogador.username)`. | Como a RPC impede renomear para `random*`, o fluxo de votação segue protegido. |
| **Gestão de Jogadores (`GestaoJogadores.tsx`)** | Exibe `@username` e permite busca textual por nome ou username. | A lista de atletas e o campo de busca refletirão o novo username atualizado. |
| **Módulo Financeiro (`Administrador.tsx`)** | A view `dividas_resumo` faz join por `j.id = d.jogador_id`. | O extrato financeiro e quitações continuam vinculados perfeitamente ao atleta. |

---

## 🧪 6. Plano de Verificação e Testes

### 6.1. Testes Automatizados e Build
- `npm run lint`: Validação sem erros no ESLint Flat Config e no TypeScript (`strict: true`).
- `npm run build`: Compilação de produção via Vite sem falhas.

### 6.2. Cenários de Teste Manual da RPC e Frontend

1. **Alteração Bem-Sucedida**:
   - Atleta altera de `@antigo` para `@novo_handle`.
   - Verificar feedback visual de sucesso e haptics.
   - Realizar logout e verificar se `@novo_handle` está disponível no combobox de Login e autentica com a senha existente.
2. **Tentativa de Duplicidade**:
   - Tentar alterar para o username de outro atleta já cadastrado.
   - Verificar se a mensagem amigável *"Este usuário @... já está sendo utilizado por outro atleta"* é exibida.
3. **Validação de Formato e Espaços**:
   - Tentar inserir espaços, caracteres especiais ou menos de 2 caracteres.
   - Verificar bloqueio na validação client-side e na RPC.
4. **Tentativa de Uso de Nomes Reservados**:
   - Tentar alterar para `random1` ou `random_teste` -> Deve ser rejeitado.
   - Tentar alterar para `dico`, `tadeu` ou `natal` (superadmins) -> Deve ser rejeitado.
5. **Tentativa por Superadmin**:
   - Logar com conta de superadmin e verificar se o formulário aparece devidamente bloqueado com aviso explicativo.
6. **Responsividade e Temas**:
   - Testar o formulário em viewport mobile (375px) e desktop nos temas Claro (`bg-fundo #f3efe4`) e Escuro (`bg-fundo #12100d`).
