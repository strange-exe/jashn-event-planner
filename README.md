# Jashn: celebration and event planner

**Chosen vertical:** Celebration & Event Planning assistant.

**Live demo:** https://jashn.abhinesh.codes/

Jashn helps people organise weddings, engagements, birthdays, anniversaries, community events and festival gatherings in India. Describe the event in about two minutes and get:

- a **budget split** that always adds up to your total, with the reason behind every line;
- a **dated timeline**, back-scheduled from the event day and squeezed sensibly when time is short;
- a **vendor checklist** with "book by" dates and the questions to ask each vendor;
- **quantities** (plates, chairs, staff, water, parking) worked out from your headcount;
- **risk flags** such as a food budget below local norms, the monsoon, late-night music limits or a rushed date;
- **personalised ideas** from Gemini;
- an **assistant** that understands requests like "cut the budget by 15% and add 30 guests" and proposes changes you approve.

## Approach and logic

The design rule is that **rules decide and the model suggests**. LLMs are good at language and ideas, and unreliable at arithmetic and consistency, so the work is split between two layers.

```
event details ──> rule engine (lib/engine) ──> budget, timeline, vendors, quantities, flags
      ^                                                      │
      │ approved changes                                     v
assistant (Gemini) <── "cut budget by 10%" ──  user  ──>  ideas (Gemini)
```

1. **Deterministic engine** (`lib/engine/`, pure TypeScript, no dependencies). The same input always gives the same plan.
   - _Budget_ (`budget.ts`) starts from typical shares for the event type. It then adjusts for context:
     - outdoor events add a tent, power and a weather buffer;
     - your top three priorities get +30%, +20% and +10%;
     - an already-booked venue is removed from the budget;
     - contingency is never cut.

     A largest-remainder split makes the lines sum **exactly** to the total. Lines you edit are locked and the others rebalance. If your locked lines exceed the total, the overspend is reported, never hidden.

   - _Timeline_ (`timeline.ts`) scales wedding-length lead times by event type. When the date is close, an **order-preserving** mapping squeezes long-lead tasks into the time left, so "book the venue" never lands after "chase RSVPs". Each task is marked "pulled forward" when that happens.
   - _Vendors and quantities_ (`vendors.ts`) are chosen from context: a baker for birthdays, a tent and generator for outdoor events, security and sanitation for large public events, and extra questions for vegetarian, eco-friendly or step-free needs. Booking deadlines come from the matching timeline task.
   - _Flags_ (`insights.ts`) are small, readable rules, each with a suggestion. Examples: food budget per guest against typical cost by city size, the monsoon (June to September), peak wedding season, music after 10 pm (Noise Pollution Rules, 2000), large crowds, overspend.
2. **GenAI layer** (`lib/ai/`, Gemini through `@google/genai`).
   - The **assistant** receives the event details and a plan summary. It returns structured JSON: a reply plus _changes to the event details_ (for example `scaleBudget -10`), never new numbers. Each change is validated with Zod against strict limits and shown in plain words. It is applied only when the user presses **Apply**, and then the engine recomputes everything.
   - **Ideas** are generated to fit the guest count, budget per guest, setting, style and every stated preference.
   - **Fallbacks:** without an API key, or if the model fails, the assistant uses a built-in parser for common requests (`intent.ts`) and ideas come from a curated list. The app works fully offline, and the UI says which source answered.

## How the solution works

| Route                                    | Purpose                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                      | What it does, with a live sample plan computed by the engine                                                                                                                             |
| `/plan/new`                              | Three-step form: occasion, when and where, then guests, budget, priorities and preferences. It shows live per-guest cost and inline validation                                           |
| `/plans/[id]`                            | Dashboard with tabs for Overview, Budget, Timeline (plus a run sheet for the day), Vendors and Ideas, and the assistant beside them. Also calendar export (.ics), print, edit and delete |
| `/plans`                                 | Saved plans                                                                                                                                                                              |
| `POST /api/assistant`, `POST /api/ideas` | Server routes that hold the API key, validate input and rate-limit                                                                                                                       |

Plans are stored in the browser's `localStorage`, so there is no account and no database.

## Assumptions

