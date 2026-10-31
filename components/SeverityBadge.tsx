import type { Severity } from "@/lib/engine/types";
import { SEVERITY_LABEL } from "@/lib/labels";
import { Icon } from "./Icon";

const ICON = { critical: "stop", warning: "alert", info: "info" } as const;

/** Severity shown as icon plus word, never colour alone. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge tone-${severity}`}>
      <Icon name={ICON[severity]} />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
