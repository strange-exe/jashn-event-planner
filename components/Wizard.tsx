"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { addDays, daysBetween, todayIn } from "@/lib/engine/dates";
import { formatINR, parseAmount } from "@/lib/engine/money";
import { PLATE_COST } from "@/lib/engine/insights";
import {
  CITY_TIERS,
  EVENT_TYPES,
  PREFERENCES,
  PRIORITIES,
  SETTINGS,
  type EventInput,
  type EventType,
  type Preference,
  type Priority,
} from "@/lib/engine/types";
import { EVENT_LABEL, PREFERENCE_LABEL, PRIORITY_LABEL, SETTING_LABEL, TIER_LABEL } from "@/lib/labels";
import { sampleWedding } from "@/lib/sample";
import { EventInputSchema, LIMITS } from "@/lib/schema";
import { createPlan, updatePlan, usePlans } from "@/lib/store";
import styles from "./wizard.module.css";
import { Icon } from "./Icon";

interface Draft extends Omit<EventInput, "guests" | "budget"> {
  guests: string;
  budget: string;
}

const STEPS = ["Occasion", "When and where", "Guests, budget and style"] as const;

const STEP_FIELDS: (keyof EventInput)[][] = [
  ["type", "title"],
  ["date", "startTime", "city", "cityTier", "setting", "venueBooked"],
  ["guests", "budget", "priorities", "preferences", "style", "notes"],
];

function blank(today: string): Draft {
  return {
    type: "birthday", title: "", date: addDays(today, 45), startTime: "18:00", city: "", cityTier: "large",
    guests: "", budget: "", setting: "indoor", venueBooked: false, priorities: [], preferences: [], style: "", notes: "",
  };
}

function toDraft(i: EventInput): Draft {
  return { ...i, guests: String(i.guests), budget: String(i.budget) };
}

function toInput(d: Draft): unknown {
  const guests = Number(d.guests);
  return { ...d, guests: d.guests.trim() === "" ? NaN : guests, budget: parseAmount(d.budget) ?? NaN };
}

/** Readable message per field, from Zod issues plus checks that need today's date. */
function validate(d: Draft, today: string): Partial<Record<keyof EventInput, string>> {
  const errors: Partial<Record<keyof EventInput, string>> = {};
  const r = EventInputSchema.safeParse(toInput(d));
  if (!r.success) {
    for (const issue of r.error.issues) {
      const key = issue.path[0] as keyof EventInput;
      if (errors[key]) continue;
      errors[key] =
        key === "guests" ? `Enter between ${LIMITS.guests.min} and ${LIMITS.guests.max.toLocaleString("en-IN")} guests.`
        : key === "budget" ? `Enter a budget between ${formatINR(LIMITS.budget.min)} and ${formatINR(LIMITS.budget.max)}, for example 3 lakh.`
        : issue.message.startsWith("Too big") ? "That is too long." : issue.message;
    }
  }
  if (!errors.date && d.date < today) errors.date = "Pick today or a future date.";
  return errors;
}

