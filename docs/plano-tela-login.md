# Plano: novas dinâmicas para a tela de login

> Status: proposta para decisão — não implementada  
> Atualizado em: 05/10/2026

## 1. Objetivo

Avaliar alternativas para simplificar o acesso ao app sem perder o controle de quem pode entrar nem o vínculo entre a conta de acesso e o cadastro do jogador. Este documento compara opções e deixa a escolha do fluxo para uma etapa posterior.

## 2. Como funciona hoje

- A tela pede usuário e senha; o usuário é sugerido a partir da lista de jogadores. O login chama a RPC `fazer_login` (`src/routes/Login.tsx`, `src/lib/jogadores.ts`).
- A sessão do jogador é mantida no `localStorage` pela chave `racha_sessao` (`src/context/SessaoContext.tsx`).
- A criação de jogadores é feita por um administrador e a senha inicial atual é `123` (`src/routes/NovoJogador.tsx`, `src/lib/jogadores.ts`).
- O modelo atual associa identidade, credenciais e dados esportivos ao cadastro em `jogadores`. Trocar a forma de entrar exige preservar esse vínculo e não apenas adicionar botões à tela.

## 3. Regras que qualquer alternativa deve preservar

1. A conta de acesso deve corresponder a um único `jogadores.id`, para preservar histórico, perfil e permissões.
2. Uma solicitação ou cadastro novo não deve liberar acesso antes da aprovação ou convite válido.
3. Permissões administrativas devem continuar definidas pelo servidor; nunca confiar em dados enviados pelo formulário ou pelo perfil social.
4. A senha padrão `123` deve ser retirada do fluxo de novos cadastros durante a mudança.
5. O fluxo deve cobrir recuperação de acesso, logout e expiração/revogação de sessão.

## 4. Alternativas

### Opção 1 — Entrar com Google, Apple ou Facebook

**Fluxo:** a pessoa escolhe um provedor, autentica-se nele e retorna ao app. Depois, a identidade externa é vinculada a um jogador existente ou passa por convite/aprovação.

**Vantagens**

- Menos senhas para lembrar e digitar.
- Recuperação de credenciais fica a cargo do provedor.
- Pode acelerar o acesso para jogadores que já usam esses serviços.

**Custos e riscos**

- Exige configurar cada provedor, URLs de retorno e tratamento de erros.
- É necessário vincular explicitamente a conta externa ao cadastro correto em `jogadores`; nome ou foto do perfil não bastam para identificar um jogador.
- A troca do login atual envolve sessão, migração das contas existentes e validação em navegador/PWA, especialmente no retorno do provedor.
- Google, Apple e Facebook são três integrações distintas; não é necessário habilitar todas de uma vez.

**Melhor cenário:** o grupo quer reduzir atrito e aceita a dependência de provedores externos, mantendo convite ou aprovação para controlar a entrada.

### Opção 2 — Cadastro com usuário e senha, sujeito à aprovação

**Fluxo:** a pessoa envia um pedido de acesso com usuário e contato. O pedido fica pendente; um administrador aprova ou rejeita. O acesso só é liberado após a aprovação.

**Vantagens**

- Não depende de Google, Apple ou Facebook.
- Permite que novos jogadores iniciem o pedido sem esperar um convite individual.
- Mantém uma etapa clara de controle pelo administrador.

**Custos e riscos**

- Cria uma fila de solicitações que alguém precisa revisar.
- Exige estados e mensagens para pedido enviado, pendente, aprovado e rejeitado.
- É preciso validar contato, evitar pedidos duplicados e impedir login enquanto o status estiver pendente.
- A senha não pode ser armazenada em texto aberto. Uma alternativa mais simples é pedir que a pessoa a defina por um link de ativação somente depois da aprovação.

**Melhor cenário:** o grupo quer permitir pedidos espontâneos de entrada, mas não quer cadastro público com acesso automático.

### Opção 3 — Convite individual com link ou código de uso único

**Fluxo:** o administrador seleciona um jogador já cadastrado e gera um convite vinculado àquele jogador. A pessoa abre o link/código, confirma o acesso e define a credencial. Convites devem expirar e não poder ser reutilizados.

**Vantagens**

- Combina com um elenco conhecido e acesso controlado.
- Evita contas sem jogador associado e não exige uma fila pública de cadastros.
- Substitui a senha padrão compartilhada por uma ativação feita pelo próprio jogador.
- Pode começar sem integração com redes sociais.

**Custos e riscos**

- O administrador precisa emitir e reenviar convites quando necessário.
- Convites são credenciais temporárias: precisam ser validados no servidor, ter validade e ser invalidados após uso ou cancelamento.
- Para jogadores ainda não cadastrados, o administrador precisa criar o perfil antes ou aprovar a solicitação antes de emitir o convite.