- **Audience:** planners in India. Amounts are in rupees, with lakh/crore input ("3 lakh", "80k"), and dates use the IST calendar.
- **Budget shares, per-plate costs and lead times** are planning heuristics written down in code (`BASE_SHARES`, `PLATE_COST`, `LEAD_SCALE`). They are not market data. The UI asks users to confirm prices locally.
- **Quantities** use common rules of thumb (5% plate buffer, one server per 25 guests, about 3 guests per car), and each is shown with its reasoning.
- **No religion or customs are assumed.** Traditions appear only when the user mentions them, and the priest or officiant entry says to skip it if not needed.
- **No vendor names or live prices.** The model is told not to invent businesses or quote prices as fact.
- **Storage:** plans live in one browser. Clearing site data removes them.

## Security

- **API key:** read only on the server (`lib/ai/gemini.ts`) and never sent to the client. Without a key the app falls back to rules.
- **Input validation:** every request body is size-capped at 16 KB and validated with Zod. Text is stripped of control and bidi characters.
- **Model output:** treated as untrusted. It is schema-validated, out-of-range changes are dropped, and everything is rendered as text, never HTML.
- **Prompt injection:** user text is fenced as data, and the system prompt says to ignore instructions inside it. Validation and the approval step limit the damage if that fails.
- **Rate limiting:** per client (default 12 requests per minute). It is in-memory, so it is per server instance.
- **Headers:** a per-request nonce CSP (`proxy.ts`) with no `unsafe-inline`/`unsafe-eval` for scripts, `object-src 'none'` and `frame-ancestors 'none'`, plus `nosniff`, a strict referrer policy, HSTS and a Permissions-Policy. Zod runs in `jitless` mode so it never needs `eval`.
- **Production build:** no source maps, and `console` is stripped except errors.

## Accessibility

- WCAG 2.2 AA is checked with axe on every page and dashboard tab, in light and dark mode, at 390 px and 1440 px.
- The tabs follow the WAI-ARIA pattern (arrow keys, Home, End). The form moves focus to each step's heading and to the first invalid field, and errors are tied to fields with `aria-describedby`.
- Status always has an icon and a word, never colour alone. Controls are at least 44 px tall, and focus rings are visible.
- `prefers-reduced-motion` is respected. There is a print stylesheet, and no horizontal scroll at 390 px.

Design tokens and decisions are in [docs/design.md](docs/design.md).

## Run locally

Requires Node 22.13 or newer.

```bash
npm install
cp .env.example .env.local   # optional: add GEMINI_API_KEY from https://aistudio.google.com/apikey
npm run dev                  # http://localhost:3000
```

## Tests

```bash
npm test            # 112 unit tests: budget maths, timeline squeeze, vendors, flags, intent parser, every assistant change, validation, saved-plan storage, wizard drafts, API client and route guards, AI fallbacks with a fake model, rate limiting, .ics
npm run test:coverage  # the same with coverage of lib/ (about 95% of lines; CI fails below 90%)
npm run test:e2e    # Playwright (production build): flows, axe in light/dark at 390 and 1440 px, CSP and API hardening, XSS payloads (Chromium, Firefox, WebKit)
npm run lint        # ESLint, zero warnings
npm run format:check  # Prettier
npm run check       # all of the above plus the production build
npm run typecheck
```

GitHub Actions runs all of them on every push. Run `npx playwright install` once before the e2e tests.

## Deploy (Vercel)

1. Import this repository in Vercel. The framework is detected as Next.js.
2. Add the environment variable `GEMINI_API_KEY`.
3. Deploy.

## Project layout

```
app/                 pages and API routes
components/          wizard, dashboard, tabs, panels, assistant
lib/engine/          the rule engine (pure functions) and the offline intent parser
lib/ai/              Gemini client with model fallback, prompts, request handlers
lib/schema.ts        Zod schemas for input and assistant changes
lib/store.ts         localStorage persistence (validated on read)
tests/               Vitest unit tests
e2e/                 Playwright tests
```

## Known limitations

- Cost heuristics are national rules of thumb, not live vendor prices.
- The rate limiter is in-memory, so on serverless hosts it blunts bursts rather than enforcing a global cap.
- Plans do not sync across devices.

## Stack

Next.js 16 (App Router), React 19, TypeScript, `@google/genai` (Gemini), Zod 4, Vitest, Playwright with axe-core.

## License

MIT
