# Como tornar uma UX com Tailwind mais única

O problema provavelmente não é o Tailwind, mas o fato de a IA estar usando Tailwind de forma muito literal. Combinações como `rounded-xl + shadow-sm + bg-white + border + blue-600` acabam produzindo aquela aparência de **"SaaS genérico feito por IA"**.

Existem várias bibliotecas open source muito boas para Tailwind.

## Bibliotecas que vale a pena considerar

Se o projeto for **React/Next.js**, minha primeira escolha seria **shadcn/ui**.

- https://github.com/shadcn-ui/ui

O diferencial é que ele não funciona como uma biblioteca tradicional. Os componentes são colocados dentro do seu próprio projeto, então a IA pode modificar livremente o código. É open source, MIT e altamente customizável.

Em vez de pedir:

> "Crie um dashboard usando Tailwind"

eu pediria:

> "Use shadcn/ui como base, mas não utilize o visual padrão dos componentes. Crie um design system próprio para esta aplicação."

Isso muda bastante o resultado.

### Comparação

| Biblioteca      | Melhor para               | Personalização | Opinião                                     |
| --------------- | ------------------------- | -------------: | ------------------------------------------- |
| **shadcn/ui**   | React/Next                |     ⭐⭐⭐⭐⭐ | **Minha escolha**                           |
| **daisyUI**     | Qualquer framework        |         ⭐⭐⭐ | Ótima para velocidade                       |
| **Flowbite**    | Dashboards/admin          |         ⭐⭐⭐ | Muitos componentes                          |
| **Headless UI** | UI totalmente customizada |     ⭐⭐⭐⭐⭐ | Excelente base                              |
| **Radix UI**    | Componentes acessíveis    |     ⭐⭐⭐⭐⭐ | Excelente para construir seu próprio design |
| **HeroUI**      | React                     |       ⭐⭐⭐⭐ | Visual mais pronto                          |
| **Preline UI**  | Aplicações web/SaaS       |       ⭐⭐⭐⭐ | Muitos componentes                          |
| **HyperUI**     | Blocos/sections           |       ⭐⭐⭐⭐ | Bom para inspiração                         |

## Mas não basta instalar uma biblioteca

Eu não recomendaria simplesmente instalar uma biblioteca e deixar a IA usar os componentes padrão.

Isso provavelmente só vai trocar:

> "SaaS genérico Tailwind"

por:

> "SaaS genérico shadcn"

O ideal é criar uma **identidade visual própria por cima da biblioteca**.

---

# Como deixar sua UX realmente única

Eu atacaria seis pontos.

## 1. Criar um design system próprio

Defina antes:

```text
Primary
Secondary
Accent
Background
Surface
Border
Text
Muted
Success
Warning
Error
```

Mas não pense apenas em cores.

Defina também:

```text
Border radius
Spacing
Typography
Shadows
Button heights
Input heights
Card style
Table style
Modal style
Icon style
Animation
```

Exemplo:

```text
Border radius:
- buttons: 8px
- inputs: 8px
- cards: 12px
- dialogs: 16px

Borders:
- 1px
- baixa opacidade

Shadows:
- quase inexistentes
- usar contraste e background para separar elementos
```

Isso já tira bastante aquela aparência de template.

---

## 2. Não usar cards para absolutamente tudo

Esse é um dos maiores sinais de UI gerada por IA.

Um dashboard cheio de:

```text
┌──────────────────────────────┐
│ Card                         │
│                              │
│ 42                           │
│ Active users                 │
└──────────────────────────────┘
```

repetido várias vezes geralmente fica genérico.

Experimente misturar elementos e usar **hierarquia visual**, não apenas containers:

```text
Dashboard
────────────────────────────────────

42 Active users     18 Errors      92% Health

────────────────────────────────────

Traffic
██████████████████████████

────────────────────────────────────

Recent events
● Event A
● Event B
● Event C
```

---

## 3. Criar uma linguagem visual específica para o domínio

Para uma aplicação técnica/telecom/QA, eu evitaria tentar fazer parecer um SaaS de marketing.

Uma direção interessante seria:

**"Network Operations / Engineering Console"**

Por exemplo:

```text
┌─────────────────────────────────────────────────────┐
│ NOSSIS                         ● SYSTEM OPERATIONAL │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  Overview    │  Network Health                     │
│              │                                      │
│  Alarms      │  ┌────────┐ ┌────────┐ ┌────────┐  │
│  Tests       │  │ 12,482 │ │   34   │ │ 99.97% │  │
│  Simulators  │  │ Tests  │ │ Errors │ │ Health │  │
│              │  └────────┘ └────────┘ └────────┘  │
│  Devices     │                                      │
│              │  Active Events                       │
│  Settings    │  ● PON LOS       12:41:32           │
│              │  ● OLT DOWN      12:40:12           │
│              │  ● LINK DOWN     12:38:02           │
└──────────────┴──────────────────────────────────────┘
```

