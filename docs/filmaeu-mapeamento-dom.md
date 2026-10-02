# Mapeamento DOM do Filma Eu — Clipes (preenchido pelo dono, uma vez)

> Consumidor: `scripts/clipes/filmaeu/seletores.mjs` (RNF04 — única fonte de seletores).
> Mapeado no navegador em 02/10/2026. Nenhuma credencial foi registrada.

## 1. Rotas e fluxo

- URL de login: `https://filmaeu.com.br/login`.
- Fluxo pós-login: **3 etapas funcionais** (quadra → data/horários → slot 19:00), realizadas em **6 ações de UI**:
  1. Em `/perfil`, clicar em **Trocar campo** abre o modal de locais.
  2. Pesquisar `Society Gragoatá` e selecionar a linha `Niterói-RJ / Society Gragoatá`.
  3. Preencher a data em `AAAA-MM-DD`.
  4. Clicar em **Pesquisar** para carregar os horários.
  5. Clicar no horário **19:00**.
  6. A grade é carregada abaixo dos horários.
- Depois do login, o navegador chega a `https://filmaeu.com.br/perfil`. O formulário de login envia autenticação por AJAX (`POST login-validate`) e, em caso de sucesso, abre `/perfil`.
- A seleção de local altera a URL para `https://filmaeu.com.br/perfil#`. As buscas de data e horário permanecem nessa mesma URL e carregam conteúdo por AJAX (`search` e `show`).
- **A URL da grade não carrega data nem horário na querystring.** Após selecionar o slot, `location.search` e `location.hash` estão vazios; a barra mostra `/perfil#`. Não há URL direta estável para substituir os cliques.

| Tela | URL observada e mudança | Captura |
| --- | --- | --- |
| Login | `/login`; formulário com Email, Senha e Entrar | [filmaeu-login.png](./filmaeu-login.png) |
| Busca após login | `/perfil`; filtros de campo e data | [filmaeu-perfil-busca.png](./filmaeu-perfil-busca.png) |
| Escolha da quadra | `/perfil#`; modal **Escolher Local**, filtrado por nome/cidade | [filmaeu-escolha-quadra.png](./filmaeu-escolha-quadra.png) |
| Data escolhida | `/perfil#`; quadra selecionada e data `01/10/2026` antes de pesquisar | [filmaeu-selecao-data.png](./filmaeu-selecao-data.png) |
| Horários | `/perfil#`; aparecem os horários disponíveis para a quadra/data | [filmaeu-selecao-horario.png](./filmaeu-selecao-horario.png) |
| Grade de 19:00 | `/perfil#`; os clipes são inseridos abaixo da lista de horários | [filmaeu-grade-clipes-1900.png](./filmaeu-grade-clipes-1900.png) |
| Sem horário 19:00 | `/perfil#`; em `02/10/2026`, só apareceu o horário `18:00` | [filmaeu-slot-sem-19h.png](./filmaeu-slot-sem-19h.png) |

## 2. Seletores

| Elemento | Seletor/valor observado | Observação |
| --- | --- | --- |
| Campo de usuário | `#loginForm input[name="email"]` | `input[type="email"]`, obrigatório |
| Campo de senha | `#loginForm input[name="password"]` | `input[type="password"]`, obrigatório |
| Botão Entrar | `#loginForm button.login_btn` | Texto visível `Entrar`; o botão não tem atributo `type` explícito |
| Sinal pós-login | `#datepicker` | Visível na página autenticada `/perfil` |
| Abrir escolha da quadra | link com texto `Trocar campo` (`href="#"`) | Abre `#myModal`; a URL passa a `/perfil#` |
| Busca da quadra | `#myModal #client-search` | Placeholder `Pesquisar nome ou cidade`; filtrar por `Society Gragoatá` |
| Item da quadra | `#myModal tr#client803` | Linha `Niterói-RJ / Society Gragoatá`, atributo `client-id="803"`; ao clicar, preenche `#society` com `803` |
| Controle de data | `input#datepicker[type="date"]` | Valor ISO, por exemplo `2026-10-01` |
| Pesquisar data | `span#submitDate` | Texto `Pesquisar`; carrega a lista de horários |
| Slot 19:00 | `a.hour[hour="19HR"]` | Texto visível `19:00`; `hour="19HR"` é o valor usado na busca |
| Grade de clipes | `#showVideos` | Contêiner preenchido após escolher o slot |
| Grupo de clipes | `#showVideos .card-videos` | Um grupo por horário de gravação |
| Título/ordem | `.card-header` dentro de `.card-videos` | Horário da gravação; grupos exibidos em ordem crescente |
| Baixar | `span.download-video` | Um por vídeo/câmera; não é link nem botão e não tem `href` |

