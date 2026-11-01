"use client";

import { useState } from "react";
import type { LocalResult } from "@/lib/ai/handlers";
import { findLocal } from "@/lib/api";
import type { EventInput } from "@/lib/engine/types";
import { LOCAL_TOPIC_LABEL, LOCAL_TOPICS, type LocalTopic } from "@/lib/local";
import styles from "../dashboard.module.css";
import { ErrorAlert } from "../feedback";
import { Card } from "./shared";

/**
 * Venues, vendors, prices and themes for the event's city, from Gemini grounded on
 * Google Maps or Google Search. The grounded answer is shown as returned, with its
 * links right after it, as Google's terms require; results are kept only while the
 * page is open.
 */
export function LocalPicks({ input }: { input: EventInput }) {
  const [topic, setTopic] = useState<LocalTopic | null>(null);
  const [results, setResults] = useState<Partial<Record<LocalTopic, LocalResult>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function pick(t: LocalTopic) {
    setTopic(t);
    if (results[t]) return;
    setStatus("loading");
    try {
      const result = await findLocal(input, t);
      setResults((r) => ({ ...r, [t]: result }));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const result = topic ? results[topic] : undefined;
  return (
    <Card title={`Find in ${input.city}`} busy={status === "loading"}>
      <p className="hint">
        Live suggestions from Google Maps and Google Search for this event. Jashn does not check them: call to confirm
        prices, dates and availability.
      </p>
      <div className={`no-print ${styles.topics}`} role="group" aria-label="What to find">
        {LOCAL_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className="btn btn-quiet"
            aria-pressed={topic === t}
            disabled={status === "loading"}
            onClick={() => pick(t)}
          >
            {LOCAL_TOPIC_LABEL[t]}
          </button>
        ))}
      </div>
      <p role="status" className="hint">
        {status === "loading" && topic ? `Searching for ${LOCAL_TOPIC_LABEL[topic].toLowerCase()}...` : ""}
      </p>
      {status === "error" && topic && (
        <ErrorAlert>
          Could not search right now.{" "}
          <button type="button" className="btn btn-quiet" onClick={() => pick(topic)}>
            Try again
          </button>
        </ErrorAlert>
      )}
      {status !== "loading" && result && <LocalAnswerView result={result} city={input.city} />}
    </Card>
  );
}

function LocalAnswerView({ result, city }: { result: LocalResult; city: string }) {
  const { answer } = result;
  if (!answer) {
    return (
      <p>
        {result.fallback === "not-configured"
          ? "Live search is not set up on this server."
          : "Live search is unavailable right now."}{" "}
        <a href={result.searchUrl} target="_blank" rel="noopener noreferrer">
          Search Google Maps in {city}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    );
  }
  const maps = result.source === "google-maps";
  return (
    <div className={styles.grounded}>
      <p className={styles.groundedText}>{answer.text}</p>
      <h3 className={styles.phase}>
        {maps ? (
          <>
            Places on <span translate="no">Google Maps</span>
          </>
        ) : (
          "Sources from Google Search"
        )}
      </h3>
      <ul className={styles.sources}>
        {answer.links.map((l) => (
          <li key={l.uri}>
            <a href={l.uri} target="_blank" rel="noopener noreferrer">
              {l.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      {answer.suggestionsHtml && (
        // Google's Search Suggestions, shown as provided. The frame runs no scripts and has
        // no access to this page; links open in a new tab.
        <iframe
          title="Google Search suggestions"
          className={styles.suggestions}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={`<base target="_blank">${answer.suggestionsHtml}`}
        />
      )}
    </div>
  );
}
