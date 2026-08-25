# Plano de Implementação: Histórico de Confronto entre Times (Elencos Exatos)

Implementação do recurso de **Histórico de Confronto de Elencos / Raio-X da Partida**, permitindo consultar e exibir automaticamente o retrospecto histórico sempre que dois times forem definidos no racha. O sistema verifica se os **exatos mesmos jogadores** já se enfrentaram no passado (mesmo com camisas Preto/Branco invertidas), contabilizando total de confrontos, vitórias de cada time, empates, média e total de gols, lista de partidas anteriores e métricas comparativas de força do elenco quando o duelo for inédito.

---

## 📐 Diretrizes e Regras Seguidas (AGENTS.md & design-system.md)

1. **Regra Zero UUID (7.1)**: Identificadores numéricos `bigint`/`bigserial`.
2. **Migrations Sequenciais de 3 Dígitos (7.2)**: `074_rpc_historico_confronto_times.sql`.
3. **Agregação 100% no PostgreSQL (7.3 & 7.5)**: Agregação relacional complexa via RPC `STABLE`, `SECURITY DEFINER`, `SET search_path = public` e `GRANT EXECUTE` explícito.
4. **Identidade Visual "Súmula de Quinta" (design-system.md)**:
   - Tipografia estrita: `font-display` (Barlow Condensed) nos cabeçalhos/crachás, `font-mono` (Chivo Mono) nos placares/médias/datas com `tabular-nums`, `font-sans` (Archivo) no corpo de texto.
   - Geometria e superfícies: `rounded-[4px]`, `border border-borda`, `bg-superficie`, `shadow-carimbo`.
   - Cores semânticas exclusivas: `bg-fundo`, `bg-superficie`, `border-borda`, `text-giz`, `text-giz-fraco`, `text-destaque`, `bg-ok`, `bg-perigo`, `bg-preto-time`, `bg-branco-time`.
5. **Mobile First e Acessibilidade (6.1 & 6.2)**: Touch targets >= 44px, safe area insets e feedback tátil defensivo (`haptics`).

---

## 🛠️ Detalhamento das Alterações Propostas

### 1. Banco de Dados / Supabase

#### [NEW] [074_rpc_historico_confronto_times.sql](file:///c:/Users/PC/Documents/GitHub/racha/supabase/migrations/074_rpc_historico_confronto_times.sql)

Criação de duas funções no PostgreSQL:

1. `historico_confronto_times(p_time_a bigint[], p_time_b bigint[], p_partida_id_ignorar bigint DEFAULT NULL)`
   - **Objetivo**: Retorna o resumo consolidado do histórico entre os dois elencos.
   - **Lógica**:
     - Ordena os arrays de entrada para comparação canônica: `v_elenco_a` e `v_elenco_b`.
     - Analisa todas as partidas históricas com status `'published'` ou `'closed'` (excluindo `p_partida_id_ignorar`).
     - Detecta partidas com os **exatos mesmos elencos**:
       - _Mesma camisa_: `elenco_preto = v_elenco_a` e `elenco_branco = v_elenco_b` (Elenco A jogou de Preto e Elenco B de Branco).
       - _Camisa invertida_: `elenco_preto = v_elenco_b` e `elenco_branco = v_elenco_a` (Elenco A jogou de Branco e Elenco B de Preto).
     - Contabiliza:
       - `jogos_exatos`: quantidade de vezes que esses dois elencos exatos se enfrentaram.
       - `vitorias_a`: vitórias do Elenco A (Time Preto no jogo atual).
       - `vitorias_b`: vitórias do Elenco B (Time Branco no jogo atual).
       - `empates`: número de empates.
       - `gols_a`: total de gols marcados pelo Elenco A.
       - `gols_b`: total de gols marcados pelo Elenco B.
       - `media_gols_a`: média de gols por jogo do Elenco A (`gols_a / jogos_exatos`).
       - `media_gols_b`: média de gols por jogo do Elenco B (`gols_b / jogos_exatos`).
       - `jogos_mesmo_pelotao`: quantas vezes os 16 atletas jogaram juntos na mesma quinta-feira (mesmo que com divisão diferente).
       - `media_nota_a`: média das notas históricas dos atletas do Elenco A (via `partida_notas`).
       - `media_nota_b`: média das notas históricas dos atletas do Elenco B (via `partida_notas`).