Notas:

- O `select#campo[name="campo"]` representa o tipo de campo (no teste, `Campo de Futebol`, valor `1`); não é o seletor da quadra. A quadra é mantida em `input#society[type="hidden"]`.
- Há outro `#client-search` dentro de um modal oculto. Sempre escopar a busca a `#myModal #client-search`.
- O filtro do modal reage a `keyup`; preencher o campo sem gerar eventos de teclado não filtrou a lista no teste. Para filtrar, digitar como teclado e então clicar na linha.
- Cada `.card-videos` contém **dois** vídeos/câmeras e dois `span.download-video`. Os nomes de origem seguem, por exemplo, `v_19m39s_cam0b.mp4` e `v_19m39s_cam1.mp4`.

## 3. Comportamento do download (crítico)

- O manipulador de `span.download-video` define `window.location.href` para `../components/download.php?videoId={videoId}&userId={userId}`. O endpoint respondeu a uma requisição `HEAD` com HTTP `200`, `Content-Type: video/mp4` e `Content-Disposition: attachment`; não houve redirecionamento.
- Portanto, **o download é iniciado na aba atual pelo endpoint PHP**: não abre nova aba nem navega para uma URL do Spaces. A inspeção foi feita sem transferir o corpo do vídeo.
- O player usa URL direta do DigitalOcean Spaces, sem token/querystring no exemplo observado: `https://803-societygragoata.sfo3.digitaloceanspaces.com/Videos/campo1/01-10-2026/19HR/v_19m39s_cam0b.mp4`.
- Nome informado pelo endpoint: `filmaeu_2026_10_01.mp4`. O mesmo nome foi retornado para dois vídeos distintos do mesmo dia e em acessos repetidos: é estável por data, mas **não é único por clipe**. Não usar esse nome, sozinho, como chave/destino de todos os arquivos do slot.
- Extensão/formato: `.mp4`, confirmado pelo `source` do player e pelo cabeçalho `video/mp4`.

## 4. Resiliência

- Em `02/10/2026`, a lista mostrou somente `18:00`; `19:00` estava **ausente**, não desabilitado, e a grade não tinha vídeos. Na data com clipes (`01/10/2026`), `19:00` apareceu como link `a.hour`.
- No exemplo observado de `01/10/2026` às 19:00 havia **4 grupos de gravação**, cada um com 2 vídeos/câmeras: **8 arquivos MP4**. É uma contagem observada para sanidade, não uma garantia fixa para todo slot.

## Observação para a automação atual

Este mapeamento não altera o consumidor. Antes de usá-lo em uma importação, alinhar `automacao.mjs` com o fluxo real:

- abrir **Trocar campo** antes de preencher `#myModal #client-search` e clicar em **Pesquisar** antes de aguardar/selecionar um horário;
- enumerar os dois `span.download-video` de cada `.card-videos` para não omitir uma câmera;
- não usar o nome de download `filmaeu_YYYY_MM_DD.mp4` como identidade única: vídeos diferentes do mesmo dia retornam o mesmo nome.
