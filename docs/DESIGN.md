# DESIGN - T2.2 Tela de Presenca

> Scope: page-level UI for `app/(tabs)/index.tsx` (Tela "Presenca") + reusable
> components `PlayerCard` + `PresenceList`.
> Stack: React Native + Expo SDK 52+ + NativeWind v4. Mobile-only (Android).
> Patterns: 60-30-10 color rule, 8pt grid, status semantic tokens.

## 1. Visual Theme

Football/soccer inspired ("pelada de campo"). Verde campo as primary, pitch
gray neutral base, goalkeeper orange accent, semantic status colors.

- Tone: casual but clear. Information density over decoration.
- Card-first: every player is one Card; groups are lists of cards.
- Hierarchy via color-coded left borders (status), not heavy chrome.

## 2. Color Palette

Mirrors `tailwind.config.js` + `global.css` (no new tokens introduced).

| Token           | Hex         | Usage                                 |
| --------------- | ----------- | ------------------------------------- |
| `field`         | `#16a34a`   | Primary actions (Confirmar)           |
| `field-dark`    | `#15803d`   | Pressed state                         |
| `field-light`   | `#86efac`   | Avatar circle bg, Mensalista badge bg |
| `pitch-50`      | `#f8fafc`   | Screen background                     |
| `pitch-200`     | `#e2e8f0`   | Avulso badge bg                       |
| `pitch-300`     | `#cbd5e1`   | Dashed split line                     |
| `pitch-400`     | `#94a3b8`   | Waiting list left border              |
| `pitch-500/900` | text tokens | secondary / primary text              |
| `goalkeeper`    | `#ea580c`   | Goalkeeper badge text + 10% bg        |
| `warning`       | `#eab308`   | Pending approval border               |
| `success`       | `#22c55e`   | Confirmed border                      |
| `danger`        | `#dc2626`   | Declined border, danger btn           |

### Status -> Color mapping (REQ from task)

| RsvpStatus         | Border token | Visual   |
| ------------------ | ------------ | -------- |
| `confirmed`        | `success`    | Verde    |
| `pending_approval` | `warning`    | Amarelo  |
| `waiting_list`     | `pitch-400`  | Cinza    |
| `declined`         | `danger`     | Vermelho |

## 3. Typography

System stack (Roboto on Android). No webfonts (loads extra, YAGNI for MVP).

| Element      | Class                                           | Size |
| ------------ | ----------------------------------------------- | ---- |
| Page title   | `text-2xl font-bold`                            | 24px |
| List header  | `text-sm font-semibold uppercase tracking-wide` | 14px |
| Player name  | `text-base font-medium`                         | 16px |
| Badge label  | `text-[10px] font-semibold uppercase`           | 10px |
| Counter X/16 | `text-sm font-semibold`                         | 14px |

## 4. Component Stylings

### PlayerCard

- Layout: `flex-row items-center gap-3` + `border-l-4` (status color).
- Avatar: 40x40 circle, field-light bg, initial uppercase centered.
- Name: `numberOfLines={1}` to avoid wrap.
- Badges: 1 user_type chip (Mensalista/Avulso/Goleiro). ~28px tall.
- Optional actions: `Confirmar` (field) and/or `Desistir` (ghost pitch-100).
- Touch target: `min-h-[44px]` on both action buttons.
- A11y: `accessibilityLabel` joins status + name + user_type.

### PresenceList

- Header: title (uppercase tracked) on left, counter on right.
- Counter format: `count/capacity` when capacity passed; else just `count`.
- Items rendered as vertical `gap-2` stack of PlayerCards.
- Split (corte visual): horizontal dashed line + label ("Reservas") between
  capacity items and overflow. Uses `border-t border-dashed border-pitch-300`.
- Empty state: italic centered "X vazia".

## 5. Layout Principles

- 8pt spacing grid via Tailwind defaults (`gap-2`, `gap-3`, `gap-6`, `p-4`).
- SafeArea top edge only (bottom handled by tab bar).
- Page is `ScrollView` with `gap-6 px-4 pb-8 pt-4`.
- Three PresenceLists stacked vertically: Confirmados > Pendentes > Fila.
- Width fills device height column. `bg-pitch-50` differentiates lists area
  from white cards.

## 6. Depth & Elevation

| Element         | Shadow            | Why                               |
| --------------- | ----------------- | --------------------------------- |
| PlayerCard      | RN `elevation: 1` | Subtle separation from background |
| Cards (ui/Card) | `elevation: 2`    | Reused from T1.5 (not used here)  |

Shadows kept minimal: list items dense, heavy shadow would muddy.

## 7. Do's / Don'ts

### Do

- Use semantic tokens (`success`, `warning`) over hardcoded hex.
- Pass `onConfirm`/`onLeave` only when handler really exists (T2.3 plug-in).
- Keep PlayerCard pure: no IO inside component.

### Don't

- Do not add avatars (N2 dead field - task explicitly removed).
- Do not animate entries on this list (motion polish is post-MVP).
- Do not introduce dark mode variants (out of MVP scope).
- Do not import from `stores/*` inside PlayerCard/PresenceList (decoupling).

## 8. Responsive Behavior

- Mobile-only: single column, no breakpoint logic.
- Touch targets: every Pressable is `min-h-[44px]`.
- Cards fill width; FlatList/ScrollView handles vertical scroll.
- Long names truncated via `numberOfLines={1}` (no horizontal scroll).

## 9. Agent Prompt Guide

When extending this tela (T2.3 bind real data):

1. Fetch from `usePresenceStore` selector - filter by `status` into 3 arrays.
2. For `waiting_list`, sort by `created_at` ASC and stamp `queuePosition`.
3. For `confirmed`, sort by `confirmed_at` ASC; pass `capacity=16`, `splitAt=16`.
4. Plug admin-only handlers (RBAC check) as `onConfirm` for pending items.
5. Keep PlayerCard / PresenceList props signatures stable - do not break API.
6. Realtime updates flow via the store - the tela re-renders automatically.