A personalidade vem do **domínio**, e não apenas de efeitos visuais.

---

## 4. Usar uma tipografia diferente

Isso é subestimado.

Se a IA está usando:

```css
font-family: Inter;
```

em absolutamente tudo, você provavelmente já está no caminho do visual genérico.

Experimente:

### Interface

- Geist
- IBM Plex Sans
- Manrope
- Plus Jakarta Sans

### Dados técnicos

- IBM Plex Mono
- JetBrains Mono
- Geist Mono

Uma combinação interessante para uma aplicação técnica:

```text
UI → Geist
IDs / IPs / timestamps / logs → Geist Mono
```

---

## 5. Fazer os estados da aplicação serem parte da UX

IAs normalmente esquecem isso.

Não pense somente em:

```text
Loading
Success
Error
```

Crie estados ricos:

```text
Connecting...
Connected
Executing
Waiting for response
Processing
Completed
Failed
Timeout
Retrying
```

E represente isso visualmente.

Por exemplo:

```text
● Connected

POST /api/v1/device

Sending request...
████████████████░░░░ 82%

Response received
204 No Content
```

Isso deixa a aplicação muito mais parecida com um produto real e menos com um CRUD.

---

## 6. Usar microinterações

Sem exagerar.

Exemplos:

- botão muda suavemente ao hover
- sidebar expande/recolhe
- tabela atualiza sem piscar
- novo evento aparece com pequena animação
- toast entra pela lateral
- status muda com transição
- skeleton durante carregamento
- command palette `Ctrl + K`
- atalhos de teclado
- copiar conteúdo com feedback visual

São pequenas coisas, mas fazem a interface parecer **intencionalmente projetada**.

---

# Uma combinação que eu acho especialmente boa

Se seu projeto for React/Next:

```text
Tailwind CSS
      │
      ├── shadcn/ui
      │
      ├── Base UI / Radix
      │
      └── Lucide Icons
```

Depois você cria:

```text
        Seu Design System
               │
      ┌────────┼────────┐
      │        │        │
   Colors   Typography  Motion
      │        │        │
      └────────┼────────┘
               │
        shadcn components
               │
      ┌────────┼─────────┐
      │        │         │
    Table    Forms    Dashboard
```

A vantagem do shadcn é justamente essa: você **possui o código dos componentes**, então pode alterar completamente aparência e comportamento em vez de ficar brigando com uma biblioteca fechada.

---

# Um ponto muito importante para projetos desenvolvidos com IA

Eu criaria um arquivo:

```text
/design-system.md
```

e colocaria regras explícitas para a IA.

Por exemplo:

```text
# Design System

## General

Never use generic SaaS layouts.

Do not use excessive cards.

Avoid gradients unless explicitly requested.

Avoid excessive rounded corners.

Do not use the default shadcn visual appearance.

Prioritize information hierarchy over decoration.

## Typography

UI: Geist
Technical data: Geist Mono

## Radius

Buttons: 8px
Inputs: 8px
Cards: 12px
Dialogs: 16px

## Colors

Background: ...
Surface: ...
Border: ...
Primary: ...
Accent: ...

## Components

Buttons:
- compact
- medium radius
- subtle hover

Tables:
- dense
- strong column hierarchy
- monospace for technical values

Status:
- use semantic colors
- always include icon + text
```

E principalmente:

> **"Before creating a new component, check whether an existing component follows the design system. Do not introduce a new visual pattern without a reason."**

Isso é muito importante quando você está usando IA para desenvolver a aplicação, porque impede que ela invente **20 estilos diferentes de botão, card e modal** ao longo do projeto.

---

# Resumo da recomendação

Se eu fosse começar agora:

1. **Tailwind CSS** como base.
2. **shadcn/ui** para componentes.
3. **Radix/Base UI** quando precisar de primitives acessíveis e altamente customizáveis.
4. **Lucide Icons** para ícones.
5. Criar um **design system próprio**.
6. Criar um `/design-system.md` para servir como regra para a IA.
7. Evitar o visual padrão do shadcn.
8. Reduzir o uso indiscriminado de cards, sombras, gradients e border-radius.
9. Usar uma tipografia com personalidade.
10. Criar uma linguagem visual específica para o domínio da aplicação.
11. Investir em estados, feedbacks e microinterações.

O objetivo não é fazer a interface parecer mais "bonita" simplesmente. É fazer com que, olhando para ela, seja possível reconhecer **qual produto é aquele**.
