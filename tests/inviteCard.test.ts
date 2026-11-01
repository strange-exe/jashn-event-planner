import { describe, expect, it } from "vitest";
import type { EventInput } from "@/lib/engine/types";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardData,
  cardDate,
  cardText,
  drawInviteCard,
  type InviteCardData,
} from "@/lib/inviteCard";

const TODAY = "2027-01-10";

const base: EventInput = {
  type: "wedding",
  title: "Asha and Rohan",
  date: "2027-06-25",
  days: 2,
  functions: [],
  startTime: "18:30",
  city: "Jaipur",
  cityTier: "large",
  guests: 200,
  budget: 2_000_000,
  setting: "either",
  venueBooked: false,
  priorities: [],
  preferences: [],
  style: "",
  notes: "",
};

const wedding: EventInput = {
  ...base,
  functions: [
    { kind: "reception", day: 2, startTime: "19:00" },
    { kind: "sangeet", day: 1, startTime: "19:30" },
    { kind: "haldi", day: 1, startTime: "10:00" },
    { kind: "wedding", day: 2, startTime: "11:00" },
  ],
};

const plain = (s: string) => s.replace(/\s+/g, " ");

describe("cardData", () => {
  it("lists every function by day then time, with day 2 on the next date", () => {
    const d = cardData(wedding, TODAY, "all", {});
    expect(d.lines.map((l) => l.label)).toEqual(["Haldi", "Sangeet", "Wedding ceremony", "Reception"]);
    expect(plain(d.lines[0]!.when)).toBe("Fri, 25 Jun 2027, 10:00 am");
    expect(plain(d.lines[1]!.when)).toBe("Fri, 25 Jun 2027, 7:30 pm");
    expect(plain(d.lines[2]!.when)).toBe("Sat, 26 Jun 2027, 11:00 am");
    expect(plain(d.lines[3]!.when)).toBe("Sat, 26 Jun 2027, 7:00 pm");
    expect(d.heading).toBe("Asha and Rohan");
    expect(d.city).toBe("Jaipur");
  });

  it("shows only the chosen function for a single scope", () => {
    const d = cardData(wedding, TODAY, "reception", {});
    expect(d.lines).toEqual([{ label: "Reception", when: expect.stringContaining("26 Jun 2027") }]);
  });

  it("falls back to the whole celebration when the scope is not one of the functions", () => {
    expect(cardData(wedding, TODAY, "cocktail", {}).lines).toHaveLength(4);
  });

  it("gives a single event one line with its date and time", () => {
    const d = cardData({ ...base, type: "birthday", title: "Meera turns 7" }, TODAY, "all", {});
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]!.label).toBe("Birthday");
    expect(plain(d.lines[0]!.when)).toBe("Fri, 25 Jun 2027, 6:30 pm");
  });

  it("ignores functions on events that are not weddings", () => {
    const d = cardData({ ...wedding, type: "community" }, TODAY, "all", {});
    expect(d.lines.map((l) => l.label)).toEqual(["Community event"]);
  });

  it("picks the default line by event type", () => {
    for (const type of ["wedding", "engagement", "anniversary"] as const) {
      expect(cardData({ ...base, type }, TODAY, "all", {}).subline).toBe("request the pleasure of your company");
    }
    for (const type of ["birthday", "community", "festival"] as const) {
      expect(cardData({ ...base, type }, TODAY, "all", {}).subline).toBe("you are invited");
    }
  });

  it("asks for a reply by the RSVP date, and drops the footer once it has passed", () => {
    // Weddings ask 21 days ahead: 25 Jun - 21 = 4 Jun.
    expect(plain(cardData(base, TODAY, "all", {}).footer)).toBe("Kindly reply by Fri, 4 Jun 2027");
    expect(cardData(base, "2027-06-20", "all", {}).footer).toBe("");
  });

  it("keeps the host's own wording, including an empty line", () => {
    const d = cardData(base, TODAY, "all", { subline: "join us", footer: "" });
    expect(d.subline).toBe("join us");
    expect(d.footer).toBe("");
  });

  it("cleans unsafe characters and clamps long text", () => {
    const rlo = String.fromCodePoint(0x202e);
    const d = cardData({ ...base, title: `Asha${rlo} and   Rohan`, city: `Jai${rlo}pur` }, TODAY, "all", {
      subline: "x".repeat(200),
      footer: `y${rlo}`.repeat(200),
    });
    expect(d.heading).toBe("Asha and Rohan");
    expect(d.city).toBe("Jai pur");
    expect(d.subline).toHaveLength(80);
    expect(d.footer.length).toBeLessThanOrEqual(120);
    for (const s of [d.heading, d.subline, d.city, d.footer]) {
      expect([...s].filter((c) => c.codePointAt(0) === 0x202e)).toEqual([]);
    }
    expect(cardData({ ...base, title: "a".repeat(300) }, TODAY, "all", {}).heading).toHaveLength(80);
  });

  it("formats dates without the comma before the year", () => {
    expect(cardDate("2027-06-26")).toBe("Sat, 26 Jun 2027");
  });

  it("makes plain share text from the card", () => {
    const text = cardText(cardData(wedding, TODAY, "haldi", {}));
    expect(plain(text)).toBe("Asha and Rohan Haldi: Fri, 25 Jun 2027, 10:00 am Jaipur");
    expect(text.split("\n")).toHaveLength(3);
  });
});

