# Design tokens

Single source for the Vortex visual language. Values live in two places that
must agree:

- `src/app/globals.css` — CSS custom properties (`--vx-*`) for the dark
  (default) and light palettes, plus print and reduced-motion overrides.
- `tailwind.config.ts` — maps each `--vx-*` variable to a `vx-*` Tailwind colour
  utility, and registers font families, keyframes and RTL variants.

Components must use the `vx-*` utilities or the shared component classes
(`.card`, `.card-sm`, `.chip`, `.eyebrow`, `.num`). Do not hard-code hex values
or rgba colours in components; add a token instead.

## Colours

Every colour is a CSS variable, so switching `data-theme` re-skins the app
without touching class names.

| Token | Tailwind | Role |
| --- | --- | --- |
| `--vx-ink` | `bg-vx-ink` | Deepest surface; text on sage/rose fills |
| `--vx-base` | `bg-vx-base` | Page base |
| `--vx-surface` | `bg-vx-surface` | Inputs, secondary surfaces |
| `--vx-card` | `bg-vx-card` | Cards, focus-ring offset |
| `--vx-border` | `border-vx-border` | Default borders |
| `--vx-line` | `border-vx-line` | Dividers |
| `--vx-sage`, `-dim`, `-bg` | `text-vx-sage`, `bg-vx-sage-bg` | Primary / success / focus ring |
| `--vx-lav`, `-dim`, `-bg` | `text-vx-lav`, `bg-vx-lav-bg` | Accent (source chain) |
| `--vx-amber` | `text-vx-amber` | Warning |
| `--vx-rose` | `text-vx-rose` | Error / danger |
| `--vx-text`, `--vx-muted`, `--vx-dim` | `text-vx-text`, `text-vx-muted`, `text-vx-dim` | Text hierarchy |

Translucent variants use `color-mix()` rather than Tailwind opacity modifiers
(`bg-vx-surface/60` does not compile against CSS variables). Write
`bg-[color-mix(in_srgb,var(--vx-surface)_60%,transparent)]` or add a component
class in `globals.css`.

## Focus

- Global fallback: `:focus-visible` outline using `--vx-focus-ring`
  (`globals.css`, `@layer base`).
- Interactive primitives use `focus-visible:ring-2 focus-visible:ring-vx-sage`
  with `focus-visible:ring-offset-vx-card`, so the ring is sage in both themes.
- Never remove focus with `outline-none` alone; pair it with a ring.

## Spacing

Tailwind's default 4px scale. No custom spacing tokens. Primitives use:

- Control padding: `sm` `px-2.5 py-1`, `md` `px-4 py-2`, `lg` `px-5 py-3`.
- Input: `ps-3 pe-3 py-2` (logical properties, RTL-safe).

## Radii

| Use | Class |
| --- | --- |
| Controls (buttons, inputs) | `rounded-lg` (0.5rem) |
| Cards | `rounded-xl` (0.75rem) via `.card`; `rounded-lg` via `.card-sm` |
| Pills and badges | `rounded-full` |

## Typography

- Sans: `Inter` (`font-sans`), mono: `JetBrains Mono` (`font-mono`).
- `.eyebrow`: 10px, semibold, uppercase, `tracking-[0.18em]`, muted.
- `.num`: mono with tabular numerals for amounts and hashes.
- Control text: `text-xs` (badge, small button), `text-sm` (button, input),
  `text-base` (large button).

## Elevation

No box shadows are defined. Depth comes from borders (`--vx-border`) and the
sage gradient wash in `.card`. Print drops the card background image and
shadows.

## Motion

| Token | Dark / light | Reduced motion |
| --- | --- | --- |
| `--vx-motion-duration` | `1.2s` | `0.01ms` |
| `--vx-motion-duration-fast` | `0.15s` | `0.01ms` |

Collapsed by `prefers-reduced-motion: reduce` and by
`html[data-motion="reduce"]` (SettingsPanel). Tailwind `transition-colors
duration-150` matches `--vx-motion-duration-fast`.

## Primitives (`src/components/ui/`)

| Component | Props | Notes |
| --- | --- | --- |
| `Button` | `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`sm`, `md`, `lg`), `loading` | `forwardRef`. `loading` shows a spinner, sets `aria-busy="true"` and disables the button. `disabled` uses the native attribute. |
| `Input` | `invalid` | `forwardRef`. `invalid` sets `aria-invalid="true"` and a rose border. |
| `Badge` | `tone` (`neutral`, `sage`, `lav`, `amber`, `rose`) | Span. Same shape as `.chip`. |
| `Card` | `variant` (`default`, `sm`) | `forwardRef`. Wraps `.card` / `.card-sm`. |

Variant maps are plain `Record<Variant, string>` objects combined with `clsx`.

## Migration status

Done in this change: the four primitives above and this document.

Not yet done (tracked by the open issue):

- `IconButton`, `AmountInput`, `Select`, `Checkbox`/`Radio`, `Tabs`, `Tooltip`.
- Migrating `SwapCard`, `SettingsPanel`, `ConnectWalletButton`, `Nav` and the
  Explore page to these primitives, with before/after screenshots.
- A codemod or checklist for replacing repeated class strings.
- A lint rule that forbids raw hex colours in `src/components/**`.
- Stories and axe checks for each primitive.
