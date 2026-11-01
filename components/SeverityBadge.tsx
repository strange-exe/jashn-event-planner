import type { Severity } from "@/lib/engine/types";
import { SEVERITY_LABEL } from "@/lib/labels";
import { StatusBadge } from "./feedback";

const ICON = { critical: "stop", warning: "alert", info: "info" } as const;

/** Severity shown as icon plus word, never colour alone. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <StatusBadge tone={severity} icon={ICON[severity]}>
      {SEVERITY_LABEL[severity]}
    </StatusBadge>
  );
}
