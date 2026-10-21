# Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please-action).
Commit messages on `main` decide the version bump, and a maintainer decides when to ship by merging a PR.

## How it works

1. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are checked by commitlint
   (`commitlint.config.js`). Pull requests are squash-merged, so the **PR title** becomes the commit on `main`.
   `.github/workflows/pr-title.yml` lints that title, so a bad title fails the PR check.
2. On every push to `main`, `.github/workflows/release-please.yml` reads the commits since the last release and
   opens or updates a **release PR** titled `chore(main): release X.Y.Z`. That PR:
   - bumps `version` in `package.json` and `package-lock.json`
   - prepends the grouped notes to `CHANGELOG.md` (Features, Bug Fixes, and so on)
   - updates `.release-please-manifest.json`
3. Merging the release PR creates the tag `vX.Y.Z` and a GitHub Release with the generated notes.

Bump rules: `fix:` gives a patch, `feat:` a minor, and a `!` or `BREAKING CHANGE:` footer a major.
`bump-minor-pre-major` is on, so while the version is `0.x` a breaking change bumps the minor version instead of
jumping to `1.0.0`. Turn that off when the project is ready for `1.0.0`.

Notes for contributors:

- Fork PRs can't trigger the release job (it runs only on `main`). Maintainers merge fork PRs, and the squash
  title is what matters.
- If the release PR conflicts with a new commit on `main`, release-please rebases it automatically on the next push.
  Don't edit the release PR's version by hand. Close it and let the next run regenerate it.
- Don't hand-edit `CHANGELOG.md` or the manifest for releases; release-please owns them.

## Build identity

Every build knows which version and commit it came from. `next.config.mjs` injects:

| Variable                   | Source                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_VERSION`  | `version` in `package.json`                                   |
| `NEXT_PUBLIC_COMMIT_SHA`   | `VERCEL_GIT_COMMIT_SHA`, then `GITHUB_SHA`, else `unknown`    |
| `NEXT_PUBLIC_BUILD_TIME`   | when `next.config.mjs` loads (ISO 8601)                        |

They are read in `src/lib/buildInfo.ts`. The `/api/health` route reports them, so support can compare a user's
build with a tag. `scripts/check-env-vars.mjs` accepts them as derived values and not as user configuration.

## Rollback

Releases are tags and Vercel deployments, so rollback doesn't rewrite history.

1. **Fastest (minutes):** in Vercel, open the previous production deployment and choose **Promote to Production**
   (or **Instant Rollback**). Check `/api/health` afterwards. `commit` should show the older SHA.
2. **Code-level:** revert the bad change on `main` with `git revert <sha>`. Merge it, and the release job opens a
   patch release. Don't force-push `main` and don't delete tags or GitHub Releases. Other people may already use them.
3. **Bad release PR:** close it without merging. The next push to `main` regenerates it.
4. **Bad tag or release:** mark the GitHub Release as pre-release or edit its notes. If the release is unsafe to use,
   publish a fixed patch release and say so in its notes.

## Supply chain

- Workflows use actions pinned to commit SHAs, with the version in a trailing comment.
- Permissions are set per job. `release-please` gets `contents: write` and `pull-requests: write` only for the release job.
- Release PRs use the default `GITHUB_TOKEN`. Its PRs don't trigger other workflows, so the release PR needs a
  maintainer to push a commit or close and reopen it to get CI. Adding a PAT or GitHub App token would change this.