interface Call {
  text: string;
  x: number;
  y: number;
  maxWidth?: number;
  font: string;
}

/** A canvas context that records text and measures each character as wide as the font size. */
function fakeCtx() {
  const texts: Call[] = [];
  const noop = () => {};
  const ctx = {
    font: "10px sans-serif",
    fillStyle: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10);
      return { width: text.length * size * 0.6 };
    },
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      texts.push({ text, x, y, maxWidth, font: ctx.font });
    },
    createRadialGradient: () => ({ addColorStop: noop }),
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    fill: noop,
    fillRect: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

const FONTS = { head: "Head", body: "Body" };

function draw(data: InviteCardData) {
  const { ctx, texts } = fakeCtx();
  drawInviteCard(ctx, data, FONTS);
  return texts;
}

function expectInside(texts: Call[]) {
  for (const t of texts) {
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x).toBeLessThanOrEqual(CARD_WIDTH);
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.y).toBeLessThan(CARD_HEIGHT);
    expect(t.maxWidth).toBeLessThanOrEqual(CARD_WIDTH - 2 * 96);
  }
}

describe("drawInviteCard", () => {
  it("draws the heading, every line, the city and the footer inside the card", () => {
    const data = cardData(wedding, TODAY, "all", {});
    const texts = draw(data);
    const all = texts.map((t) => t.text).join(" ");
    expect(all).toContain(data.heading);
    for (const l of data.lines) {
      expect(all).toContain(l.label);
      expect(all).toContain(l.when);
    }
    expect(all).toContain(data.city);
    expect(all).toContain(data.footer);
    expect(texts.find((t) => t.text === data.heading)?.font).toMatch(/^600 \d+px Head$/);
    expectInside(texts);
  });

  it("wraps and shrinks a long heading and six lines so nothing leaves the card", () => {
    const data: InviteCardData = {
      heading: "A".repeat(10) + " " + "very long names for a family celebration that goes on ".repeat(2),
      subline: "request the pleasure of your company at every one of these",
      city: "Thiruvananthapuram, Kerala, at the old palace grounds",
      lines: Array.from({ length: 6 }, (_, i) => ({ label: `Function ${i + 1}`, when: "Sat, 26 Jun 2027, 11:00 am" })),
      footer: "Kindly reply by Fri, 4 Jun 2027 to the family on the numbers you already have",
    };
    const texts = draw(data);
    expectInside(texts);
    for (let i = 1; i <= 6; i++) expect(texts.some((t) => t.text === `Function ${i}`)).toBe(true);
    // The heading never takes more than three lines.
    expect(texts.filter((t) => t.font.includes("Head")).length).toBeLessThanOrEqual(3);
    // Every line fits the text width at the size it was drawn.
    for (const t of texts) {
      const size = Number(/(\d+)px/.exec(t.font)?.[1]);
      expect(t.text.length * size * 0.6).toBeLessThanOrEqual(CARD_WIDTH - 2 * 96);
    }
  });

  it("splits a single word too long for one line", () => {
    const texts = draw({ heading: "x".repeat(80), subline: "", city: "", lines: [], footer: "" });
    expectInside(texts);
    expect(texts.length).toBeGreaterThan(1);
  });
});
