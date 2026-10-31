# Design notes

Theme **Marigold Paper**, chosen by the owner on 2026-11-01 from three options (the others were Ivory and Emerald, and Festival Night). Why: most screens are dense planning views (budgets, timelines, checklists), and a warm neutral canvas with one action colour keeps them calm and readable for every kind of event.

Style traits borrowed (not brand identity) from the awesome-design-md library (VoltAgent, MIT): Airbnb's single action colour on a clean canvas and soft 8/14 px radii; Pinterest's warm cream chrome and quiet hairlines.

## Tokens

All colours are semantic tokens in `app/globals.css`, with separate light and dark values (`prefers-color-scheme`). Components never use raw colours.

| Token                                             | Light   | Dark    | Role                                  |
| ------------------------------------------------- | ------- | ------- | ------------------------------------- |
| `--bg`                                            | #fffcf7 | #191613 | Page                                  |
| `--surface`                                       | #ffffff | #231f1b | Cards, panels                         |
| `--text`                                          | #22201c | #f5efe6 | Body text                             |
| `--muted`                                         | #5f584e | #bdb3a6 | Secondary text                        |
| `--accent`                                        | #b9400b | #f59a52 | Primary action only                   |
| `--danger` / `--warning` / `--success` / `--info` | see CSS | see CSS | Status, always with an icon and words |

Contrast is checked by `e2e/a11y.spec.ts` (axe, light and dark), and every text pair is at least 4.5:1.

## Type and space

- Fraunces (headings, 500/600) and Source Sans 3 (body, 400/600), self-hosted by `next/font`.
- Type scale 1.25 from 16 px; space scale 4, 8, 12, 16, 24, 32, 48, 64.

## Reading order

- **Home:** headline and promise, then "Start a plan", then the live sample plan beside it.
- **Plan:** event name and countdown, then the most urgent flag, then the next tasks; tabs hold the detail.
- **New plan:** the current step's question, then its fields, then Continue.

## Interaction rules

- Tabs follow the WAI-ARIA APG pattern (arrow keys, Home, End).
- Every control is at least 44 px tall; focus is a 3 px outline in `--focus`.
- Status never relies on colour: each flag has an icon and a word (Critical, Warning, Note).
- Motion: entrances ease out, under 200 ms, and are disabled by `prefers-reduced-motion`.
- AI changes are shown as a list and applied only when the user presses Apply.
