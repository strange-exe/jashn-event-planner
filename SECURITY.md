# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://github.com/strange-exe/jashn-event-planner/security/advisories/new)
rather than in a public issue. Include the steps to reproduce and the impact you expect.

## Scope

- The Next.js app and its API routes (`/api/assistant`, `/api/ideas`).
- The security headers and Content Security Policy set in `proxy.ts`.
- Handling of model output (validation in `lib/schema.ts`, rendering as text).

Plans are stored only in the visitor's browser, so there is no server-side user data to expose.
The measures in place are listed in the README's Security section.
