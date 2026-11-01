"use client";

import { useId, useState } from "react";
import { getIdeas } from "@/lib/api";
import { IDEA_CATEGORIES, type Idea, type IdeaCategory } from "@/lib/ideas";
import { IDEA_CATEGORY_LABEL } from "@/lib/labels";
import { LIMITS } from "@/lib/schema";
import { updatePlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { ErrorAlert, StatusBadge } from "../feedback";
import { Card, type PanelProps } from "./shared";

/** New ideas first, then older ones not repeated by title, capped to what a plan stores. */
function mergeIdeas(fresh: Idea[], old: Idea[]): Idea[] {
  const titles = new Set(fresh.map((i) => i.title));
  return [...fresh, ...old.filter((i) => !titles.has(i.title))].slice(0, LIMITS.savedIdeas);
}

export function IdeasPanel({ plan, saved }: PanelProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [category, setCategory] = useState<IdeaCategory | "">("");
  const [source, setSource] = useState("");
  const uid = useId();

  async function load() {
    setStatus("loading");
    try {
      const result = await getIdeas(saved.input, category || undefined);
      updatePlan(saved.id, (p) => ({ ...p, ideas: mergeIdeas(result.ideas, p.ideas) }));
      setSource(
        result.source === "ai"
          ? "Personalised by Gemini for this event."
          : "AI is unavailable, so these are curated ideas for this kind of event.",
      );
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const buttonLabel = status === "loading" ? "Thinking of ideas..." : saved.ideas.length ? "More ideas" : "Get ideas";

  return (
    <Card title={`Ideas for ${plan.input.title}`} busy={status === "loading"}>
      <div className={`row no-print ${styles.ideaControls}`}>
        <div className="field">
          <label htmlFor={`${uid}-cat`}>Focus</label>
          <select
            id={`${uid}-cat`}
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as IdeaCategory | "")}
          >
            <option value="">All kinds</option>
            {IDEA_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {IDEA_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={load} disabled={status === "loading"}>
          {buttonLabel}
        </button>
      </div>
      <p role="status" className="hint">
        {status === "error" ? "" : source}
      </p>
      {status === "error" && (
        <ErrorAlert>Could not get ideas right now. Check your connection and try again.</ErrorAlert>
      )}
      {saved.ideas.length === 0 && status !== "loading" ? (
        <p className="muted">No ideas yet. They use your style, guests, budget and preferences.</p>
      ) : (
        <ul className={styles.cardGrid}>
          {saved.ideas.map((i) => (
            <li key={i.title} className={styles.idea}>
              <div className="row spread">
                <strong>{i.title}</strong>
                <StatusBadge tone="neutral">{i.cost} cost</StatusBadge>
              </div>
              <p className="muted">{i.description}</p>
              <span className="hint">{IDEA_CATEGORY_LABEL[i.category]}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
