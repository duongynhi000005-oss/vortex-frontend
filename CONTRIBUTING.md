# Contributing to Vortex Protocol Frontend

Thank you for your interest in contributing to Vortex Protocol!

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before participating in community discussions, submitting issues, or creating pull requests.

## How to Contribute

1. **Pick an Issue**: Check out open issues tagged with complexity labels on the [Wave Tracker](/contributors) or in `issues.md`.
2. **Follow Guidelines**: Ensure all user-submitted text follows sanitization standards (`src/lib/textSafety.ts`).
3. **Logging**: Never call `console.*` in `src/**`; use `secureLogger` from `src/lib/secureLogging.ts`, which redacts keys, XDR, tokens and mnemonics. `npm run lint` fails on violations. If you find a new sensitive format, add a rule to `DEFAULT_RULES` with a test.
4. **Browser storage**: Never touch `localStorage`/`sessionStorage` directly; register the key in `STORAGE_KEYS` and use the `storage` facade in `src/lib/storage.ts` (lint-enforced).
5. **Submit PR**: Open a pull request detailing your changes and referencing the closed issue (`Closes #N`).

## Good First Issue Mentors

A maintainer can opt a good-first issue into having a mentor by adding `Mentor: <github-handle>` to its entry in `issues.md`, next to `Good first issue: yes`:

```
- #14 Swap Sound Effects (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes, Mentor: octocat)
```

The Wave Tracker then shows an "Ask @handle about this one" link to that person's GitHub profile on the issue's card. Mentoring is optional and informal: the mentor agrees to answer questions about that specific issue (scope, where to look in the code, review expectations) on a best-effort basis. They are not expected to write the change, and the link is not an in-app chat or scheduling system. Only add a mentor who has agreed to it, and remove the field if they can no longer help. The handle is not validated against GitHub when `issues.md` is parsed.

## Reporting Conduct Issues

If you experience or witness unacceptable behavior, please contact the maintainers at `conduct@vortexprotocol.io`, the single conduct-reporting channel (also listed in the [Code of Conduct](./CODE_OF_CONDUCT.md)).
