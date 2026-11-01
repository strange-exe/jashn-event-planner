"use client";

import { useId, useState } from "react";
import { writeInvite } from "@/lib/api";
import { INVITE_LANGUAGES, INVITE_TONES, type InviteLanguage, type InviteTone } from "@/lib/invite";
import { LANGUAGE_LABEL, TONE_LABEL } from "@/lib/labels";
import { LIMITS } from "@/lib/schema";
import type { SavedPlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { ErrorAlert } from "../feedback";
import { Icon } from "../Icon";
import { Card } from "./shared";

/** Writes a WhatsApp invitation from the event details (never from the guest list). */
export function InviteCard({ saved }: { saved: SavedPlan }) {
  const [language, setLanguage] = useState<InviteLanguage>("en");
  const [tone, setTone] = useState<InviteTone>("warm");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [note, setNote] = useState("");
  const uid = useId();

  async function write() {
    setStatus("loading");
    setNote("");
    try {
      const result = await writeInvite(saved.input, language, tone);
      setText(result.text);
      setNote(
        result.source === "ai"
          ? "Written by Gemini. Edit it before you send."
          : "AI is unavailable, so this is a template. Edit it before you send.",
      );
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied. Paste it into any chat.");
    } catch {
      setNote("Copying is blocked here. Select the text and copy it yourself.");
    }
  }

  return (
    <Card title="Invite message" busy={status === "loading"}>
      <p className="hint">Uses the event details only. Guest names are never sent.</p>
      <div className={`row no-print ${styles.inviteControls}`}>
        <div className={styles.modeSwitch} role="group" aria-label="Language">
          {INVITE_LANGUAGES.map((l) => (
            <button key={l} type="button" aria-pressed={language === l} onClick={() => setLanguage(l)}>
              {LANGUAGE_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor={`${uid}-tone`}>Tone</label>
          <select
            id={`${uid}-tone`}
            className="input"
            value={tone}
            onChange={(e) => setTone(e.target.value as InviteTone)}
          >
            {INVITE_TONES.map((t) => (
              <option key={t} value={t}>
                {TONE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={write} disabled={status === "loading"}>
          {status === "loading" ? "Writing..." : text ? "Write again" : "Write invite"}
        </button>
      </div>
      {status === "error" && <ErrorAlert>Could not write the invite right now. Try again.</ErrorAlert>}
      {text && (
        <>
          <div className="field">
            <label htmlFor={`${uid}-text`}>Invite text</label>
            <textarea
              id={`${uid}-text`}
              className={`input ${styles.inviteText}`}
              lang={language === "hi" ? "hi" : "en"}
              value={text}
              maxLength={LIMITS.invite}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="row no-print">
            <button type="button" className="btn btn-secondary" onClick={copy}>
              <Icon name="copy" />
              Copy
            </button>
            <a
              className="btn btn-secondary"
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="send" />
              Send on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </>
      )}
      <p role="status" className="hint">
        {note}
      </p>
    </Card>
  );
}
