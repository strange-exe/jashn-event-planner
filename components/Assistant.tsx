"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LabelledChange } from "@/lib/ai/handlers";
import { askAssistant } from "@/lib/api";
import { applyChanges } from "@/lib/engine/changes";
import type { EventInput } from "@/lib/engine/types";
import { LIMITS } from "@/lib/schema";
import { updatePlan, type ChatMessage, type SavedPlan } from "@/lib/store";
import styles from "./dashboard.module.css";
import { ErrorAlert } from "./feedback";
import { Icon } from "./Icon";

const SUGGESTIONS = ["Cut the budget by 10%", "Add 25 guests", "Make it eco-friendly", "What should I book first?"];
const FALLBACK_ERROR = "The assistant could not answer.";

/** Appends a message to the plan's saved chat, keeping only the newest ones. */
function addMessage(saved: SavedPlan, message: ChatMessage) {
  updatePlan(saved.id, (p) => ({ ...p, chat: [...p.chat, message].slice(-LIMITS.savedChat) }));
}

interface AssistantProps {
  saved: SavedPlan;
  onApplied: (input: EventInput) => void;
}

export function Assistant({ saved, onApplied }: AssistantProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<LabelledChange[] | null>(null);
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
    // Earlier turns go with the request, trimmed to what the API accepts per message.
    const history = saved.chat
      .slice(-LIMITS.historyTurns)
      .map((m) => ({ role: m.role, text: m.text.slice(0, LIMITS.message) }));
    addMessage(saved, { role: "user", text: trimmed });
    setText("");
    try {
      const result = await askAssistant(saved.input, trimmed, history);
      addMessage(saved, { role: "assistant", text: result.reply });
      if (result.changes.length) setProposal(result.changes);
    } catch (e) {
      setError(e instanceof Error ? e.message : FALLBACK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!proposal) return;
    onApplied(
      applyChanges(
        saved.input,
        proposal.map((c) => c.change),
      ),
    );
    const n = proposal.length;
    setNotice(`Applied ${n} change${n === 1 ? "" : "s"}. The plan has been recalculated.`);
    setProposal(null);
  }

  return (
    <aside className={`card ${styles.assistant} no-print`} aria-labelledby={`${uid}-h`}>
      <div className="row spread">
        <h2 id={`${uid}-h`} className={styles.h}>
          Ask the planner
        </h2>
        {saved.chat.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => updatePlan(saved.id, (p) => ({ ...p, chat: [] }))}
          >
            Clear
          </button>
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
          <ul>
            {proposal.map((c, i) => (
              <li key={i}>{c.label}</li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={apply}>
              <Icon name="check" />
              Apply
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setProposal(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="row">
          <span className="badge tone-success">
            <Icon name="check" />
            Done
          </span>
          {notice}
        </p>
      )}
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className={styles.suggest}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="btn btn-secondary" onClick={() => send(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>

      <form
        className={styles.compose}
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor={`${uid}-msg`} className="sr-only">
          Message to the planner
        </label>
        <input
          id={`${uid}-msg`}
          className="input"
          value={text}
          maxLength={LIMITS.message}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Start at 7 pm and prioritise photos"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          <Icon name="send" />
          <span className="sr-only">Send</span>
        </button>
      </form>
    </aside>
  );
}
