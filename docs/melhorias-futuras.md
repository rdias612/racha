# Melhorias futuras de UX mobile

Itens adiados nesta rodada. Os ajustes globais de acessibilidade, estados, espacamento, tipografia e datas ja foram aplicados.

## 1. Navegacao mobile

- Criar barra inferior fixa com `Jogos`, `Ranking` e `Perfil`.
- Mover tema, logout e `+ Jogador` para um menu de conta no topo.
- Manter as metricas do ranking em um seletor horizontal compacto.
- Garantir que todos os alvos interativos tenham pelo menos 44 px.

## 2. Ranking responsivo

- Substituir a tabela com largura minima de `42rem` por linhas/cards no mobile.
- Mostrar nome, posicao, metrica principal e percentual de vitorias primeiro.
- Deixar partidas, vitorias e derrotas em uma linha secundaria.
- Usar um seletor `Ordenar por` no mobile.
- Destacar o jogador logado e os tres primeiros colocados.
- Manter a tabela completa em telas maiores.

## 3. Fluxo de votacao

- Exibir progresso, por exemplo `12 de 15 avaliados`.
- Aumentar a area visual do slider e dos atalhos de nota.
- Avaliar um jogador por vez com navegacao `Anterior` e `Proximo`.
- Avisar antes de sair com avaliacoes incompletas.
- Manter a acao de envio fixa e sempre acessivel.

## 4. Perfil

- Trocar `grid-cols-5` por duas colunas no mobile e cinco em telas maiores.
- Destacar partidas, vitorias e aproveitamento.
- Tornar `Alterar senha` uma secao recolhivel.
- Evitar logout duplicado quando o menu de conta existir.

## Criterios de validacao

- Testar em larguras de 320 px, 375 px e 430 px.
- Confirmar ausencia de rolagem horizontal acidental.
- Confirmar que teclado virtual nao cobre a acao principal.
- Validar foco por teclado e contraste nos temas claro e escuro.
- Validar o fluxo criar partida, publicar, votar, ver resultado e consultar ranking.
