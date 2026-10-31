import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  type?: string;
  min?: string;
  maxLength?: number;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
  multiline?: boolean;
}

/** A labelled input or textarea with its hint and error tied to it by aria-describedby. */
export function TextField({ id, label, value, onChange, hint, error, multiline, ...rest }: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    className: "input",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
      {multiline ? (
        <textarea {...common} maxLength={rest.maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} {...rest} type={rest.type ?? "text"} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && (
        <span id={`${id}-error`} className="error">
          <Icon name="stop" />
          {error}
        </span>
      )}
    </div>
  );
}

interface ChoiceProps {
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  name?: string;
  value?: string;
  disabled?: boolean;
  /** What shows in the tick box; a check mark by default. */
  mark?: ReactNode;
}

/** One large, tappable radio or checkbox option. */
export function Choice({ type, checked, onChange, children, name, value, disabled, mark }: ChoiceProps) {
  return (
    <label className="choice">
      <input type={type} name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} />
      <span className="tick">{mark === undefined ? <Icon name="check" /> : mark}</span>
      <span>{children}</span>
    </label>
  );
}

interface RadioGroupProps<T extends string> {
  label: string;
  hint?: string;
  name: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function RadioGroup<T extends string>({ label, hint, name, options, value, onChange }: RadioGroupProps<T>) {
  return (
    <fieldset className="field">
      <legend>
        {label} {hint && <span className="hint">{hint}</span>}
      </legend>
      <div className="choices">
        {options.map((o) => (
          <Choice
            key={o.value}
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          >
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </Choice>
        ))}
      </div>
    </fieldset>
  );
}
