"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import {
  FOODS,
  groupsOf,
  GuestSchema,
  parseNames,
  plannedHeadcount,
  RSVPS,
  summarizeGuests,
  type Food,
  type Guest,
  type Rsvp,
} from "@/lib/guests";
import { FOOD_LABEL, RSVP_LABEL } from "@/lib/labels";
import { LIMITS } from "@/lib/schema";
import { updatePlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { FieldError } from "../feedback";
import { Icon } from "../Icon";
import { InviteCard } from "./InviteCard";
import { InviteImage } from "./InviteImage";
import { Card, type PanelProps } from "./shared";

const SEARCH_FROM = 12;

export function GuestsPanel({ plan, saved }: PanelProps) {
  const summary = useMemo(() => summarizeGuests(saved.guests), [saved.guests]);
  const groups = useMemo(() => groupsOf(saved.guests), [saved.guests]);
  const [show, setShow] = useState<Rsvp | "all">("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const uid = useId();

  const setGuests = (update: (g: Guest[]) => Guest[]) =>
    updatePlan(saved.id, (p) => ({ ...p, guests: update(p.guests).slice(0, LIMITS.savedGuests) }));

  const q = query.trim().toLowerCase();
  const visible = saved.guests.filter(
    (g) =>
      (show === "all" || g.rsvp === show) &&
      (!q || g.name.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)),
  );

  const headcount = plannedHeadcount(summary);
  const room = LIMITS.savedGuests - saved.guests.length;

  function applyHeadcount(n: number) {
    const guests = Math.min(Math.max(n, LIMITS.guests.min), LIMITS.guests.max);
    updatePlan(saved.id, (p) => ({ ...p, input: { ...p.input, guests } }));
    setNotice(`The plan now uses ${guests} guests. Food, seats and the budget per guest are updated.`);
  }

  const coming = FOODS.filter((f) => f !== "any" && summary.food[f] > 0).map(
    (f) => `${summary.food[f]} ${FOOD_LABEL[f].toLowerCase()}`,
  );

  return (
    <div className={styles.panelGrid}>
      <Card
        title="Guest list"
        aside={
          <span className="muted num">
            {summary.invited} {summary.invited === 1 ? "person" : "people"} in {summary.invitations}{" "}
            {summary.invitations === 1 ? "invitation" : "invitations"}
          </span>
        }
      >
        <dl className={styles.rsvpStats}>
          {(["yes", "maybe", "pending", "no"] as const).map((r) => (
            <div key={r}>
              <dt>{RSVP_LABEL[r]}</dt>
              <dd className="num">{summary.people[r]}</dd>
            </div>
          ))}
        </dl>
        {coming.length > 0 && <p className="hint">Food for those coming: {coming.join(", ")}.</p>}

        {headcount !== null && headcount !== plan.input.guests && (
          <div className={styles.callout}>
            <p>
              Plan for <strong className="num">{headcount}</strong> people: everyone coming plus half of the maybes. The
              plan uses {plan.input.guests}.
            </p>
            <button type="button" className="btn btn-secondary no-print" onClick={() => applyHeadcount(headcount)}>
              Use {headcount} as the headcount
            </button>
          </div>
        )}
        <p role="status" className="hint">
          {notice}
        </p>

        <AddGuest
          groups={groups}
          room={room}
          onAdd={(g) => setGuests((all) => [...all, ...g])}
          listId={`${uid}-groups`}
        />

        {saved.guests.length > 0 && (
          <div className={`row no-print ${styles.guestFilters}`}>
            <div className="field">
              <label htmlFor={`${uid}-show`}>Show</label>
              <select
                id={`${uid}-show`}
                className="input"
                value={show}
                onChange={(e) => setShow(e.target.value as Rsvp | "all")}
              >
                <option value="all">Everyone</option>
                {RSVPS.map((r) => (
                  <option key={r} value={r}>
                    {RSVP_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            {saved.guests.length >= SEARCH_FROM && (
              <div className="field">
                <label htmlFor={`${uid}-q`}>Search</label>
                <input
                  id={`${uid}-q`}
                  className="input"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {saved.guests.length === 0 ? (
          <p className="muted">
            No guests yet. Add them one by one or paste a list. Names stay in this browser and are never shared.
          </p>
        ) : visible.length === 0 ? (
          <p className="muted">No guests match.</p>
        ) : (
          <ul className={styles.list} aria-label="Guests">
            {visible.map((g) => (
              <GuestRow
                key={g.id}
                guest={g}
                onRsvp={(rsvp) => setGuests((all) => all.map((x) => (x.id === g.id ? { ...x, rsvp } : x)))}
                onRemove={() => setGuests((all) => all.filter((x) => x.id !== g.id))}
              />
            ))}
          </ul>
        )}
      </Card>
      <InviteImage input={saved.input} today={plan.today} />
      <InviteCard saved={saved} />
    </div>
  );
}

function GuestRow({ guest, onRsvp, onRemove }: { guest: Guest; onRsvp: (r: Rsvp) => void; onRemove: () => void }) {
  const uid = useId();
  const meta = [
    guest.group,
    guest.party > 1 && `party of ${guest.party}`,
    guest.food !== "any" && FOOD_LABEL[guest.food],
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <li className={styles.guest}>
      <div className={styles.guestName}>
        <strong>{guest.name}</strong>
        {meta && <span className="hint">{meta}</span>}
      </div>
      <label htmlFor={`${uid}-rsvp`} className="sr-only">
        Reply from {guest.name}
      </label>
      <select
        id={`${uid}-rsvp`}
        className={`input ${styles.rsvpSelect}`}
        data-rsvp={guest.rsvp}
        value={guest.rsvp}
        onChange={(e) => onRsvp(e.target.value as Rsvp)}
      >
        {RSVPS.map((r) => (
          <option key={r} value={r}>
            {RSVP_LABEL[r]}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-quiet no-print" onClick={onRemove}>
        <Icon name="trash" />
        <span className="sr-only">Remove {guest.name}</span>
      </button>
    </li>
  );
}

interface AddGuestProps {
  groups: string[];
  room: number;
  listId: string;
  onAdd: (guests: Guest[]) => void;
}

function AddGuest({ groups, room, listId, onAdd }: AddGuestProps) {
  const [mode, setMode] = useState<"one" | "many">("one");
  const [name, setName] = useState("");
  const [names, setNames] = useState("");
  const [group, setGroup] = useState("");
  const [party, setParty] = useState("1");
  const [food, setFood] = useState<Food>("any");
  const [error, setError] = useState("");
  const uid = useId();

  function make(n: string, size: number): Guest | null {
    const r = GuestSchema.safeParse({ id: crypto.randomUUID(), name: n, group, party: size, rsvp: "pending", food });
    return r.success ? r.data : null;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (room <= 0) return setError(`A plan can hold ${LIMITS.savedGuests} guests.`);
    if (mode === "one") {
      const size = Number(party);
      if (!Number.isInteger(size) || size < 1 || size > LIMITS.partySize) {
        return setError(`Enter between 1 and ${LIMITS.partySize} people.`);
      }
      const g = make(name, size);
      if (!g) return setError("Enter a name.");
      onAdd([g]);
      setName("");
      setParty("1");
    } else {
      const list = parseNames(names, room)
        .map((n) => make(n, 1))
        .filter((g): g is Guest => g !== null);
      if (list.length === 0) return setError("Paste at least one name, one per line.");
      onAdd(list);
      setNames("");
    }
    setError("");
  }

  return (
    <form className={`no-print ${styles.addGuest}`} onSubmit={submit} aria-label="Add guests">
      <div className={styles.modeSwitch} role="group" aria-label="How to add">
        <button type="button" aria-pressed={mode === "one"} onClick={() => setMode("one")}>
          One guest
        </button>
        <button type="button" aria-pressed={mode === "many"} onClick={() => setMode("many")}>
          Paste a list
        </button>
      </div>
      <div className={styles.addFields}>
        {mode === "one" ? (
          <div className="field">
            <label htmlFor={`${uid}-name`}>Name</label>
            <input
              id={`${uid}-name`}
              className="input"
              value={name}
              maxLength={LIMITS.guestName}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-err` : undefined}
            />
          </div>
        ) : (
          <div className={`field ${styles.wide}`}>
            <label htmlFor={`${uid}-names`}>Names, one per line</label>
            <textarea
              id={`${uid}-names`}
              className="input"
              value={names}
              onChange={(e) => setNames(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-err` : undefined}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor={`${uid}-group`}>Group</label>
          <input
            id={`${uid}-group`}
            className="input"
            list={listId}
            value={group}
            maxLength={LIMITS.guestGroup}
            placeholder="Family, office"
            onChange={(e) => setGroup(e.target.value)}
          />
          <datalist id={listId}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        {mode === "one" && (
          <div className="field">
            <label htmlFor={`${uid}-party`}>People</label>
            <input
              id={`${uid}-party`}
              className={`input ${styles.small}`}
              inputMode="numeric"
              value={party}
              onChange={(e) => setParty(e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor={`${uid}-food`}>Food</label>
          <select id={`${uid}-food`} className="input" value={food} onChange={(e) => setFood(e.target.value as Food)}>
            {FOODS.map((f) => (
              <option key={f} value={f}>
                {FOOD_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          <Icon name="plus" />
          {mode === "one" ? "Add guest" : "Add names"}
        </button>
      </div>
      {error && <FieldError id={`${uid}-err`}>{error}</FieldError>}
    </form>
  );
}
