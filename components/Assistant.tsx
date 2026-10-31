"use client";

import { useEffect, useId, useRef, useState } from "react";
import { applyChanges } from "@/lib/engine/changes";
import type { EventInput } from "@/lib/engine/types";
import type { Change } from "@/lib/schema";
import { LIMITS } from "@/lib/schema";
import { updatePlan, type SavedPlan } from "@/lib/store";
import styles from "./dashboard.module.css";
import { Icon } from "./Icon";

interface Proposal {
  changes: { change: Change; label: string }[];
}

const SUGGESTIONS = ["Cut the budget by 10%", "Add 25 guests", "Make it eco-friendly", "What should I book first?"];

export function Assistant({ saved, onApplied }: { saved: SavedPlan; onApplied: (input: EventInput) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [saved.chat.length]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setProposal(null);
    const history = saved.chat.slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, LIMITS.message) }));
    updatePlan(saved.id, (p) => ({ ...p, chat: [...p.chat, { role: "user" as const, text: trimmed }].slice(-40) }));
    setText("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: saved.input, message: trimmed, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The assistant could not answer.");
      updatePlan(saved.id, (p) => ({ ...p, chat: [...p.chat, { role: "assistant" as const, text: String(data.reply) }].slice(-40) }));
      if (data.changes?.length) setProposal({ changes: data.changes });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The assistant could not answer.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!proposal) return;
    onApplied(applyChanges(saved.input, proposal.changes.map((c) => c.change)));
    setNotice(`Applied ${proposal.changes.length} change${proposal.changes.length === 1 ? "" : "s"}. The plan has been recalculated.`);
    setProposal(null);
  }

  return (
    <aside className={`card ${styles.assistant} no-print`} aria-labelledby={`${uid}-h`}>
      <div className="row spread">
        <h2 id={`${uid}-h`} className={styles.h}>Ask the planner</h2>
        {saved.chat.length > 0 && (
          <button type="button" className="btn btn-quiet" onClick={() => updatePlan(saved.id, (p) => ({ ...p, chat: [] }))}>Clear</button>
        )}
      </div>
      <p className="hint">Ask a question or describe a change. Changes are shown for you to approve first.</p>

      <div ref={logRef} className={styles.chat} role="log" aria-live="polite" aria-label="Conversation">
        {saved.chat.length === 0 && <p className={styles.empty}>Try one of the suggestions below.</p>}
        {saved.chat.map((m, i) => (
          <p key={i} className={m.role === "user" ? styles.me : styles.bot}>
            <span className="sr-only">{m.role === "user" ? "You said:" : "Planner:"}</span>
            {m.text}
          </p>
        ))}
        {busy && <p className={styles.bot}>Thinking...</p>}
      </div>

      {proposal && (
        <div className={styles.proposal} role="group" aria-labelledby={`${uid}-p`}>
          <strong id={`${uid}-p`}>Proposed changes</strong>
          <ul>{proposal.changes.map((c, i) => <li key={i}>{c.label}</li>)}</ul>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={apply}><Icon name="check" />Apply</button>
            <button type="button" className="btn btn-quiet" onClick={() => setProposal(null)}>Dismiss</button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="row"><span className="badge tone-success"><Icon name="check" />Done</span>{notice}</p>}
      {error && <p className="error" role="alert"><Icon name="stop" />{error}</p>}

      <div className={styles.suggest}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="btn btn-secondary" onClick={() => send(s)} disabled={busy}>{s}</button>
        ))}
      </div>

      <form className={styles.compose} onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label htmlFor={`${uid}-msg`} className="sr-only">Message to the planner</label>
        <input id={`${uid}-msg`} className="input" value={text} maxLength={LIMITS.message} onChange={(e) => setText(e.target.value)} placeholder="e.g. Start at 7 pm and prioritise photos" autoComplete="off" />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          <Icon name="send" /><span className="sr-only">Send</span>
        </button>
      </form>
    </aside>
  );
}
