import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "success" | "warning" | "critical" | "info" | "neutral";

/** A short status word with an optional icon, so status never relies on colour alone. */
export function StatusBadge({ tone, icon, children }: { tone: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`badge tone-${tone}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

/** An error message for one field; pass its id to the field's aria-describedby. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="error">
      <Icon name="stop" />
      {children}
    </span>
  );
}

/** An error announced to screen readers as soon as it appears. */
export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p className="error" role="alert">
      <Icon name="stop" />
      {children}
    </p>
  );
}
