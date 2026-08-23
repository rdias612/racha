# ⚽ Racha Gragoatá CBO

Plataforma progressiva (PWA) para gerenciamento completo e engajamento da pelada semanal.

---

## 🚀 Principais Recursos

- **Confirmação de Presença**: Gestão de vagas de titulares e fila de espera.
- **Sorteio de Times**: Balanceamento automático por posições e histórico de notas.
- **Súmula em Tempo Real**: Acompanhamento e registro ao vivo de gols, assistências e placar.
- **Votação Pós-Jogo**: Avaliação dos atletas com média aparada e eleição do Craque da Rodada.
- **Controle Financeiro**: Gestão de mensalidades, avulsos e quitação de débitos.
- **Ranking & Estatísticas**: Classificação da temporada, artilharia, assistências e histórico.

---

## 🛠️ Tecnologias

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [React Router](https://reactrouter.com/)
- **Backend / Banco**: [Supabase](https://supabase.com/) (PostgreSQL & RPCs)
- **Ícones**: [Lucide React](https://lucide.dev/)

---

## 📦 Como Rodar Localmente

### 1. Clonar e instalar dependências

```bash
git clone <url-do-repositorio>
cd racha
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz com base no `.env.example`:

```env
VITE_SUPABASE_URL=https://sua-instancia.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
VITE_VAPID_PUBLIC_KEY=sua-chave-vapid-opcional
```

### 3. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:5173](http://localhost:5173) no seu navegador.

---

## 📚 Documentação e Guias

- **[`GUIA/`](./GUIA/)**: Manuais passo a passo de configuração de ambiente, execução local e migrações do Supabase.
- **[`docs/`](./docs/)**: Planos técnicos, especificações de novas funcionalidades e documentação de evolução.
- **[`AGENTS.md`](./AGENTS.md)**: Diretrizes canônicas de arquitetura, regras de negócio, banco de dados e padrões de desenvolvimento.
- **[`design-system.md`](./design-system.md)**: Guia completo de UI/UX, tokens visuais e componentes ("Súmula de Quinta").

---

## 📜 Scripts Disponíveis

- `npm run dev` — Inicia o servidor local de desenvolvimento (Vite)
- `npm run build` — Valida a tipagem TypeScript e gera a build de produção
- `npm run preview` — Pré-visualiza localmente a build de produção
- `npm run lint` — Executa a verificação de tipos e regras do ESLint
- `npm run format` — Formata os arquivos do projeto com Prettier
