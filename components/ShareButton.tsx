"use client";

import { encodeShared, shareHash, toShared } from "@/lib/share";
import type { SavedPlan } from "@/lib/store";
import { Icon } from "./Icon";

/**
 * Copies a read-only link to the plan. The plan travels in the link's fragment,
 * which browsers never send to a server; guest names and payments are left out.
 */
export function ShareButton({ saved, onNote: setNote }: { saved: SavedPlan; onNote: (note: string) => void }) {
  async function share() {
    try {
      const url = `${location.origin}/share${shareHash(await encodeShared(toShared(saved)))}`;
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: saved.input.title, url });
        setNote("");
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied. Anyone with it can view the plan, without guest names or payments.");
    } catch (e) {
      // Closing the phone's share sheet is not an error worth showing.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setNote("Could not copy the link here. Try again from another browser.");
    }
  }

  return (
    <button type="button" className="btn btn-quiet" onClick={share}>
      <Icon name="share" />
      Share
    </button>
  );
}
