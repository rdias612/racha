# Agent Instructions

## Objetivo

Este projeto deve ser evoluído mantendo código limpo, coeso, simples e sustentável.

O agente deve priorizar boas práticas de engenharia de software, uso adequado de design patterns e princípios de qualidade, evitando overengineering e mudanças desnecessárias na arquitetura existente.

## Diretrizes Gerais

- Preserve a arquitetura atual do projeto.
- Não introduza novas bibliotecas, frameworks ou padrões arquiteturais sem necessidade clara.
- Prefira mudanças pequenas, incrementais e fáceis de revisar.
- Não misture refatoração estrutural com alteração de regra de negócio.
- Não altere comportamento funcional sem necessidade explícita.
- Não faça mudanças cosméticas amplas que dificultem o review.
- Antes de criar novas abstrações, verifique se existe alguma estrutura semelhante no projeto.
- Siga o padrão de nomenclatura, organização de pacotes e estilo já utilizado no código existente.

## Princípios de Qualidade

Aplique os princípios abaixo de forma pragmática:

### SOLID

- **Single Responsibility Principle**: classes, métodos e componentes devem ter uma responsabilidade clara.
- **Open/Closed Principle**: prefira extensão por composição, estratégia ou polimorfismo quando houver variações de comportamento.
- **Liskov Substitution Principle**: evite heranças frágeis ou subclasses que alterem contratos esperados.
- **Interface Segregation Principle**: evite interfaces grandes demais; prefira contratos pequenos e específicos.
- **Dependency Inversion Principle**: dependa de abstrações quando houver necessidade real de desacoplamento.

### Simplicidade

- Aplique **KISS**: prefira soluções simples e diretas.
- Aplique **YAGNI**: não crie abstrações para cenários futuros não confirmados.
- Aplique **DRY** com critério: remova duplicação real, mas não force abstrações prematuras.
- Evite criar camadas, factories, strategies ou interfaces sem justificativa objetiva.

### Coesão e Acoplamento

- Mantenha classes altamente coesas.
- Reduza acoplamento entre camadas.
- Evite dependências cíclicas entre pacotes.
- Evite classes utilitárias genéricas quando a lógica pertence a um domínio específico.
- Prefira composição em vez de herança quando possível.

## Design Patterns

Use design patterns apenas quando eles resolverem um problema real do código.

### Patterns recomendados quando fizer sentido

- **Strategy**: para variações claras de comportamento, regras ou algoritmos.
- **Factory / Factory Method**: para centralizar criação de objetos complexos ou dependentes de contexto.
- **Builder**: para criação de objetos com muitos campos opcionais ou construção complexa.
- **Adapter**: para integrar APIs externas, legadas ou modelos incompatíveis.
- **Facade**: para simplificar acesso a subsistemas complexos.
- **Template Method**: para fluxos com estrutura fixa e etapas variáveis.
- **Chain of Responsibility**: para pipelines de validação, processamento ou decisão.
- **Command**: para representar operações executáveis, especialmente quando houver histórico, fila ou reprocessamento.
- **Mapper**: para conversão entre entidades, DTOs, models e objetos externos.

### Patterns que exigem cuidado

- Não use **Singleton** salvo necessidade técnica muito clara.
- Não crie **Abstract Factory** se uma Factory simples resolver.
- Não use **Observer/Event** sem necessidade real de desacoplamento assíncrono.
- Não use **Strategy** para substituir um `if` simples que não tende a crescer.
- Não crie interfaces para toda classe automaticamente.
- Não aplique pattern apenas para “parecer mais arquitetural”.

## Regras para Refatoração

Ao refatorar:

- Preserve o comportamento existente.
- Reduza tamanho e responsabilidade de classes grandes.
- Extraia métodos quando melhorar legibilidade.
- Extraia classes quando houver responsabilidade independente.
- Remova duplicação quando houver repetição de regra ou fluxo.
- Prefira nomes explícitos em vez de comentários explicando código confuso.
- Evite métodos longos com múltiplos níveis de decisão.
- Evite parâmetros excessivos; considere Value Object, DTO interno ou Builder quando fizer sentido.
- Evite efeitos colaterais escondidos.
- Evite métodos que alteram muitos objetos externos ao mesmo tempo.

## Organização de Camadas

Quando aplicável, respeite a separação de responsabilidades:

- Controllers/Resources devem lidar com entrada, saída e delegação.
- Services/Application Services devem coordenar casos de uso.
- Domain deve concentrar regras de negócio.
- Repositories/DAOs devem lidar com persistência.
- Clients/Gateways devem encapsular comunicação externa.
- DTOs devem transportar dados, não conter regra de negócio complexa.
- Mappers devem concentrar conversões entre modelos.

Evite:

- Controller acessando Repository diretamente.
- Repository contendo regra de negócio.
- DTO contendo lógica de domínio.
- Service acumulando responsabilidades de validação, persistência, integração e transformação ao mesmo tempo.
- Classes `Manager`, `Helper` ou `Util` genéricas sem responsabilidade clara.

## Qualidade de Código Java

- Prefira nomes claros e específicos.
- Prefira constructor injection quando aplicável.
- Evite wildcard imports.
- Evite código morto, comentários obsoletos e blocos comentados.
- Evite `null` desnecessário; trate ausência de valor explicitamente quando possível.
- Evite capturar exceções genéricas sem tratamento adequado.
- Não esconda exceções silenciosamente.
- Use logs com contexto útil, sem expor dados sensíveis.
- Evite métodos públicos sem necessidade.
- Reduza mutabilidade quando possível.
- Prefira objetos imutáveis para dados de entrada, configuração ou resultado quando fizer sentido.

## Checkstyle e Análise Estática

Se o projeto possuir Checkstyle, PMD, SpotBugs ou ferramenta equivalente:

- Respeite as regras já configuradas.
- Não desative regras sem justificativa.
- Não adicione suppressions sem necessidade clara.
- Corrija violações introduzidas pela alteração.
- Não refatore o projeto inteiro apenas para corrigir violações fora do escopo da tarefa.

## Testes

No momento, não criar novos testes automaticamente.

Caso uma alteração tenha risco funcional relevante, apenas sinalize a necessidade de teste ou validação manual, sem criar estrutura de testes por conta própria.

## Antes de Alterar Código

Antes de implementar qualquer mudança:

- Leia o código relacionado.
- Identifique o padrão já usado no projeto.
- Verifique se já existe classe, método ou abstração parecida.
- Explique brevemente a abordagem quando a mudança for estrutural.
- Evite aplicar design pattern sem necessidade objetiva.

## Depois de Alterar Código

Após a alteração:

- Revise se a mudança manteve a arquitetura existente.
- Verifique se não houve introdução de complexidade desnecessária.
- Verifique se nomes, pacotes e responsabilidades continuam claros.
- Informe qualquer débito técnico encontrado, mas não corrija fora do escopo sem solicitação.

## Critérios de Decisão

Ao escolher entre duas soluções:

1. Prefira a mais simples.
2. Prefira a que muda menos código.
3. Prefira a que mantém o padrão atual do projeto.
4. Prefira composição em vez de herança.
5. Prefira clareza em vez de abstração excessiva.
6. Prefira refatorações pequenas em vez de reestruturações grandes.
7. Prefira código explícito em vez de comportamento mágico.

## Comportamento Esperado do Agente

O agente deve atuar como um revisor técnico e implementador cuidadoso.

Ele deve evitar soluções exageradas, dependências desnecessárias e padrões aplicados artificialmente.

O objetivo é melhorar a qualidade do código progressivamente, mantendo consistência, legibilidade e baixo risco de regressão.
