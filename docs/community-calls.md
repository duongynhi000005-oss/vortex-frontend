# Community call notes

Notes from community and governance calls are published at `/governance/calls`,
newest first. They are static content authored through pull requests, like any
other doc: there is no CMS, scheduling or recording support in the app.

## Adding a note

Create `docs/calls/YYYY-MM-DD-short-name.md`:

```md
---
date: 2026-10-01
summary: One-line summary shown in the list.
recording: https://example.com/recording
decisions:
  - A decision made on the call.
---
Markdown body.
```

- `date` (required, `YYYY-MM-DD`) and `summary` drive ordering and the list entry.
- `recording` (optional) must be an `https://` URL; anything else is ignored.
- `decisions` (optional) is a list of short strings.
- The body is rendered by the safe `Markdown` component (no raw HTML or images).
- A file with missing or invalid frontmatter (for example, no valid `date`) is
  skipped instead of breaking the page.
