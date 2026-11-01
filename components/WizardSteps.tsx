"use client";

import { addDays, daysBetween, isValidDate } from "@/lib/engine/dates";
import { hasFunctions, type Draft, type DraftFunction } from "@/lib/draft";
import { formatINR, parseAmount } from "@/lib/engine/money";
import { PLATE_COST } from "@/lib/engine/costs";
import {
  CITY_TIERS,
  EVENT_TYPES,
  FUNCTION_KINDS,
  MAX_DAYS,
  PREFERENCES,
  PRIORITIES,
  SETTINGS,
  type EventInput,
  type FunctionKind,
  type Preference,
  type Priority,
} from "@/lib/engine/types";
import {
  EVENT_LABEL,
  formatDate,
  FUNCTION_LABEL,
  PREFERENCE_LABEL,
  PRIORITY_LABEL,
  SETTING_LABEL,
  TIER_LABEL,
} from "@/lib/labels";
import { LIMITS } from "@/lib/schema";
import { FieldError } from "./feedback";
import { Choice, RadioGroup, TextField } from "./fields";
import styles from "./wizard.module.css";

/** Removes the item if present, otherwise appends it, keeping the list's order. */
const toggleItem = <T,>(list: T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export interface StepProps {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  /** The error to show for a field, or undefined while errors are hidden. */
  err: (field: keyof EventInput) => string | undefined;
  uid: string;
  today: string;
}

export function OccasionStep({ draft, set, err, uid }: StepProps) {
  return (
    <>
      <RadioGroup
        label="What are you celebrating?"
        name="type"
        options={EVENT_TYPES.map((t) => ({ value: t, label: EVENT_LABEL[t].name, hint: EVENT_LABEL[t].hint }))}
        value={draft.type}
        onChange={(v) => set("type", v)}
      />
      <TextField
        id={`${uid}-title`}
        label="Name of the event"
        hint="For example: Aarav turns 7, or Green Park Diwali Mela"
        value={draft.title}
        error={err("title")}
        onChange={(v) => set("title", v)}
        maxLength={LIMITS.title}
        autoComplete="off"
      />
    </>
  );
}

// Where each function usually falls: its time, and its day counted from the first (1)
// or, for the wedding and reception, from the last.
const FUNCTION_DEFAULTS: Record<FunctionKind, { time: string; day: (days: number) => number }> = {
  haldi: { time: "10:00", day: () => 1 },
  mehendi: { time: "16:00", day: () => 1 },
  sangeet: { time: "19:00", day: (d) => Math.min(2, d) },
  cocktail: { time: "20:00", day: (d) => Math.min(2, d) },
  wedding: { time: "18:00", day: (d) => d },
  reception: { time: "19:30", day: (d) => d },
};

export function WhenWhereStep({ draft, set, err, uid, today }: StepProps) {
  const away = draft.date >= today ? daysBetween(today, draft.date) : null;
  const multi = hasFunctions(draft.type);
  const withFunctions = multi && draft.functions.length > 0;

  const setDays = (days: number) => {
    set("days", days);
    set(
      "functions",
      draft.functions.map((f) => ({ ...f, day: Math.min(f.day, days) })),
    );
  };

  return (
    <>
      {multi && (
        <RadioGroup
          label="How many days?"
          hint="Haldi, mehendi and sangeet often fall on the days before the wedding."
          name="days"
          options={Array.from({ length: MAX_DAYS }, (_, i) => ({
            value: String(i + 1),
            label: i === 0 ? "1 day" : `${i + 1} days`,
          }))}
          value={String(draft.days)}
          onChange={(v) => setDays(Number(v))}
        />
      )}
      <div className={styles.two}>
        <TextField
          id={`${uid}-date`}
          type="date"
          label={multi && draft.days > 1 ? "First day" : "Date"}
          value={draft.date}
          min={today}
          error={err("date")}
          onChange={(v) => set("date", v)}
          hint={away !== null ? `${away} days from today` : undefined}
        />
        {!withFunctions && (
          <TextField
            id={`${uid}-time`}
            type="time"
            label="Start time"
            value={draft.startTime}
            error={err("startTime")}
            onChange={(v) => set("startTime", v)}
          />
        )}
      </div>
      {multi && <FunctionsField draft={draft} set={set} err={err} uid={uid} today={today} />}
      <TextField
        id={`${uid}-city`}
        label="City or town"
        value={draft.city}
        error={err("city")}
        onChange={(v) => set("city", v)}
        maxLength={LIMITS.city}
        autoComplete="address-level2"
      />
      <RadioGroup
        label="City size"
        hint="Used to estimate local prices."
        name="tier"
        options={CITY_TIERS.map((t) => ({ value: t, label: TIER_LABEL[t].name, hint: TIER_LABEL[t].hint }))}
        value={draft.cityTier}
        onChange={(v) => set("cityTier", v)}
      />
      <RadioGroup
        label="Setting"
        name="setting"
        options={SETTINGS.map((s) => ({ value: s, label: SETTING_LABEL[s] }))}
        value={draft.setting}
        onChange={(v) => set("setting", v)}
      />
      <Choice type="checkbox" checked={draft.venueBooked} onChange={() => set("venueBooked", !draft.venueBooked)}>
        The venue is already arranged
        <small>Its cost will be left out of the budget.</small>
      </Choice>
    </>
  );
}

/** Pick the functions of a wedding and place each on a day and time. */
function FunctionsField({ draft, set, err, uid }: StepProps) {
  const find = (k: FunctionKind) => draft.functions.find((f) => f.kind === k);
  const toggle = (k: FunctionKind) =>
    set(
      "functions",
      find(k)
        ? draft.functions.filter((f) => f.kind !== k)
        : [
            ...draft.functions,
            { kind: k, day: FUNCTION_DEFAULTS[k].day(draft.days), startTime: FUNCTION_DEFAULTS[k].time, guests: "" },
          ],
    );
  const patch = (k: FunctionKind, change: Partial<DraftFunction>) =>
    set(
      "functions",
      draft.functions.map((f) => (f.kind === k ? { ...f, ...change } : f)),
    );
  const dayLabel = (d: number) =>
    draft.days > 1 && isValidDate(draft.date) ? `Day ${d}, ${formatDate(addDays(draft.date, d - 1))}` : `Day ${d}`;
  const error = err("functions");

  return (
    <fieldset className="field" aria-describedby={error ? `${uid}-fn-error` : undefined}>
      <legend>
        Functions{" "}
        <span className="hint">Pick the ones you are hosting. Leave all unticked for a single gathering.</span>
      </legend>
      <ul className={styles.functions}>
        {FUNCTION_KINDS.map((k) => {
          const f = find(k);
          const name = FUNCTION_LABEL[k].name;
          return (
            <li key={k}>
              <Choice type="checkbox" checked={Boolean(f)} onChange={() => toggle(k)}>
                {name}
                <small>{FUNCTION_LABEL[k].hint}</small>
              </Choice>
              {f && (
                <div className={styles.functionRow}>
                  {draft.days > 1 && (
                    <div className="field">
                      <label htmlFor={`${uid}-${k}-day`}>
                        <span className="sr-only">{name} </span>Day
                      </label>
                      <select
                        id={`${uid}-${k}-day`}
                        className="input"
                        value={f.day}
                        onChange={(e) => patch(k, { day: Number(e.target.value) })}
                      >
                        {Array.from({ length: draft.days }, (_, i) => (
                          <option key={i} value={i + 1}>
                            {dayLabel(i + 1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor={`${uid}-${k}-time`}>
                      <span className="sr-only">{name} </span>Starts
                    </label>
                    <input
                      id={`${uid}-${k}-time`}
                      type="time"
                      className="input"
                      value={f.startTime}
                      onChange={(e) => patch(k, { startTime: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${uid}-${k}-guests`}>
                      <span className="sr-only">{name} </span>Guests
                    </label>
                    <input
                      id={`${uid}-${k}-guests`}
                      className="input"
                      inputMode="numeric"
                      placeholder="Everyone"
                      value={f.guests}
                      onChange={(e) => patch(k, { guests: e.target.value.replace(/[^\d]/g, "") })}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <FieldError id={`${uid}-fn-error`}>{error}</FieldError>}
    </fieldset>
  );
}

export function GuestsBudgetStep({ draft, set, err, uid }: StepProps) {
  const guests = Number(draft.guests);
  const budget = parseAmount(draft.budget) ?? 0;
  const perGuest = guests > 0 && budget > 0 ? budget / guests : 0;

  const togglePriority = (p: Priority) =>
    set("priorities", toggleItem(draft.priorities, p).slice(0, LIMITS.priorities));
  const togglePreference = (p: Preference) => set("preferences", toggleItem(draft.preferences, p));

  return (
    <>
      <div className={styles.two}>
        <TextField
          id={`${uid}-guests`}
          label="Guests"
          inputMode="numeric"
          value={draft.guests}
          error={err("guests")}
          onChange={(v) => set("guests", v.replace(/[^\d]/g, ""))}
          autoComplete="off"
        />
        <TextField
          id={`${uid}-budget`}
          label="Total budget (rupees)"
          hint="Numbers or words like 3 lakh or 80k"
          value={draft.budget}
          error={err("budget")}
          onChange={(v) => set("budget", v)}
          autoComplete="off"
        />
      </div>
      {perGuest > 0 && (
        <p className={styles.live} role="status">
          About <strong className="num">{formatINR(perGuest)}</strong> per guest in total. Food alone for a{" "}
          {EVENT_LABEL[draft.type].name.toLowerCase()} in a {TIER_LABEL[draft.cityTier].name.toLowerCase()} usually
          costs around {formatINR(PLATE_COST[draft.type][draft.cityTier])} per guest.
        </p>
      )}
      <fieldset className="field">
        <legend>
          What matters most? <span className="hint">Pick up to {LIMITS.priorities}, in order</span>
        </legend>
        <div className="choices">
          {PRIORITIES.map((p) => {
            const rank = draft.priorities.indexOf(p);
            return (
              <Choice
                key={p}
                type="checkbox"
                checked={rank >= 0}
                disabled={rank < 0 && draft.priorities.length >= LIMITS.priorities}
                onChange={() => togglePriority(p)}
                mark={rank >= 0 ? <span className={styles.rank}>{rank + 1}</span> : null}
              >
                {PRIORITY_LABEL[p]}
                {rank >= 0 && <span className="sr-only">, priority {rank + 1}</span>}
              </Choice>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>Anything we should plan around?</legend>
        <div className="choices">
          {PREFERENCES.map((p) => (
            <Choice
              key={p}
              type="checkbox"
              checked={draft.preferences.includes(p)}
              onChange={() => togglePreference(p)}
            >
              {PREFERENCE_LABEL[p]}
            </Choice>
          ))}
        </div>
      </fieldset>
      <TextField
        id={`${uid}-style`}
        label="Style or theme (optional)"
        hint="For example: pastel garden, retro Bollywood, minimal white"
        value={draft.style}
        error={err("style")}
        onChange={(v) => set("style", v)}
        maxLength={LIMITS.style}
      />
      <TextField
        id={`${uid}-notes`}
        label="Anything else? (optional)"
        hint="Traditions, the guest of honour, constraints. Shared with the AI assistant."
        value={draft.notes}
        error={err("notes")}
        onChange={(v) => set("notes", v)}
        maxLength={LIMITS.notes}
        multiline
      />
    </>
  );
}