2. `historico_confronto_times_partidas(p_time_a bigint[], p_time_b bigint[], p_limite integer DEFAULT 10, p_partida_id_ignorar bigint DEFAULT NULL)`
   - **Objetivo**: Retorna a lista detalhada das partidas anteriores com os elencos exatos (mais recentes primeiro).
   - **Retorno**: `partida_id`, `data_jogo`, `gols_time_a` (gols do Elenco A), `gols_time_b` (gols do Elenco B), `vencedor` (`'a'` | `'b'` | `'empate'`), `camisa_time_a` (`'a'` para Preto ou `'b'` para Branco).

---

### 2. Camada de Integração TypeScript

#### [MODIFY] [partidas.ts](file:///c:/Users/PC/Documents/GitHub/racha/src/lib/partidas.ts)

- Declaração das interfaces:
  - `ResumoConfrontoTimes`: interface dos números agregados.
  - `PartidaHistoricoConfronto`: interface de cada partida anterior listada.
  - `HistoricoConfrontoTimesCompleto`: união de `resumo` + `partidas`.
- Função `carregarHistoricoConfrontoTimes(timeA: number[], timeB: number[], partidaIdIgnorar?: number)`:
  - Executa as duas RPCs em paralelo (`Promise.all`).
  - Tratamento defensivo de dados, números e strings.

---

### 3. Componente de Interface Visual

#### [NEW] [HistoricoConfrontoTimes.tsx](file:///c:/Users/PC/Documents/GitHub/racha/src/components/HistoricoConfrontoTimes.tsx)

Componente dedicado no padrão "Súmula de Quinta":

- **Estado de Carregamento**: Skeleton sutil e limpo.
- **Caso 1: Confronto com Histórico (`jogos_exatos > 0`)**:
  - Cabeçalho com placa "RAIO-X DO CONFRONTO" e contagem (`N confrontos anteriores`).
  - Placar de retrospecto: `[Vitorias Preto]V · [Empates]E · [Vitorias Branco]V`.
  - Estatísticas de ataque: Total de gols e médias (`X.X gols/jogo`).
  - Barra visual de dominância de vitórias e gols.
  - Lista das partidas anteriores com datas, placar com destaque ao vencedor e crachá da camisa utilizada.
- **Caso 2: Confronto Inédito (`jogos_exatos === 0`)**:
  - Crachá-carimbo: `CONFRONTO INÉDITO`.
  - Texto contextual: "Estes dois elencos com os exatos 8 contra 8 nunca se enfrentaram na história do racha."
  - Comparativo de Força dos Elencos:
    - Médias das notas dos atletas (`7.4★ Time Preto × 7.1★ Time Branco`).
    - Destaque se os 16 atletas já dividiram o mesmo racha com outra formação (`X partidas no mesmo pelotão`).

---

### 4. Integração nas Telas

#### [MODIFY] [PartidaDetalhe.tsx](file:///c:/Users/PC/Documents/GitHub/racha/src/routes/PartidaDetalhe.tsx)

- Exibe o `HistoricoConfrontoTimes` automaticamente quando a partida possui os dois times escalados (em `draft` com 8x8 ou `live`/`published`/`closed`).

#### [MODIFY] [EscalacaoTimesEditor.tsx](file:///c:/Users/PC/Documents/GitHub/racha/src/components/EscalacaoTimesEditor.tsx)

- No momento em que a escalação atinge 8 no Preto e 8 no Branco (manual ou após o "Auto-escalar"), renderiza em tempo real o card de Raio-X do Confronto antes de salvar, permitindo ao organizador conferir a rivalidade histórica antes de confirmar a escalação.

#### [MODIFY] [PartidaAoVivo.tsx](file:///c:/Users/PC/Documents/GitHub/racha/src/routes/PartidaAoVivo.tsx)

- Exibe o histórico do confronto dos elencos para consulta rápida durante o jogo ao vivo.

---

## 🧪 Plano de Verificação

### 1. Testes Automatizados e Integridade de Tipagem

- `npm run lint`: Validação estrita do ESLint e verificação de tipos (`tsc -b`).
- `npm run build`: Validação do bundle e build do Vite.

### 2. Validação da Migration SQL

- Testar a execução e funcionamento das RPCs `historico_confronto_times` e `historico_confronto_times_partidas` com diferentes combinações de elencos (tanto elencos que já jogaram quanto elencos inéditos).

### 3. Validação Visual e de Interação

- Navegação para `/partida/:id` com times definidos: verificar renderização correta do painel de histórico.
- Tela de escalação `/partida/:id/times` e `/partida/nova/times`: selecionar 8 no Time Preto e 8 no Time Branco e verificar atualização em tempo real do histórico.
- Verificar tema escuro/claro e visualização em viewport mobile (375px) e desktop.