**Melhor cenário:** o acesso deve continuar restrito ao elenco atual, com entrada autorizada por um administrador.

### Opção 4 — Código temporário por e-mail ou SMS, sem senha

**Fluxo:** a pessoa informa um contato verificado, recebe um código ou link temporário e entra após validá-lo. O contato precisa estar vinculado a um jogador existente ou a um convite aprovado.

**Vantagens**

- Remove a necessidade de lembrar uma senha.
- O código expira, e a pessoa pode solicitar um novo quando necessário.
- Pode ser combinado com a aprovação ou o convite da opção 2 ou 3.

**Custos e riscos**

- Depende de e-mail ou telefone confiável e verificado para cada jogador.
- Exige serviço de entrega, limites contra abuso e tratamento de atrasos ou falhas de entrega.
- Não resolve sozinho quem pode entrar: ainda precisa do vínculo com `jogadores` e da regra de aprovação/convite.

**Melhor cenário:** a maioria dos jogadores tem um contato atualizado e o grupo prefere não administrar senhas.

## 5. Comparação rápida

| Alternativa | Controle de entrada | Dependência externa | Esforço relativo | Adequação ao fluxo atual |
| --- | --- | --- | --- | --- |
| Google/Apple/Facebook | Alto se combinado com vínculo ou aprovação | Alta | Alto | Média |
| Usuário/senha com aprovação | Alto | Baixa a média | Médio/alto | Média |
| Convite individual | Muito alto | Baixa | Médio | Alta |
| Código temporário | Alto se combinado com vínculo ou convite | Média/alta | Médio/alto | Média |

## 6. Recomendação inicial

Se a intenção é manter o app restrito aos jogadores do elenco, começar avaliando a **opção 3 — convite individual**. Ela se encaixa no cadastro atual feito pelo administrador, mantém o acesso ligado a um jogador conhecido e remove a dependência da senha padrão.

Se a prioridade for permitir que qualquer pessoa peça para entrar, avaliar a opção 2. OAuth ou código temporário podem ser escolhidos depois como forma de autenticação, mas não substituem a regra que decide se a pessoa pertence ao racha.

Esta recomendação é condicional; a decisão depende de confirmar se o acesso continuará fechado ao elenco ou se o cadastro deverá ser aberto a novos interessados.

## 7. Plano de execução após a escolha

1. **Definir a regra de entrada:** escolher entre elenco fechado por convite, solicitação com aprovação ou cadastro aberto; definir quem aprova e como o jogador comprova sua identidade.
2. **Definir o método de autenticação:** escolher senha, provedor social ou código temporário; confirmar quais contatos dos jogadores estão disponíveis e como recuperar o acesso.
3. **Planejar a ligação com os jogadores existentes:** garantir uma identidade de acesso por `jogadores.id`, sem duplicar perfis nem perder histórico ou permissões.
4. **Implementar a regra no servidor:** criar e validar convites/solicitações ou integrar o provedor escolhido; manter permissões fora do controle do cliente e retirar a senha padrão `123`.
5. **Atualizar as telas:** cobrir entrada, ativação/cadastro, estado pendente, convite inválido/expirado, erros e recuperação de acesso, preservando o uso em celular e PWA.
6. **Migrar e liberar gradualmente:** testar com contas de jogador e administrador, validar sessão, logout, dados e permissões; só desativar o login atual depois de confirmar o acesso das contas existentes e um caminho de reversão.

## 8. Critérios de aceite

- Jogadores existentes entram na conta correta e mantêm perfil, histórico e permissões.
- Contas pendentes, sem convite ou com convite expirado/reutilizado não acessam o app.
- Nenhum fluxo permite que o usuário escolha para si permissões administrativas.
- A senha padrão `123` deixa de ser usada para novos cadastros.
- Login, logout, restauração de sessão e recuperação de acesso funcionam em navegador e PWA móvel.
- Erros de provedor, código, convite ou aprovação são apresentados sem deixar a pessoa em uma tela sem saída.

## 9. Decisões pendentes

- O acesso continuará fechado ao elenco atual ou novos interessados poderão solicitar entrada?
- Qual alternativa será a principal: senha, provedor social, convite ou código temporário?
- E-mail/telefone dos jogadores estão atualizados e podem ser usados para verificação?
- Como as contas existentes deixarão a senha atual e serão vinculadas à nova forma de acesso?
- Quais provedores, se algum, devem ser suportados no primeiro lançamento?

## 10. Fora de escopo

Este documento não implementa mudanças no app, no banco, nos provedores de identidade nem no processo atual de login. Essas alterações devem começar somente após as decisões da seção 9.
