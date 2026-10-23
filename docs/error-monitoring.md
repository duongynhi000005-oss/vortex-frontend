# Error monitoring: source maps and release tagging

Minified stack traces are unactionable, and without a release id a regression
cannot be tied to the deploy that caused it. The production pipeline therefore
uploads source maps to the error monitor keyed by the release id, then removes
them from the published artifact.

## How it works

| Stage | Where | What happens |
| --- | --- | --- |
| Build | `next.config.mjs` | When `ERROR_MONITOR_SOURCE_MAPS=true`, client bundles use `hidden-source-map`: `.map` files are emitted but no `sourceMappingURL` comment is added, so browsers never request them. |
| Upload | `.github/workflows/deploy.yml` (build job) | `@sentry/cli` creates release `${{ github.sha }}`, uploads `.next/static` maps under `~/_next/static`, and finalizes the release. |
| Strip | same step | `find .next -name '*.map' -delete` runs whether or not upload happened, so maps are never in the artifact that deploys. |

`ERROR_MONITOR_SOURCE_MAPS` is set automatically from the presence of
`SENTRY_AUTH_TOKEN`. Without the secret, the build is map-free and the upload
step is skipped with a notice.

## Setup

1. In the error monitor project, create an auth token with `project:releases`
   scope.
2. Add repository secret `SENTRY_AUTH_TOKEN`.
3. Add repository variables `SENTRY_ORG` and `SENTRY_PROJECT`.
4. Merge to `main`. The release appears in the monitor as the commit SHA, and
   the deploy job's run log shows `releases finalize` succeeding.

To verify a build locally without uploading:

```sh
ERROR_MONITOR_SOURCE_MAPS=true npm run build
find .next/static -name '*.map' | head   # maps present
find .next -name '*.map' -delete          # what CI does before publishing
```

## Triage playbook

1. **Find the release.** Use the event's release tag (commit SHA). If the first
   occurrence is on the newest release, suspect that deploy; otherwise search
   for the earliest release that contains the event.
2. **Check symbolication.** If the stack still shows minified names, the map
   for that release was not uploaded. Confirm the deploy run's upload step
   ran (not skipped) and that `SENTRY_*` settings match the project.
3. **Dedupe by fingerprint.** Repeated identical events from one browser are
   usually a retry loop; a single user reporting many events points at local
   state (see [persisted-state.md](persisted-state.md)).
4. **Check the payload is scrubbed.** Events must not contain Stellar account
   ids, secret seeds, XDR, tokens or query strings. If one does, treat it as a
   scrubbing bug: stop forwarding events and fix the scrubber before continuing.
5. **Decide.** Fix forward on `main`, or roll back the deploy if the regression
   is user-facing and the cause is not obvious within the triage window.

Alert routing and on-call are out of scope for this document.
