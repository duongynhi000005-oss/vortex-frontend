# Storybook visual regression

The visual suite enumerates Storybook's `index.json` and captures every story in
both light and dark themes using pinned Chromium, a 1440×900 viewport, DPR 1,
UTC, a fixed clock, disabled motion and blocked external network requests.

Baselines are committed under `.storybook/playwright/__screenshots__/`. Run
`npm run build:storybook && npm run test:visual` to compare locally. Intentional
changes are updated in CI by applying the `update-snapshots` label to a pull
request; the workflow commits regenerated images to that pull request's branch.

CI shards the comparison across two workers. On failure, inspect the uploaded
Playwright report and `test-results` artifact, which includes expected, actual,
and diff images. Reviewers must approve the image changes just like source code.
