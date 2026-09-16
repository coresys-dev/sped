# SLDR — UI/UX Design System

Reference doc to replicate SLDR's visual identity in another app. Everything except **accent**, **accent-muted**, the **font family**, and the favicon-level branding is fixed — those are the only things that should change per-app.

---

## 1. Stack

- Tailwind CSS v4 (`@import "tailwindcss";` + `@theme {}` token block in a single CSS file — no `tailwind.config.js` needed).
- Font: **self-hosted, no CDN, no network call at runtime — always**. Which font is per-app (SLDR currently uses Sora, a sans-serif on Google Fonts, bundled via `@fontsource/sora`; it previously used Nohemi and, before that, the monospace IBM Plex Mono — the identity changes per project, the hosting method doesn't). Two ways to self-host, pick whichever fits the font:
  - **On a registry** (e.g. Google Fonts) → use `@fontsource/<name>` (`npm install @fontsource/<name>`, then `import "@fontsource/<name>/<weight>.css"` per weight in `main.tsx`).
  - **Not on any registry** (a purchased/custom font, `.ttf`/`.otf`/`.woff2`) → bundle the font files directly under `src/assets/fonts/<name>/` and declare your own `@font-face` rules in the CSS token file (see the block below) — no extra package needed, and this is the only way to bundle a `.ttf`. Convert to `.woff2` first if you're only given a `.ttf`/`.otf` (smaller, purpose-built for the web); a *variable* font is unnecessary bundling weight unless you actually need in-between weights — prefer 2-3 static weight files if that's all the UI uses.
  ```css
  /* index.css (or wherever the @theme block lives) */
  @font-face {
    font-family: "YourFont";
    src: url("./assets/fonts/yourfont/YourFont-Regular.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  /* repeat per weight actually used (e.g. 500, 700) */
  ```
- **Vertical metrics correction — evaluate this for every font.** Flex/grid centering positions text by its *line box* (ascent + descent + line-gap), not by the visible ink. Almost every Latin font has ascent noticeably bigger than descent, so centered text reads as sitting above the container's true center — most visible on all-caps pill/label text (no real descenders to occupy the bottom of the box) and on text sitting next to an already-optically-centered icon. Fix both halves:
  1. **Override the font's own metrics** in every `@font-face` rule you control, from *measured* values, not guesses (SLDR skips this step: `@fontsource/sora` owns the `@font-face` rules and Sora's native metrics are balanced enough that only the step-2 nudge is needed). Unzip the `.woff2` back to `.ttf`/`.otf` (e.g. the `wawoff2` npm package), then read `unitsPerEm` (`head` table), `sTypoAscender`/`sTypoDescender`/`sTypoLineGap` (`OS/2` table — or `hhea`'s equivalents if `OS/2.fsSelection`'s `USE_TYPO_METRICS` bit, `0x80`, isn't set), and the `glyf` bounding boxes of a few descender letters (`g`/`y`/`j`/`p`/`q`) and accented capitals, each as a % of `unitsPerEm`. Set `line-gap-override: 0%` (pure dead space between lines — always safe to remove) and pick `ascent-override`/`descent-override` tight enough to trim real excess, but never smaller than what you actually measured on those glyphs — undershooting clips real descenders/accents in normal (non-centering-sensitive) text elsewhere in the app.
     ```css
     @font-face {
       font-family: "YourFont";
       src: url("./assets/fonts/yourfont/YourFont-Regular.woff2") format("woff2");
       font-weight: 400;
       ascent-override: 75%;   /* measured, per font */
       descent-override: 21%;  /* measured, per font */
       line-gap-override: 0%;  /* always safe */
     }
     ```
  2. **That alone won't fully recenter all-caps or icon-adjacent text** — the ascent/descent *asymmetry* is inherent to the font's design, not just excess padding; shrinking it enough to fully cancel would clip real descenders elsewhere. Add a small `em`-relative nudge utility instead, and apply it to the *text node only* (never an adjacent icon) in every such row:
     ```css
     .optical-center-text {
       display: inline-block;
       transform: translateY(0.08em); /* recompute per font, see below */
     }
     ```
     Derive the offset from the font's own metrics: `(capHeight/2 − (ascent − descent)/2) / fontSize`, all as fractions of `unitsPerEm` — comes out to ~6% for SLDR's Sora (it was ~8% for the earlier Nohemi). Being `em`-relative, one number covers every text size it's applied at. Wrap the label in pills, icon+text nav/settings rows, and any short all-caps chip: `<span className="optical-center-text">{label}</span>`.
- Icons: **lucide-react** exclusively — no other icon set.
- Shared, variant-driven primitives via **class-variance-authority** (`cva`) for anything reused more than once or twice (`Button`, `IconButton`, `Badge`, `Card`) — see §6. One-off elements (pills, rows) stay hand-rolled Tailwind strings; don't over-abstract those into components just for the sake of it.
- Theme switching via `[data-theme="light"]` attribute on `<html>`, default is dark (`:root { color-scheme: dark; }`).

```bash
npm install class-variance-authority lucide-react
# + @fontsource/<name> only if the chosen font is on a font registry
```

---

## 2. Color tokens

Defined once as CSS custom properties in a Tailwind `@theme` block, consumed everywhere via generated utility classes (`bg-bg`, `bg-surface`, `text-text`, `border-border`, `text-accent`, …). Re-theming the whole app means changing values here — never hardcode colors in components.

**Base colors (dark) — always identical across apps:**

```css
@theme {
  --color-bg: #000000;
  --color-surface: #0a0a0a;
  --color-surface-raised: #141414;
  --color-surface-hover: #121212;
  --color-border: #1f1f1f;
  --color-text: #f5f5f5;
  --color-text-muted: #8e8e93;

  /* Per-app — the only tokens allowed to change */
  --color-accent: #34d399;
  --color-accent-muted: #1c4a3a;

  /* Fixed secondary/status colors — same across apps */
  --color-accent-2: #fbbf24;
  --color-accent-2-muted: #4a3510;
  --color-danger: #f87171;
  --color-danger-muted: #3f1d1d;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 14px;

  --shadow-card: 0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 4px 12px -4px rgba(0, 0, 0, 0.5);
  --shadow-float: 0 8px 16px -4px rgba(0, 0, 0, 0.55), 0 24px 48px -12px rgba(0, 0, 0, 0.65);
}
```

**Base colors (light) — always identical across apps:**

```css
[data-theme="light"] {
  color-scheme: light;
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-surface-raised: #f9fafb;
  --color-surface-hover: #f3f4f6;
  --color-border: #e5e7eb;
  --color-text: #111111;
  --color-text-muted: #6b7280;

  --color-accent: #059669;
  --color-accent-muted: #d1fae5;

  --color-accent-2: #d97706;
  --color-accent-2-muted: #fef3c7;
  --color-danger: #dc2626;
  --color-danger-muted: #fee2e2;

  --shadow-card: 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 4px 12px -4px rgba(0, 0, 0, 0.08);
  --shadow-float: 0 8px 16px -4px rgba(0, 0, 0, 0.08), 0 24px 48px -12px rgba(0, 0, 0, 0.12);
}
```

**Token usage:**

| Token | Role |
|---|---|
| `bg` | App canvas — pure black (dark) / near-white (light). Floating panels sit *over* this, never fill the whole viewport with `surface`. |
| `surface` | Floating panels: sidebar, tab bar, bottom player, modals, toasts, dropdowns, popovers, window controls. |
| `surface-raised` | Fields sitting *inside* an already-transparent header/toolbar (search input, filter-pill strip, sort dropdown) — one step lighter than `surface` so they read against `bg` without a boxed parent behind them. Also used for `Card`. |
| `surface-hover` | Hover state for surfaces, progress bar tracks, secondary buttons/pills. |
| `border` | All 1px borders — panel edges, dividers, scrollbar thumb, resting button borders. |
| `text` | Primary text. |
| `text-muted` | Secondary text, placeholders, icons at rest, labels, timestamps. |
| `accent` | Active/selected state, primary CTA fill/border, focus ring, playing state, favorited state. |
| `accent-muted` | Selected row/pill background (paired with `accent` text), text selection background. |
| `accent-2` / `accent-2-muted` | Secondary status accent — "attention"/warning tone, distinct from both `accent` (success/active) and `danger` (destructive). Used sparingly (e.g. a warning badge). |
| `danger` / `danger-muted` | Destructive actions and errors only (delete buttons, error toasts, danger badges). |

`accent-muted`/`accent-2-muted`/`danger-muted` should each be a low-saturation tint of their paired color at roughly 15-20% perceived strength against `surface` — enough to read as "selected"/"warning"/"destructive" without competing with `text`.

---

## 3. Typography

- Single font family everywhere, one deliberate typeface — don't mix in a second family for body text. SLDR currently uses **Sora** (sans-serif, self-hosted via `@fontsource/sora`, see §1); pick whatever fits the new app's identity, but stay consistent app-wide.
- Fallback stack: match the chosen font's category — a sans-serif font falls back to `ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`; a monospace one (SLDR's previous choice, IBM Plex Mono) would instead fall back to `ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Roboto Mono", "Liberation Mono", monospace`.
- `-webkit-font-smoothing: antialiased;` on `body`.
- Scale used across the app (Tailwind classes, no custom scale needed):
  - `text-xs` (12px) — labels, meta info, secondary buttons, uppercase pills, counters
  - `text-sm` (14px) — default body/UI text
  - `text-base` (16px) — primary content emphasis (search input, list row titles)
  - `text-xl` (20px) — hero/identity text only (the sidebar's word-roller logo)
- Weight: default regular; `font-medium` for emphasis (titles, active labels, filenames); `font-semibold`/`font-bold` reserved for the identity roller and single-letter/initial avatars. No bold body text.
- Uppercase + `tracking-wide` for small labels/pills/section headers (`text-xs font-medium uppercase tracking-wide`).

---

## 4. Layout & spacing

### 4.1 Shell: floating islands over a black canvas

The app shell is **not** a set of flush, edge-to-edge bars. Every piece of chrome — sidebar, tab bar, window controls, bottom player — is its own detached, rounded, shadowed card floating over a pure `bg`-colored canvas, all sharing the same inset margin so they read as one coherent dock system rather than separate widgets:

- **Margin**: `12px` (`FLOAT_PANEL_MARGIN`/`m-3`) between a floating panel and the window edge, and between adjacent panels. A panel that borders the *main content column* (not a window edge) stays flush there — e.g. the sidebar has margin on top/left/bottom but not on its right edge, since that edge meets the content area, not open canvas.
- **Radius**: `rounded-lg` (14px) on every floating panel (sidebar, tab bar, window-controls island, bottom player, modals, toasts, dropdowns, popovers). This is the single "elevated card" radius — don't introduce a bigger one; going rounder than 14px reads as bubbly rather than "pro tool."
- **Shadow**: `shadow-float` on every floating panel. `shadow-card` is reserved for small, non-floating chips (`Card`) that sit flush in normal flow.
- **Fill**: `bg-surface` on floating panels themselves; anything living *inside* a panel that still needs to read as a distinct field (search input, filter pills, dropdowns) steps up to `bg-surface-raised` instead of repeating `bg-surface` or falling back to `bg-bg`.
- **Window chrome**: no *visible* native title bar or traffic lights on any platform, but the two platforms get there differently — don't copy the Windows/Linux approach onto macOS, it loses the native rounded corners/shadow:
  - **Windows/Linux**: `"decorations": false` in the window config. Fully custom chrome — window controls are a small reconstructed minimize/maximize/close cluster (see `WindowControls`), always presented as its own floating island in the top-right corner (of the tab bar when one exists, of a bare drag-strip otherwise).
  - **macOS**: decorations stay **on** — `"titleBarStyle": "Overlay"` + `"hiddenTitle": true` in the window config — specifically to keep the native rounded window corners and drop shadow, which a fully undecorated (`decorations:false`) window loses on macOS. The title text is hidden and the *native* traffic-light buttons are kept (not reconstructed in JS) but repositioned via a native call (`position_traffic_lights`, implemented Rust-side) to land inside that same floating-island rectangle — the frontend reports the island's screen rect every render/resize (`useNativeTrafficLights`) so the traffic lights track it exactly instead of a hard-coded offset. Reserve the island's width even before the native buttons paint into it (`MACOS_TRAFFIC_LIGHTS_WIDTH`, ≈72px) so the layout doesn't jump.
  - Either way, the control cluster is presented as one consistent floating island — the platform difference is *which* buttons render inside it, not where or how the island itself looks.
- **Drag regions**: the empty margin gutters between floating panels and the window edge are still marked as OS drag regions (`data-tauri-drag-region` or platform equivalent) so the window remains movable from the "dead" black space, not just from inside a panel.

### 4.2 Sidebar collapse: shrink to an icon rail, don't disappear

A collapsible sidebar should collapse to a slim floating icon-only rail (~64px), not vanish to zero width. Crossfade between the full content and the compact rail (both absolutely stacked, opacity-toggled together with the width transition) rather than unmounting one and mounting the other — keeps the transition smooth and avoids re-triggering child mount effects. In the compact rail:
- Any multi-letter identity/roller text shrinks to initials (e.g. a 4-word rolling logo becomes 4 single letters — same animation, same step count, just shorter words).
- Every row becomes an icon-only square button (same fixed hitbox size as the full-width row's icon, e.g. `h-9 w-9`), with the label moved to a `title`/`aria-label` tooltip.
- List items with a user-choosable icon show that icon; items without one fall back to their first letter/initial as a text avatar, never their full name.
- Anything that doesn't fit a slim rail (secondary status indicators, multi-line content) is simply omitted in collapsed mode rather than crammed in.

### 4.3 Spacing & radius scale

- Spacing scale: stick to Tailwind's default steps (`gap-1`, `gap-2`, `gap-3`, `p-3`, `px-4`, `py-3`, etc.) — nothing custom besides the `12px` floating-panel margin above.
- Border radius — exactly three steps, no more:
  - `rounded-sm` (4px) — pills/segmented-control buttons, tags, small nav rows (sidebar tree items), inline rename inputs.
  - `rounded-md` (8px) — buttons, icon buttons, text inputs/dropdowns/pill-strip containers, compact list rows.
  - `rounded-lg` (14px) — every floating panel (see §4.1): modals, toasts, dropdowns, popovers, comfortable-density list rows, `Card`.
- Borders: 1px `border-border` on virtually every panel boundary and resting button/input state.

---

## 5. Motion

Single shared easing curve for every animation — this is what makes transitions feel like one system instead of ad-hoc CSS.

```css
:root {
  --ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);
}
```

- Color/background/border transitions: `transition-colors` / `transition-all duration-150` to `duration-200`.
- Interactive press feedback: `active:scale-95` (buttons/pills) or `active:scale-90` (icon buttons) or `active:scale-[0.98]` (full-width buttons).
- Panel collapse/resize (sidebar): width/opacity animated over `280ms var(--ease-in-out-quart)`; skip the transition entirely while actively dragging.
- **Scroll-position-driven fade masks**, not static overlays: where a scrollable list sits directly under borderless chrome (e.g. a floating search bar with no background of its own), don't paint a permanent gradient overlay at the top of the list — it ends up dimming content that's already at rest, not just content scrolling away. Instead track the scroll container's `scrollTop`, and drive the mask's opacity from it (e.g. `opacity = min(scrollTop / 32, 1)`), so the fade is invisible until the user actually scrolls and only ever covers content that's genuinely sliding out of view.
- Modal enter:
  ```css
  @keyframes modal-in { from { opacity:0; transform:scale(0.96) translateY(4px);} to { opacity:1; transform:scale(1) translateY(0);} }
  @keyframes overlay-in { from { opacity:0;} to { opacity:1;} }
  .animate-modal-in { animation: modal-in 200ms var(--ease-in-out-quart); }
  .animate-overlay-in { animation: overlay-in 200ms var(--ease-in-out-quart); }
  ```
- Toast enter:
  ```css
  @keyframes toast-in { from { opacity:0; transform:translateY(8px) scale(0.98);} to { opacity:1; transform:translateY(0) scale(1);} }
  .animate-toast-in { animation: toast-in 220ms var(--ease-in-out-quart); }
  ```
  Auto-dismiss after ~6s.
- Element-by-element entrance (sidebar rows, home content, once a startup splash hands off):
  ```css
  @keyframes item-in { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
  .animate-item-in { animation: item-in 320ms var(--ease-in-out-quart) both; }
  ```
  Stagger via an inline `animation-delay` per row, not separate keyframes.
- Result-list entrance (audio file rows — new search/filter, infinite-scroll page): same `.animate-item-in` keyframe, but a tighter, **capped** stagger (`RESULT_ITEM_STAGGER_MS` = 30ms, `RESULT_ITEM_STAGGER_CAP` = 10 rows) — an uncapped `index * delay` would leave rows past the fold invisible for seconds on a long result list. Being a CSS animation tied to mount, it naturally replays on a new search/filter/page without any extra "revealed" state, and does not replay on selection changes since the row's DOM node is reused.
- Favorite star toggle: a quick scale "pop" (1 → 1.3 → 1, 260ms) on the false→true transition only, never on initial mount of an already-favorited row:
  ```css
  @keyframes favorite-pop { 0% { transform:scale(1);} 40% { transform:scale(1.3);} 100% { transform:scale(1);} }
  .animate-favorite-pop { animation: favorite-pop 260ms var(--ease-in-out-quart); }
  ```
- Play/pause icon swap: crossfade (opacity + scale, 150ms) between two stacked icons instead of an instant swap.

### 5.1 Startup sequence

The most distinctive "premium" motion in the app isn't any single micro-interaction — it's the choreographed handoff from splash screen to shell on launch. Don't skip this when replicating the app; a flat "splash disappears, app appears" reads noticeably cheaper.

1. **Rolling identity** — a full-screen overlay (`bg-bg`, centered) shows the app's word-roller logo (see `SloganTicker`/`TICKER_WORDS`) cycling through its words on a repeating vertical roll, centered on screen:
   ```css
   @keyframes roll-words {
     0%, 17.5%  { transform: translateY(0); }
     25%, 42.5% { transform: translateY(-1.75rem); }  /* one h-7 step per word */
     50%, 67.5% { transform: translateY(-3.5rem); }
     75%, 92.5% { transform: translateY(-5.25rem); }
     100%       { transform: translateY(-7rem); }      /* loops back to word 1 */
   }
   .animate-roll-words { animation: roll-words 5s var(--ease-in-out-quart) infinite; }
   ```
   This keeps rolling for at least one full cycle even if data is already loaded — always release at a cycle boundary (word back to its first frame) so the next phase never jump-cuts mid-roll.
2. **Slide into place** — once data is ready *and* a cycle boundary is hit, the overlay's ticker box animates a `transform: translate(dx, dy)` (computed from `getBoundingClientRect()` of the overlay vs. its real destination in the sidebar — not a guessed offset) over ~450ms, landing exactly on the sidebar's real logo slot.
3. **Crossfade handoff** — as the slide finishes, the overlay fades out (~200ms) while the real app shell (sidebar background, still otherwise empty) is simultaneously revealed underneath — the two are timed to cross, not sequenced, so there's no blank frame between "splash" and "app."
4. **Shell builds itself, in order**, each stage gated on the previous one finishing rather than fired all at once:
   - Sidebar **background** slides in from the left (~650ms, `SIDEBAR_BG_SLIDE_MS`).
   - The window-controls island fades/drops in (`chrome-in`, below) exactly when the sidebar background starts its slide.
   - Sidebar **content** builds row by row (`.animate-item-in`, `ITEM_STAGGER_MS` = 90ms per row) once the background slide completes.
   - The home search bar reveals last (`reveal-mask`, below), timed to start once the sidebar's last row has finished animating in (`lastRowIndex * ITEM_STAGGER_MS + ITEM_ANIM_MS`).
   Deliberately slow and staged, not instant — the point is to *watch* the shell assemble once, not to minimize time-to-interactive.
   ```css
   @keyframes chrome-in {
     from { opacity: 0; transform: translateY(-10px) scale(0.92); }
     to   { opacity: 1; transform: translateY(0) scale(1); }
   }
   .animate-chrome-in { animation: chrome-in 420ms var(--ease-in-out-quart) both; }

   @keyframes reveal-mask {
     from { clip-path: inset(0 50% 0 50% round 0.5rem); } /* masked to a sliver at center */
     to   { clip-path: inset(0 0 0 0 round 0.5rem); }       /* fully unmasked */
   }
   .animate-reveal-mask { animation: reveal-mask <duration> var(--ease-in-out-quart) both; } /* duration driven in JS, e.g. HOME_REVEAL_MS = 600 */
   ```
   `reveal-mask` unveils the search field's entire body (border/fill/shadow) *and* its icon+text together, growing outward from the center — the text isn't typed into an already-visible box, the box itself is the mask the text appears through.
5. **Replays**: the rolling/slide/crossfade splash is a true one-time boot sequence (never replays). The per-row `item-in` stagger and `chrome-in` island reveal are tied to a `revealed` prop, not to component mount, and can legitimately replay later (e.g. `chrome-in` replays whenever `TitleBar` remounts on a view change) — that's intended: a small "welcome" gesture each time, not a one-shot flag to track everywhere.

---

## 6. Component patterns

Prefer a small shared `cva`-based primitive over copy-pasted class strings once a pattern repeats 3+ times across the app (buttons, icon buttons, badges). One-off elements (a single settings pill row, a single dropdown) can stay inline Tailwind strings — don't build a component for something used once.

**`Button` (cva variants: `primary` / `secondary` / `ghost` / `destructive`, sizes `sm` / `md`):**
```
inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150
  primary:     bg-accent text-bg hover:brightness-110 active:scale-[0.98]
  secondary:   border border-border bg-surface-raised text-text hover:bg-surface-hover active:scale-[0.98]
  ghost:       bg-transparent text-text-muted hover:bg-surface-hover hover:text-text active:scale-[0.98]
  destructive: border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 active:scale-[0.98]
  sm: h-8 px-3 text-xs   md: h-9 px-4 text-sm
```

**`IconButton` (cva variants: `ghost` / `solid` / `danger`, sizes `sm` / `md` / `lg`):**
```
inline-flex shrink-0 items-center justify-center rounded-md transition-all duration-150 active:scale-90
  ghost:  bg-transparent text-text-muted hover:bg-surface-hover hover:text-text
  solid:  border border-border text-text-muted hover:border-accent hover:text-accent
  danger: border border-border text-text-muted hover:border-danger/50 hover:text-danger
  sm: h-4 w-4   md: h-8 w-8   lg: h-10 w-10
```
A circular variant (transport/play button, floating collapse toggle) swaps `rounded-md` for `rounded-full` and adds an active/"on" glow: `border-accent text-accent` plus `box-shadow: 0_0_14px_-2px var(--color-accent)`.

**`Badge` (cva variants: `neutral` / `accent` / `attention` / `danger`):**
```
inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide
  neutral:   border border-border text-text-muted
  accent:    border border-accent/40 bg-accent-muted text-accent
  attention: border border-accent-2/40 bg-accent-2-muted text-accent-2
  danger:    border border-danger/40 bg-danger-muted text-danger
```

**`Card` (small non-floating chip, e.g. a credits row):**
```
rounded-lg bg-surface-raised shadow-card
```

**Pill / segmented control button** (category filters, format toggles, mode selectors, language switch):
```
rounded-sm px-3 py-1 text-xs font-medium uppercase tracking-wide transition-all duration-150 active:scale-95
```
Active state: `bg-accent-muted text-accent` (or `bg-danger/10 text-danger` for a deliberately dangerous option, e.g. an "unthrottled" mode). Inactive: `text-text-muted hover:text-text`. Wrap the group in `flex gap-1 rounded-md border border-border bg-surface-raised p-1`.

**Selected list row:** `bg-accent-muted ring-1 ring-accent/40` (never a solid `accent` fill on large surfaces — reserve full-strength accent for small/icon elements and text). Comfortable-density rows use `rounded-lg`; compact/table-style rows use `rounded-sm`.

**Text input:**
```
rounded-md border border-border bg-surface-raised py-3 px-4 text-base text-text outline-none
transition-shadow duration-200 placeholder:text-text-muted
focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-muted)]
```
Use `bg-surface-raised`, not `bg-bg` — a pure-black fill only works if the input is the *only* thing on that background; anywhere it shares a borderless header/toolbar with other controls (pills, a sort dropdown), all of them should share `bg-surface-raised` so they read as a coherent group.

**Switch (on/off toggle, never a checkbox):**
```
h-6 w-11 rounded-full transition-colors duration-200 — bg-accent when on, bg-surface-hover when off
```
Thumb: `h-5 w-5 rounded-full bg-white shadow`, translated via `transform: translateX(20px)` when on, `200ms var(--ease-in-out-quart)`.

**Modal:**
- Overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm`, `animate-overlay-in`, click-outside closes.
- Panel: `w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-float`, `animate-modal-in`, `role="dialog" aria-modal="true"`, stop propagation on click.
- Escape key closes.

**Toast:**
```
fixed bottom-4 right-4 z-50, stacked with gap-2
rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text shadow-float
animate-toast-in, auto-dismiss ~6s
```

**Dropdown / popover / context menu:**
```
rounded-lg border border-border bg-surface p-1 shadow-float
animate-modal-in
```

**Progress bar:**
```
h-1 w-full overflow-hidden rounded-full bg-surface-hover
  → inner fill: h-full bg-accent transition-all, width set inline as a percentage
```

**Section header (settings-style groupings):** `text-xs font-medium uppercase tracking-wide text-text-muted`, sections separated by `border-t border-border pt-4 mt-5`.

**Scrollbar (thin, unobtrusive):**
```css
* { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background-color: var(--color-border); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background-color: var(--color-text-muted); }
```

**Selection & focus:**
```css
::selection { background-color: var(--color-accent-muted); color: var(--color-text); }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
```

---

## 7. Principles

1. **One accent color, used sparingly.** It marks state (selected, active, playing, focused) — it is never a decorative fill on large areas. Everything else lives in the black/white/gray scale, with `accent-2`/`danger` reserved strictly for warning/destructive semantics, never as alternate decoration.
2. **No hardcoded colors in components.** Every color is a `--color-*` token consumed through Tailwind utility classes. Retheming = editing the `@theme` block, touching zero components.
3. **One easing curve, one small set of durations (150/200/220/280/320ms).** Consistency of motion matters more than variety.
4. **One typeface, everywhere, self-hosted.** Whichever font is chosen is the app's typographic signature — don't introduce a second family, and never load it from a CDN at runtime (see §1 for the two self-hosting paths).
5. **Chrome floats, content doesn't.** The window/app shell (sidebar, tab bar, window controls, bottom player) is a set of detached `shadow-float` cards over a pure-black canvas — depth *there* comes from real elevation, not just borders. Inside a panel, depth between adjacent content areas still comes from flat `border-border` + `surface`/`surface-hover` steps, not extra shadows; don't shadow something that isn't actually floating.
6. **Fully custom window chrome, never mixed with native.** No native title bar or traffic lights on any platform — one reconstructed control cluster, presented consistently as its own floating island everywhere it appears.
