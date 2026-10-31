"use client";

import { daysBetween } from "@/lib/engine/dates";
import type { Draft } from "@/lib/draft";
import { formatINR, parseAmount } from "@/lib/engine/money";
import { PLATE_COST } from "@/lib/engine/insights";
import {
  CITY_TIERS,
  EVENT_TYPES,
  PREFERENCES,
  PRIORITIES,
  SETTINGS,
  type EventInput,
  type Preference,
  type Priority,
} from "@/lib/engine/types";
import { EVENT_LABEL, PREFERENCE_LABEL, PRIORITY_LABEL, SETTING_LABEL, TIER_LABEL } from "@/lib/labels";
import { LIMITS } from "@/lib/schema";
import { Choice, RadioGroup, TextField } from "./fields";
import styles from "./wizard.module.css";

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
      <fieldset className="field">
        <legend>What are you celebrating?</legend>
        <div className="choices">
          {EVENT_TYPES.map((t) => (
            <Choice
              key={t}
              type="radio"
              name="type"
              value={t}
              checked={draft.type === t}
              onChange={() => set("type", t)}
            >
              {EVENT_LABEL[t].name}
              <small>{EVENT_LABEL[t].hint}</small>
            </Choice>
          ))}
        </div>
      </fieldset>
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

export function WhenWhereStep({ draft, set, err, uid, today }: StepProps) {
  const days = draft.date >= today ? daysBetween(today, draft.date) : null;
  return (
    <>
      <div className={styles.two}>
        <TextField
          id={`${uid}-date`}
          type="date"
          label="Date"
          value={draft.date}
          min={today}
          error={err("date")}
          onChange={(v) => set("date", v)}
          hint={days !== null ? `${days} days from today` : undefined}
        />
        <TextField
          id={`${uid}-time`}
          type="time"
          label="Start time"
          value={draft.startTime}
          error={err("startTime")}
          onChange={(v) => set("startTime", v)}
        />
      </div>
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

export function GuestsBudgetStep({ draft, set, err, uid }: StepProps) {
  const guests = Number(draft.guests);
  const budget = parseAmount(draft.budget) ?? 0;
  const perGuest = guests > 0 && budget > 0 ? budget / guests : 0;

  const togglePriority = (p: Priority) =>
    set(
      "priorities",
      draft.priorities.includes(p)
        ? draft.priorities.filter((x) => x !== p)
        : [...draft.priorities, p].slice(0, LIMITS.priorities),
    );
  const togglePreference = (p: Preference) =>
    set(
      "preferences",
      draft.preferences.includes(p) ? draft.preferences.filter((x) => x !== p) : [...draft.preferences, p],
    );

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
