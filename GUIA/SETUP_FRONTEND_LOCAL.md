# 💻 Guia: Subir o Frontend Localmente Conectado ao Supabase Real

Este guia detalha o processo completo para rodar a aplicação frontend do **Racha Gragoatá CBO** no seu ambiente local (Vite + React 19) conectado diretamente à instância de produção/real do **Supabase**.

---

## 📋 1. Pré-Requisitos

Antes de iniciar, certifique-se de ter instalado:

- **Node.js**: Versão 18+ (recomendado Node.js 20 LTS ou superior)
- **npm**: Versão 9+ ou superior (já incluso no Node.js)
- **Git**: Para controle de versão e checkout do repositório

---

## ⚙️ 2. Passo a Passo de Instalação e Configuração

### Passo 1: Instalar Dependências do Projeto

Abra o terminal na raiz do projeto (`racha/`) e execute:

```bash
npm install
```

---

### Passo 2: Criar e Configurar o Arquivo `.env`

O frontend precisa de variáveis de ambiente com o prefixo `VITE_` para instanciar o cliente Supabase e os serviços de Web Push.

1. Na raiz do projeto, crie um arquivo chamado `.env` (duplicando o `.env.example`):

   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env

   # Linux / macOS / Git Bash
   cp .env.example .env
   ```

2. Abra o arquivo `.env` e preencha as variáveis de acordo com a sua instância do Supabase:

```env
# URL da instância do Supabase
VITE_SUPABASE_URL=https://jtavmrlllyctkuxefhpc.supabase.co

# Chave pública anônima (anon key)
VITE_SUPABASE_ANON_KEY=sua_chave_anon_key_aqui

# Chave pública VAPID para Web Push Notifications (opcional para testes locais)
VITE_VAPID_PUBLIC_KEY=sua_chave_publica_vapid_aqui
```

#### 🔑 Onde encontrar essas credenciais no painel do Supabase?

1. Acesse o console web do Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Selecione o projeto **racha** (referência: `jtavmrlllyctkuxefhpc`).
3. Vá em **Project Settings (ícone de engrenagem)** no menu lateral esquerdo.
4. Clique na aba **API**.
5. Em **Project URL**, copie a URL (`https://jtavmrlllyctkuxefhpc.supabase.co`).
6. Em **Project API keys**, copie a chave pública marcada como **`anon` `public`**.

> [!IMPORTANT]
> Nunca compartilhe ou coloque no arquivo `.env` a chave `service_role` (chave secreta com privilégios de root). No frontend, utiliza-se **exclusivamente a chave `anon`**.

---

### Passo 3: Iniciar o Servidor de Desenvolvimento

Após salvar o arquivo `.env`, inicie o servidor Vite:

```bash
npm run dev
```

O terminal exibirá a URL local:

```text
  VITE v8.2.1  ready in 280 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

Abra o navegador e acesse **`http://localhost:5173`**.

---

## ⚽ 3. Como Testar o Sistema Localmente

### 3.1 Autenticação e Perfis de Teste

O sistema utiliza login customizado por username e senha validados no Supabase via RPC `fazer_login`.

- **Superadministradores Pré-configurados**:
  - Usuários: `dico`, `tadeu`, `natal`
  - Possuem privilégios administrativos completos e acesso permanente às telas de gestão:
    - `/administrador`: Gestão de dívidas, mensalidades e quitação financeira.
    - `/gestao-jogadores`: Ativação/desativação de atletas e status de mensalista.
    - `/partida/nova`: Criação manual de novas partidas.
    - `/partida/:id/editar`: Edição de súmula e presença.
- **Jogadores Mensalistas e Avulsos**:
  - Qualquer jogador ativo cadastrado na tabela `jogadores`.

---

## 🧪 4. Comandos de Validação e Qualidade

Antes de enviar qualquer alteração, certifique-se de que o código segue os padrões do repositório:

```bash
# 1. Executar checagem de tipos (TypeScript) e Linter (ESLint flat config)
npm run lint

# 2. Formatar todos os arquivos conforme o Prettier
npm run format

# 3. Validar se o build de produção passa sem erros
npm run build

# 4. Pré-visualizar o build localmente em modo produção
npm run preview
```

---

## 🛠️ 5. Resolução de Problemas Comuns (Troubleshooting)

### 1. Erro: _"Variáveis de ambiente faltando. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY..."_

- **Causa**: O arquivo `.env` não existe na raiz do projeto ou uma das variáveis está vazia.
- **Solução**: Crie o arquivo `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` preenchidos e **reinicie o comando `npm run dev`** (o Vite precisa ser reiniciado para carregar novas variáveis de ambiente).

### 2. Erro: _"Sem conexão com o servidor. Verifique sua internet e tente novamente."_

- **Causa**: URL do Supabase incorreta, chave `anon` inválida ou bloqueio de rede.
- **Solução**: Verifique se a URL no `.env` está sem barras adicionais no final (`https://jtavmrlllyctkuxefhpc.supabase.co`) e confirme se a chave `anon` é a mesma do dashboard.

### 3. Porta 5173 já está em uso

- **Solução**: O Vite selecionará automaticamente a próxima porta livre (ex: `5174`). Se desejar forçar uma porta específica:
  ```bash
  npm run dev -- --port 3000
  ```

### 4. Cache do PWA / Service Worker desatualizado

- **Solução**: Abra as Ferramentas de Desenvolvedor do navegador (F12) > Aba **Application** (ou **Aplicativo**) > **Service Workers** > Clique em **Unregister** e recarregue a página com `Ctrl + Shift + R` (ou `Cmd + Shift + R`).