export function Wizard({ sample, editId }: { sample: boolean; editId?: string }) {
  const router = useRouter();
  const plans = usePlans();
  const [today] = useState(() => todayIn());
  const [draft, setDraft] = useState<Draft>(() => blank(today));
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [loadedEdit, setLoadedEdit] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const uid = useId();

  // "Try a sample wedding" goes straight to a ready plan.
  useEffect(() => {
    if (!sample) return;
    const plan = createPlan(sampleWedding(today));
    router.replace(`/plans/${plan.id}`);
  }, [sample, today, router]);

  const editing = editId ? plans?.find((p) => p.id === editId) : undefined;
  if (editing && !loadedEdit) {
    setLoadedEdit(true);
    setDraft(toDraft(editing.input));
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const errors = validate(draft, today);
  const stepErrors = STEP_FIELDS[step].filter((f) => errors[f]);
  const err = (f: keyof EventInput) => (showErrors ? errors[f] : undefined);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function next() {
    if (stepErrors.length) {
      setShowErrors(true);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setShowErrors(false);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    const input = EventInputSchema.parse(toInput(draft));
    if (editing) {
      updatePlan(editing.id, (p) => ({ ...p, input, locks: {} }));
      router.push(`/plans/${editing.id}`);
    } else {
      router.push(`/plans/${createPlan(input).id}`);
    }
  }

  if (sample) return <p className="muted" role="status">Preparing the sample plan.</p>;

  const togglePriority = (p: Priority) =>
    set("priorities", draft.priorities.includes(p) ? draft.priorities.filter((x) => x !== p) : [...draft.priorities, p].slice(0, 3));
  const togglePref = (p: Preference) =>
    set("preferences", draft.preferences.includes(p) ? draft.preferences.filter((x) => x !== p) : [...draft.preferences, p]);

  const guests = Number(draft.guests);
  const budget = parseAmount(draft.budget) ?? 0;
  const perGuest = guests > 0 && budget > 0 ? budget / guests : 0;
  const days = draft.date >= today ? daysBetween(today, draft.date) : null;

  return (
    <div className={styles.wrap}>
      <ol className={styles.progress} aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? styles.done : undefined}>
            <span className={styles.dot} aria-hidden="true">{i < step ? <Icon name="check" /> : i + 1}</span>
            <span>{s}</span>
            {i < step && <span className="sr-only">(completed)</span>}
          </li>
        ))}
      </ol>

      <form
        className={`card stack ${styles.form}`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
          {editing ? `Edit: ${STEPS[step]}` : STEPS[step]}
        </h1>

        {step === 0 && (
          <>
            <fieldset className="field">
              <legend>What are you celebrating?</legend>
              <div className="choices">
                {EVENT_TYPES.map((t: EventType) => (
                  <label key={t} className="choice">
                    <input type="radio" name="type" value={t} checked={draft.type === t} onChange={() => set("type", t)} />
                    <span className="tick"><Icon name="check" /></span>
                    <span>{EVENT_LABEL[t].name}<small>{EVENT_LABEL[t].hint}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <TextField id={`${uid}-title`} label="Name of the event" hint="For example: Aarav turns 7, or Green Park Diwali Mela" value={draft.title} error={err("title")} onChange={(v) => set("title", v)} maxLength={LIMITS.title} autoComplete="off" />
          </>
        )}

        {step === 1 && (
          <>
            <div className={styles.two}>
              <TextField id={`${uid}-date`} type="date" label="Date" value={draft.date} min={today} error={err("date")} onChange={(v) => set("date", v)} hint={days !== null ? `${days} days from today` : undefined} />
              <TextField id={`${uid}-time`} type="time" label="Start time" value={draft.startTime} error={err("startTime")} onChange={(v) => set("startTime", v)} />
            </div>
            <TextField id={`${uid}-city`} label="City or town" value={draft.city} error={err("city")} onChange={(v) => set("city", v)} maxLength={LIMITS.city} autoComplete="address-level2" />
            <RadioGroup label="City size" hint="Used to estimate local prices." name="tier" options={CITY_TIERS.map((t) => ({ value: t, label: TIER_LABEL[t].name, hint: TIER_LABEL[t].hint }))} value={draft.cityTier} onChange={(v) => set("cityTier", v)} />
            <RadioGroup label="Setting" name="setting" options={SETTINGS.map((s) => ({ value: s, label: SETTING_LABEL[s] }))} value={draft.setting} onChange={(v) => set("setting", v)} />
            <label className="choice">
              <input type="checkbox" checked={draft.venueBooked} onChange={(e) => set("venueBooked", e.target.checked)} />
              <span className="tick"><Icon name="check" /></span>
              <span>The venue is already arranged<small>Its cost will be left out of the budget.</small></span>
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <div className={styles.two}>
              <TextField id={`${uid}-guests`} label="Guests" inputMode="numeric" value={draft.guests} error={err("guests")} onChange={(v) => set("guests", v.replace(/[^\d]/g, ""))} autoComplete="off" />
              <TextField id={`${uid}-budget`} label="Total budget (rupees)" hint="Numbers or words like 3 lakh or 80k" value={draft.budget} error={err("budget")} onChange={(v) => set("budget", v)} autoComplete="off" />
            </div>
            {perGuest > 0 && (
              <p className={styles.live} role="status">
                About <strong className="num">{formatINR(perGuest)}</strong> per guest in total. Food alone for a {EVENT_LABEL[draft.type].name.toLowerCase()} in a{" "}
                {TIER_LABEL[draft.cityTier].name.toLowerCase()} usually costs around {formatINR(PLATE_COST[draft.type][draft.cityTier])} per guest.
              </p>
            )}
            <fieldset className="field">
              <legend>What matters most? <span className="hint">Pick up to 3, in order</span></legend>
              <div className="choices">
                {PRIORITIES.map((p) => {
                  const rank = draft.priorities.indexOf(p);
                  return (
                    <label key={p} className="choice">
                      <input type="checkbox" checked={rank >= 0} disabled={rank < 0 && draft.priorities.length >= 3} onChange={() => togglePriority(p)} />
                      <span className="tick">{rank >= 0 ? <span className={styles.rank}>{rank + 1}</span> : null}</span>
                      <span>{PRIORITY_LABEL[p]}{rank >= 0 && <span className="sr-only">, priority {rank + 1}</span>}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend>Anything we should plan around?</legend>
              <div className="choices">
                {PREFERENCES.map((p) => (
                  <label key={p} className="choice">
                    <input type="checkbox" checked={draft.preferences.includes(p)} onChange={() => togglePref(p)} />
                    <span className="tick"><Icon name="check" /></span>
                    <span>{PREFERENCE_LABEL[p]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <TextField id={`${uid}-style`} label="Style or theme (optional)" hint="For example: pastel garden, retro Bollywood, minimal white" value={draft.style} error={err("style")} onChange={(v) => set("style", v)} maxLength={LIMITS.style} />
            <TextField id={`${uid}-notes`} label="Anything else? (optional)" hint="Traditions, the guest of honour, constraints. Shared with the AI assistant." value={draft.notes} error={err("notes")} onChange={(v) => set("notes", v)} maxLength={LIMITS.notes} multiline />
          </>
        )}

        {showErrors && stepErrors.length > 0 && (
          <p className="error" role="alert">
            <Icon name="stop" /> Fix {stepErrors.length === 1 ? "the highlighted field" : `the ${stepErrors.length} highlighted fields`} to continue.
          </p>
        )}

        <div className={`row spread ${styles.actions}`}>
          {step > 0 ? (
            <button type="button" className="btn btn-quiet" onClick={() => { setShowErrors(false); setStep(step - 1); }}>
              <Icon name="arrowLeft" /> Back
            </button>
          ) : <span />}
          <button type="submit" className="btn btn-primary">
            {step < STEPS.length - 1 ? "Continue" : editing ? "Update plan" : "Create my plan"} <Icon name="arrowRight" />
          </button>
        </div>
      </form>
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  type?: string;
  min?: string;
  maxLength?: number;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
  multiline?: boolean;
}

function TextField({ id, label, value, onChange, hint, error, multiline, ...rest }: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = { id, value, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, className: "input" };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
      {multiline ? (
        <textarea {...common} maxLength={rest.maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} {...rest} type={rest.type ?? "text"} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && (
        <span id={`${id}-error`} className="error"><Icon name="stop" />{error}</span>
      )}
    </div>
  );
}

function RadioGroup<T extends string>({ label, hint, name, options, value, onChange }: {
  label: string; hint?: string; name: string; options: { value: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{label} {hint && <span className="hint">{hint}</span>}</legend>
      <div className="choices">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="tick"><Icon name="check" /></span>
            <span>{o.label}{o.hint && <small>{o.hint}</small>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
