// A small set of line icons drawn on a 24 px grid. Decorative by default; pass
// `label` when the icon carries meaning on its own.

const PATHS = {
  logo: "M12 3c2.5 2.6 2.5 5.4 0 8-2.5-2.6-2.5-5.4 0-8zM4 13c3.4-.5 5.9 1 7 4-3.4.5-5.9-1-7-4zm16 0c-3.4-.5-5.9 1-7 4 3.4.5 5.9-1 7-4zM12 13v8",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 8v5m0 3.5v.5M10.3 4l-7.5 13a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0z",
  info: "M12 11v6m0-9.5V8M12 21a9 9 0 100-18 9 9 0 000 18z",
  stop: "M12 8v5m0 3.5v.5M12 21a9 9 0 100-18 9 9 0 000 18z",
  calendar: "M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm0 3h16M8 3v4m8-4v4",
  plus: "M12 5v14M5 12h14",
  send: "M4 12l16-8-6 16-2.5-6.5L4 12z",
  print: "M7 9V4h10v5M7 17H5a1 1 0 01-1-1v-5a2 2 0 012-2h12a2 2 0 012 2v5a1 1 0 01-1 1h-2M7 14h10v6H7v-6z",
  trash: "M5 7h14M10 7V5h4v2m-7 0l1 13h8l1-13",
  lock: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6v-9z",
  unlock: "M7 11V8a5 5 0 019.6-2M6 11h12v9H6v-9z",
  arrowLeft: "M19 12H5m6-6l-6 6 6 6",
  arrowRight: "M5 12h14m-6-6l6 6-6 6",
  chat: "M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1H10l-5 4v-4H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  close: "M6 6l12 12M18 6L6 18",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, label, size }: { name: IconName; label?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
