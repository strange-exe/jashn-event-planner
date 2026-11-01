# Design notes

Theme **Dusk doorway**, chosen by the owner on 2026-11-01 ("A Dusk doorway") from three rendered options; the
others were Wedding card (Wired and Oura traits) and Festival colour (Mastercard and The Verge traits). It replaces
Marigold Paper. Why: the first screen should feel like arriving at a celebration, and the app screens should stay
calm and dense. A dusk scene carries all the colour; everything after it is quiet.

Style traits borrowed (not brand identity) from the awesome-design-md library (VoltAgent, MIT, fetched
2026-11-01): Apple's single full-bleed scene where the chrome steps back and the headline sits in space the image
leaves; Spotify's dark stage where the artwork carries the colour and the controls stay neutral.

### Unslop audit before the redesign (2026-11-01)

Heavy slop, so the full passes ran: a template split hero with a 33-word lede and a fine-print line under two
buttons; the toran as decoration in the padding; numbered 1-2-3 step circles; four equal feature blocks; four
equal stat boxes; Fraunces (a default display serif); a cream and clay palette (the default premium-consumer
family).

### Direction

- **Product:** plans weddings, birthdays and community events in India, budget to the rupee, for the family doing it.
- **Character:** warm, exact, festive without noise.
- **World:** a doorway at dusk dressed for a celebration: carved teak, a marigold toran, diyas, a rangoli.
- **Moments:** the doorway scene on the home page, and the dusk header with the countdown on each plan.
- **Signature:** the saffron countdown figure, used only for the date that matters.

## Redesign (2026-11-01, after the competition)

The owner asked to improve the visuals and features for real use, keeping Marigold Paper. Chosen on 2026-11-01:

- **Features:** guest list with RSVPs, spend tracker (planned vs paid), read-only share link, WhatsApp invite writer.
- **3D hero:** yes. A marigold toran and lit diyas in three.js, loaded after the page, with a still poster
  for reduced motion and browsers without WebGL.
- **Direction:** warm, exact, festive without noise. World: torans, diyas, wedding-card paper. Moments: the
  toran hero and the budget ring. Signature: a small marigold that blooms when a task is ticked.

**Revision (2026-11-01, owner):** "not satisfied with the design". The hero looked cheap (a garland strip
and a row of diyas added over the old template), still generic, too flat, and the app screens were untouched.
Chosen direction: **Doorway scene**. One full-bleed dusk scene: a carved door frame, the toran across its
lintel, diyas and a petal rangoli on the threshold, and the headline in the calm space of the opening. Plan
and new-plan pages get a compact dusk header with the same toran. The dusk band uses the dark tokens locally,
so text contrast holds in both themes, and it fades into the page instead of ending on a hard edge.

## Tokens

All colours are semantic tokens in `app/globals.css`, with separate light and dark values (`prefers-color-scheme`). Components never use raw colours.

| Token                                             | Light                       | Dark    | Role                                     |
| ------------------------------------------------- | --------------------------- | ------- | ---------------------------------------- |
| `--bg`                                            | #f7f6f3                     | #141210 | Page                                     |
| `--surface`                                       | #ffffff                     | #1d1a17 | Cards, panels                            |
| `--text`                                          | #1d1b19                     | #f3eee8 | Body text                                |
| `--muted`                                         | #5d5852                     | #b9b1a7 | Secondary text                           |
| `--accent`                                        | #f3a73b                     | #f3a73b | Primary action fill, with `#22150b` text |
| `--accent-ink`                                    | #94580a                     | #f6b85c | Accent as text, selection lines, bars    |
| `--dusk` / `--dusk-ink` / `--dusk-soft`           | #1f1712 / #f6eee4 / #d9cbbb | same    | The dusk bands, in both themes           |
| `--danger` / `--warning` / `--success` / `--info` | see CSS                     | see CSS | Status, always with an icon and words    |

Contrast, computed by script on 2026-11-01 (all AA): light text 15.9 on page, muted 6.5, accent ink 5.3,
button label 8.8 on saffron, bar 4.7 on its track; dark text 16.2, muted 8.8, accent ink 10.6; dusk text 15.4,
dusk secondary 11.1, saffron on dusk 8.7. `e2e/a11y.spec.ts` re-checks the rendered pages with axe in both themes.
Saffron is never text on a light surface; `--accent-ink` is.

## Type and space

- Hanken Grotesk (headings, 500/600) and Source Sans 3 (body, 400/600), self-hosted by `next/font`.
- Type scale 1.25 from 16 px; space scale 4, 8, 12, 16, 24, 32, 48, 64.
- Radii: controls 8 px, cards 14 px. Hairlines group content; a card only where it lifts above the dusk band.

## Reading order

- **Home:** the doorway and the headline inside it, then "Start a plan", then the sample plan rising from the
  bottom of the scene (its countdown first, then the money).
- **Plan:** the dusk header (event name, then the countdown), then the four figures, then the tabs.
- **New plan:** the current step's question, then its fields, then Continue.

## 3D

The home scene is real-time three.js (`components/hero/toranScene.ts`), loaded with a dynamic import after the
page is idle, so the headline never waits for it. The text sits on the solid dusk colour of the door opening, so
it reads with or without the canvas. Without WebGL the band shows a drawn garland on the same dusk colour; with
reduced motion the scene renders one still frame. A plan page gets the dusk colour band only, with no canvas:
people work on that screen for a long time, so it carries no GPU load.

## Interaction rules

- Tabs follow the WAI-ARIA APG pattern (arrow keys, Home, End).
- Every control is at least 44 px tall; focus is a 3 px outline in `--focus`.
- Status never relies on colour: each flag has an icon and a word (Critical, Warning, Note).
- Motion: entrances ease out, under 200 ms, and are disabled by `prefers-reduced-motion`.
- AI changes are shown as a list and applied only when the user presses Apply.
