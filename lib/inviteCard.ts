import { addDays } from "./engine/dates";
import type { EventFunction, EventInput, EventType, FunctionKind } from "./engine/types";
import { inviteTime, rsvpBy } from "./invite";
import { EVENT_LABEL, FUNCTION_LABEL } from "./labels";
import { cleanText } from "./schema";

// The invitation as an image: the words come from the event details, and the
// drawing is a "Dusk doorway" card (a marigold toran above, diyas below) that
// can be saved or shared to WhatsApp.

export interface InviteCardLine {
  label: string;
  when: string;
}

export interface InviteCardData {
  heading: string;
  subline: string;
  city: string;
  lines: InviteCardLine[];
  footer: string;
}

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const MAX = { heading: 80, subline: 80, footer: 120, city: 80, line: 60 } as const;

/** Clean text cut to a length, never through the middle of a character. */
function clamp(s: string, max: number): string {
  return Array.from(cleanText(s)).slice(0, max).join("").trim();
}

const FORMAL: ReadonlySet<EventType> = new Set(["wedding", "engagement", "anniversary"]);

export function defaultSubline(type: EventType): string {
  return FORMAL.has(type) ? "request the pleasure of your company" : "you are invited";
}

const SHORT_DATE = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "Fri, 25 Jun 2027". */
export function cardDate(iso: string): string {
  const parts = SHORT_DATE.formatToParts(new Date(`${iso}T00:00:00Z`));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`;
}

/** The functions a card can list, by day then time. Only weddings have them. */
export function cardFunctions(input: EventInput): EventFunction[] {
  if (input.type !== "wedding") return [];
  return [...input.functions].sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));
}

const when = (date: string, time: string) => clamp(`${cardDate(date)}, ${inviteTime(time, "en")}`, MAX.line);

export function defaultFooter(input: EventInput, today: string): string {
  const by = rsvpBy(input, today);
  return by ? `Kindly reply by ${cardDate(by)}` : "";
}

/** The words on the card. A scope that is not one of the event's functions shows the whole celebration. */
export function cardData(
  input: EventInput,
  today: string,
  scope: "all" | FunctionKind,
  opts: { subline?: string; footer?: string },
): InviteCardData {
  const functions = cardFunctions(input);
  const chosen = functions.filter((f) => f.kind === scope);
  const shown = chosen.length > 0 ? chosen : functions;
  const lines: InviteCardLine[] =
    shown.length > 0
      ? shown.map((f) => ({
          label: FUNCTION_LABEL[f.kind].name,
          when: when(addDays(input.date, f.day - 1), f.startTime),
        }))
      : [{ label: EVENT_LABEL[input.type].name, when: when(input.date, input.startTime) }];
  return {
    heading: clamp(input.title, MAX.heading),
    subline: clamp(opts.subline ?? defaultSubline(input.type), MAX.subline),
    city: clamp(input.city, MAX.city),
    lines,
    footer: clamp(opts.footer ?? defaultFooter(input, today), MAX.footer),
  };
}

/** The card as plain text, for the message that goes with the image. */
export function cardText(data: InviteCardData): string {
  return [data.heading, ...data.lines.map((l) => `${l.label}: ${l.when}`), data.city].filter(Boolean).join("\n");
}

// Drawing ------------------------------------------------------------------

const C = {
  dusk: "#1f1712",
  ink: "#f6eee4",
  soft: "#d9cbbb",
  marigold: "#f3a73b",
  deep: "#e8961f",
  leaf: "#5f7a3a",
} as const;

const MARGIN = 96;
const TEXT_WIDTH = CARD_WIDTH - 2 * MARGIN;
/** Where the calm space below the toran starts and the diya row begins. */
const TEXT_TOP = 330;
const DIYA_Y = CARD_HEIGHT - MARGIN - 40;
const TEXT_BOTTOM = DIYA_Y - 90;

/** A small seeded generator, so the same card draws the same garland every time. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Breaks text into lines no wider than `max`; a word too long for a line is split by characters. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const ch of Array.from(word)) {
      if (line && ctx.measureText(line + ch).width > max) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** At most `count` lines; the last one ends in "..." when text was cut. */
function limit(ctx: CanvasRenderingContext2D, lines: string[], count: number, max: number): string[] {
  if (lines.length <= count) return lines;
  const kept = lines.slice(0, count);
  let last = `${kept[count - 1]}...`;
  while (last.length > 3 && ctx.measureText(last).width > max) last = `${last.slice(0, -4).trimEnd()}...`;
  kept[count - 1] = last;
  return kept;
}

interface TextOp {
  kind: "text";
  text: string;
  font: string;
  color: string;
  /** Top of the line box. */
  y: number;
  size: number;
}
interface RuleOp {
  kind: "rule";
  y: number;
}
type Op = TextOp | RuleOp;

/** Lays out the text at a given scale; returns the operations and the total height. */
function layout(ctx: CanvasRenderingContext2D, data: InviteCardData, fonts: { head: string; body: string }, k: number) {
  const ops: Op[] = [];
  let y = 0;
  const many = data.lines.length > 3;
  const block = (text: string, font: string, size: number, color: string, maxLines: number, lead = 1.25) => {
    if (!text) return;
    ctx.font = font;
    for (const t of limit(ctx, wrap(ctx, text, TEXT_WIDTH), maxLines, TEXT_WIDTH)) {
      ops.push({ kind: "text", text: t, font, color, y, size });
      y += size * lead;
    }
  };
  const body = (size: number) => `400 ${Math.round(size)}px ${fonts.body}`;

  block(data.subline, body(34 * k), 34 * k, C.soft, 2);
  y += 18 * k;

  // The heading shrinks until it fits in three lines (or reaches its smallest size).
  let hs = 76 * k;
  ctx.font = `600 ${Math.round(hs)}px ${fonts.head}`;
  while (hs > 48 * k && wrap(ctx, data.heading, TEXT_WIDTH).length > 3) {
    hs -= 4;
    ctx.font = `600 ${Math.round(hs)}px ${fonts.head}`;
  }
  block(data.heading, `600 ${Math.round(hs)}px ${fonts.head}`, hs, C.ink, 3, 1.12);

  y += 30 * k;
  ops.push({ kind: "rule", y });
  y += 44 * k;

  const ls = (many ? 26 : 30) * k;
  const ws = (many ? 30 : 36) * k;
  data.lines.forEach((line, i) => {
    if (i > 0) y += (many ? 14 : 28) * k;
    block(line.label, `600 ${Math.round(ls)}px ${fonts.body}`, ls, C.marigold, 1);
    y += 2 * k;
    block(line.when, body(ws), ws, C.ink, 2);
  });

  if (data.city) {
    y += 30 * k;
    block(data.city, body(34 * k), 34 * k, C.ink, 2);
  }
  if (data.footer) {
    y += 26 * k;
    block(data.footer, body(28 * k), 28 * k, C.soft, 2);
  }
  return { ops, height: y };
}

function marigold(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rand: () => number) {
  ctx.fillStyle = rand() < 0.5 ? C.marigold : C.deep;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Ruffled petals: a ring of small bumps, then a darker heart.
  ctx.fillStyle = C.deep;
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2 + rand();
    ctx.beginPath();
    ctx.arc(x + Math.cos(t) * r * 0.55, y + Math.sin(t) * r * 0.55, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = C.marigold;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function mangoLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, tilt: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = C.leaf;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.36, len * 0.45, 0, len);
  ctx.quadraticCurveTo(-len * 0.36, len * 0.45, 0, 0);
  ctx.fill();
  ctx.restore();
}

/** The garland across the top: a sagging rope of marigolds, mango leaves, and hanging strands. */
function toran(ctx: CanvasRenderingContext2D) {
  const rand = lcg(20271125);
  const sagAt = (x: number) => 64 + 54 * Math.sin((Math.PI * x) / CARD_WIDTH);

  // Leaves sit behind the flowers, pointing down from the rope.
  for (let x = 30; x < CARD_WIDTH; x += 72) {
    mangoLeaf(ctx, x, sagAt(x) + 6, 58 + rand() * 14, (rand() - 0.5) * 0.5);
  }
  // Hanging strands, symmetric about the centre so the doorway feels balanced.
  for (const x of [150, 330, 540, 750, 930]) {
    const top = sagAt(x) + 20;
    const count = x === 540 ? 6 : 4 + Math.round(rand());
    for (let i = 0; i < count; i++) marigold(ctx, x, top + i * 26, 13, rand);
    mangoLeaf(ctx, x, top + count * 26 - 6, 34, 0);
  }
  // The rope itself: overlapping discs.
  for (let x = -10; x <= CARD_WIDTH + 10; x += 30) {
    marigold(ctx, x, sagAt(x), 22 + rand() * 5, rand);
  }
}

function diya(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const glow = ctx.createRadialGradient(x, y - 34, 0, x, y - 34, 58);
  glow.addColorStop(0, "rgba(243, 167, 59, 0.32)");
  glow.addColorStop(1, "rgba(243, 167, 59, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 60, y - 94, 120, 120);

  // Bowl: a shallow cup with a lip at the spout.
  ctx.fillStyle = C.deep;
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 10);
  ctx.quadraticCurveTo(x, y + 30, x + 34, y - 10);
  ctx.lineTo(x + 42, y - 16);
  ctx.closePath();
  ctx.fill();

  // Flame: a teardrop with a pale core.
  ctx.fillStyle = C.marigold;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 58);
  ctx.quadraticCurveTo(x + 16, y - 28, x + 4, y - 16);
  ctx.quadraticCurveTo(x - 8, y - 28, x + 4, y - 58);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 40);
  ctx.quadraticCurveTo(x + 9, y - 26, x + 4, y - 20);
  ctx.quadraticCurveTo(x - 1, y - 26, x + 4, y - 40);
  ctx.fill();
}

/** Draws the whole card onto a CARD_WIDTH x CARD_HEIGHT canvas. */
export function drawInviteCard(
  ctx: CanvasRenderingContext2D,
  data: InviteCardData,
  fonts: { head: string; body: string },
): void {
  ctx.save();
  ctx.fillStyle = C.dusk;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  toran(ctx);

  // Shrink everything together until the text fits the space between garland and lamps.
  const room = TEXT_BOTTOM - TEXT_TOP;
  let k = 1;
  let result = layout(ctx, data, fonts, k);
  while (result.height > room && k > 0.55) {
    k -= 0.05;
    result = layout(ctx, data, fonts, k);
  }
  const top = TEXT_TOP + Math.max(0, (room - result.height) / 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const cx = CARD_WIDTH / 2;
  for (const op of result.ops) {
    if (op.kind === "rule") {
      ctx.fillStyle = C.marigold;
      ctx.fillRect(cx - 60, top + op.y, 120, 3);
      continue;
    }
    ctx.font = op.font;
    ctx.fillStyle = op.color;
    // maxWidth makes the canvas squeeze any line that still measures too wide.
    ctx.fillText(op.text, cx, top + op.y, TEXT_WIDTH);
  }

  for (let i = 0; i < 5; i++) diya(ctx, cx + (i - 2) * 120, DIYA_Y);
  ctx.restore();
}
