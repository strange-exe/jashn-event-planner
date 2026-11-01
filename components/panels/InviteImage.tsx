"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { EventInput, FunctionKind } from "@/lib/engine/types";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardData,
  cardFunctions,
  cardText,
  defaultFooter,
  defaultSubline,
  drawInviteCard,
} from "@/lib/inviteCard";
import { FUNCTION_LABEL } from "@/lib/labels";
import styles from "../dashboard.module.css";
import { TextField } from "../fields";
import { Icon } from "../Icon";
import { Card } from "./shared";

const FILE_NAME = "jashn-invite.png";

/** The fonts the page really loaded (next/font names), so the card matches the app. */
function pageFonts() {
  const probe = document.createElement("span");
  probe.style.fontFamily = "var(--font-head)";
  probe.hidden = true;
  document.body.append(probe);
  const head = getComputedStyle(probe).fontFamily || "system-ui, sans-serif";
  probe.remove();
  const body = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  return { head, body };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function save(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  a.click();
  // Some browsers start the download after click returns, so let go of the URL a little later.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Draws the invitation as an image that can be saved or shared to WhatsApp. */
export function InviteImage({ input, today }: { input: EventInput; today: string }) {
  const [scope, setScope] = useState<"all" | FunctionKind>("all");
  // null means "use the default", so the defaults follow the event until the host edits them.
  const [subline, setSubline] = useState<string | null>(null);
  const [footer, setFooter] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uid = useId();

  const functions = cardFunctions(input);
  const sublineValue = subline ?? defaultSubline(input.type);
  const footerValue = footer ?? defaultFooter(input, today);
  const data = useMemo(
    () => cardData(input, today, scope, { subline: sublineValue, footer: footerValue }),
    [input, today, scope, sublineValue, footerValue],
  );
  const shortText = cardText(data);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fonts = pageFonts();
      await document.fonts.ready;
      // Make sure the exact weights the card uses are loaded, not only the page's.
      await Promise.allSettled([
        document.fonts.load(`600 76px ${fonts.head}`),
        document.fonts.load(`400 34px ${fonts.body}`),
        document.fonts.load(`600 30px ${fonts.body}`),
      ]);
      const ctx = canvasRef.current?.getContext("2d");
      if (!cancelled && ctx) drawInviteCard(ctx, data, fonts);
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  async function image(): Promise<Blob | null> {
    const blob = canvasRef.current ? await toBlob(canvasRef.current) : null;
    if (!blob) setNote("Could not make the image here. Try again.");
    return blob;
  }

  async function download() {
    const blob = await image();
    if (!blob) return;
    save(blob);
    setNote("Image saved.");
  }

  async function share() {
    const blob = await image();
    if (!blob) return;
    const file = new File([blob], FILE_NAME, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: shortText });
        setNote("Shared. Pick WhatsApp in the share sheet to send it there.");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setNote("Sharing did not work here. Download the image and attach it in WhatsApp.");
      }
      return;
    }
    save(blob);
    window.open(`https://wa.me/?text=${encodeURIComponent(shortText)}`, "_blank", "noopener,noreferrer");
    setNote("Image saved. Attach it in WhatsApp after the chat opens.");
  }

  return (
    <Card title="Invitation card">
      <p className="hint">A picture invite made from the event details. Edit the wording, then save or share it.</p>
      <div className={`stack no-print ${styles.cardControls}`}>
        {functions.length > 0 && (
          <div className="field">
            <label htmlFor={`${uid}-scope`}>Card for</label>
            <select
              id={`${uid}-scope`}
              className="input"
              value={scope}
              onChange={(e) => setScope(e.target.value as "all" | FunctionKind)}
            >
              <option value="all">Whole celebration</option>
              {functions.map((f) => (
                <option key={f.kind} value={f.kind}>
                  {FUNCTION_LABEL[f.kind].name}
                </option>
              ))}
            </select>
          </div>
        )}
        <TextField
          id={`${uid}-subline`}
          label="Line under the names"
          value={sublineValue}
          maxLength={80}
          onChange={setSubline}
        />
        <TextField id={`${uid}-footer`} label="Footer" value={footerValue} maxLength={120} onChange={setFooter} />
      </div>
      <canvas
        ref={canvasRef}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        className={styles.cardPreview}
        role="img"
        aria-label={`Invitation card: ${[data.subline, shortText, data.footer].filter(Boolean).join(". ").replace(/\n/g, ". ")}`}
      />
      <div className="row no-print">
        <button type="button" className="btn btn-primary" onClick={share}>
          <Icon name="send" />
          Share on WhatsApp
        </button>
        <button type="button" className="btn btn-secondary" onClick={download}>
          Download image
        </button>
      </div>
      <p role="status" className="hint">
        {note}
      </p>
    </Card>
  );
}
