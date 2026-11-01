"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./toran.module.css";

type State = "idle" | "ready" | "fallback";

function hasWebGL(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * The home scene: a carved doorway at dusk with a marigold toran, diyas and a rangoli,
 * drawn in three.js around the parent's [data-door] box. Purely decorative
 * (aria-hidden): the text sits on the band's solid dusk colour and reads without it.
 * three.js loads only after the page is idle, so it never delays the headline.
 * Without WebGL a drawn garland shows instead; with reduced motion the scene renders
 * one still frame.
 */
export function Toran() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    let disposed = false;
    let dispose: (() => void) | undefined;

    // The door's box in the canvas's own pixels; without one the scene draws a plain header.
    const measureDoor = () => {
      const door = box.parentElement?.querySelector<HTMLElement>("[data-door]");
      if (!door) return null;
      const b = box.getBoundingClientRect();
      const d = door.getBoundingClientRect();
      return { left: d.left - b.left, top: d.top - b.top, width: d.width, height: d.height };
    };

    const start = async () => {
      if (!hasWebGL()) {
        setState("fallback");
        return;
      }
      try {
        const { mountDusk } = await import("./toranScene");
        if (disposed) return;
        const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
        dispose = mountDusk(el, { mode: "doorway", still, measureDoor }).dispose;
        setState("ready");
      } catch {
        if (!disposed) setState("fallback");
      }
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => void start());
    return () => {
      disposed = true;
      cancelIdle(handle);
      dispose?.();
    };
  }, []);

  return (
    <div ref={wrap} className={styles.toran} data-state={state} aria-hidden="true">
      <canvas ref={canvas} className={styles.canvas} />
      <div className={styles.fallback} />
    </div>
  );
}
