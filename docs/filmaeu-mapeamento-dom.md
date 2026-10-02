# Mapeamento DOM do Filma Eu — Clipes (preenchido pelo dono, uma vez)

> Consumidor: `scripts/clipes/filmaeu/seletores.mjs` (RNF04 — única fonte de seletores).
> Preencher com valores REAIS do site. Nada de credenciais neste arquivo.

## 1. Rotas e fluxo
- URL de login: ______ (sabe-se que é atrás de /login — requisito §1)
- Após o login, para chegar na grade de clipes: ______ passos (busca da quadra
  "Society Gragoatá" → seleção de data → slot 19:00). Descrever cada tela
  (URL e o que muda) e anexar screenshot.
- A URL da grade do slot carrega a data/horário na querystring? ______
  (se sim, navegação direta pode substituir cliques — mais resiliente)

## 2. Seletores (para cada passo, o seletor mais estável: id > data-* > name > classe > texto)
- Campo de usuário / senha / botão entrar: ______
- Campo de busca da quadra + como selecionar "Society Gragoatá": ______
- Controle de data (input? calendário?): ______
- Item do slot 19:00 (link? card?): ______
- Card de cada clipe na grade (título, ordem de exibição): ______
- Botão "Baixar" de cada clipe: ______

## 3. Comportamento do download (crítico)
- Clicar em "Baixar" dispara download direto, abre nova aba ou navega para
  URL do S3 (`filmaeustorage...`)? ______ (colar a URL de exemplo, sem token se houver)
- O arquivo baixado mantém nome estável entre acessos (ex.: `clipe-1234.mp4`)? ______
- Extensão/formato: ______ (esperado mp4 — A CONFIRMAR)

## 4. Resiliência
- O slot 19:00 aparece desabilitado/ausente quando não há clipes? ______
- Quantos clipes típicos por slot? ______ (sanidade: conta esperada na validação)
