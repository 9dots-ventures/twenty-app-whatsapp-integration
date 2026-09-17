# Marketplace Publish Checklist

Based on https://docs.twenty.com/developers/extend/apps/operations/publishing — the operations
reference, not the shorter tutorial walkthrough. Work top to bottom; each section notes current
status as of 2026-09-17.

---

## 1. Code quality gates (run before every publish)

- [ ] `yarn lint` — passes clean
- [ ] `yarn twenty dev:typecheck` — passes clean
- [ ] `yarn test` — passes (requires a reachable Twenty test server; see `TWENTY_API_URL`/`TWENTY_API_KEY` in `vitest.config.ts`)
- [ ] `yarn twenty plan` — review the diff one more time; confirm nothing unexpected before publishing

> Known gap, not a hard blocker: there's still no unit/integration test coverage for
> `save-connection`, `get-config`, or the front component specifically (only the generic
> scaffolded app-installation test exists). Your own `AGENTS.md`/`CLAUDE.md` calls for a
> happy-path/auth/error-path test per logic function. Worth doing before or shortly after
> first publish, not strictly required by Twenty's publish mechanics.

---

## 2. Marketplace metadata (`src/application-config.ts`)

- [x] `universalIdentifier`, `displayName`, `description`, `logo`, `author`, `emailSupport`, `galleryImages` — already set
- [x] **`category` fixed** — changed `'Integrations'` (not a recognized value) to `'Sales'`. Warning confirmed gone via `yarn twenty plan`.
- [ ] Consider setting `aboutDescription` explicitly, or confirm you're happy with the marketplace falling back to `README.md` (it does by default if `aboutDescription` is unset)
- [ ] Optional: `websiteUrl`, `termsUrl` — not currently set; add if you have pages for these

---

## 3. `package.json`

- [x] **Renamed** `"twenty-app-new"` → `"twenty-app-whatsapp-integration"` (npm package names must be all-lowercase — no camelCase)
- [x] **Added `"keywords": ["twenty-app"]`**
- [x] **Added `"engines": { ..., "twenty": ">=2.40.0" }`**
- [ ] Confirm `"version": "0.1.0"` is the version you want to ship first — the server enforces strictly increasing semver forever after (`VERSION_ALREADY_EXISTS` / `CANNOT_DOWNGRADE_APPLICATION`), so there's no "take it back" on a bad first version, only "ship a newer one"

---

## 4. GitHub Actions — `publish.yml`

- [x] `ci.yml` exists — runs `yarn test` on push/PR
- [x] `cd.yml` exists — deploys to a private server on push to `main`
- [x] **`publish.yml` created** — triggers on `v*` tags or manual dispatch, publishes via `yarn twenty app:publish` (the CLI shells out to `npm publish --access public`, auto-adding `--provenance` when it detects the GitHub OIDC context). Deliberately does *not* run `dev:catalog-sync` — that needs its own authenticated Twenty CLI remote session this CI job doesn't have; run it manually after release if you want the marketplace listing to update before the hourly auto-sync.
- [ ] **Register this repo in npm's Trusted Publisher settings** — this is the one step only you can do, on npmjs.com:
  1. Push this repo to a **public** GitHub repo (provenance requires it, unless you set `TWENTY_APP_PUBLISH_DISABLE_PROVENANCE: 'true'` as a fallback)
  2. On npmjs.com: create the package once manually (`npm publish` locally, or reserve the name), or go to the package's Settings → Trusted Publisher if it already exists
  3. Add a Trusted Publisher entry: GitHub Actions, this repo (`<org>/<repo>`), workflow file `publish.yml`
  4. No `NPM_TOKEN` secret needed after this — npm exchanges the workflow's OIDC token for a scoped publish credential automatically, because the job has `permissions: id-token: write`
- [ ] First publish: push a tag (`git tag v0.1.0 && git push origin v0.1.0`) or run the workflow manually via the Actions tab

---

## 5. Content polish

- [ ] **`README.md`** — per Twenty's guidance, lead with the value proposition + a screenshot, then feature highlights, then technical details. Current README is close to this shape already; give it one more pass since it becomes the marketplace "About" text by default.
- [x] Gallery images (`Timeline.png`, `people_list.png`, `dashboard.png`) — all well under the 10MB limit
- [x] Gallery image aspect ratio — verified: 1230×765(–766), a ratio of ~1.61, essentially exact against the recommended 8:5 (1.6). No changes needed.
- [x] **Removed dead `image.png`** at the repo root (it was an unrelated cartoon dinosaur graphic — not a screenshot, not referenced anywhere)

---

## 6. Optional cleanup (not blocking, flagged in earlier review)

- [ ] `.oxlintrc.json` disables the entire `correctness` lint category and `no-explicit-any` — consider re-enabling before a public release so the linter is actually catching bugs, not just style
- [ ] `ci.yml` only runs `yarn test` — consider adding `yarn lint` and `yarn twenty dev:typecheck` as CI steps so a regression can't merge silently

---

## 7. Publish

Once sections 1–4 are done, publishing is just:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`publish.yml` picks up the tag and runs `yarn twenty app:publish` in CI. Watch the Actions tab
for the run. Manual trigger (Actions tab → Publish → Run workflow) works too, with an optional
`npmTag` input for a pre-release you don't want listed as `latest` (e.g. `beta`).

Afterward, run this manually from a machine with an authenticated Twenty CLI remote if you want
the marketplace listing to update before the automatic hourly sync:

```bash
yarn twenty dev:catalog-sync
```

For a private/internal-only distribution instead of the public marketplace:

```bash
yarn twenty remote:add --url https://your-server.com --as production
yarn twenty app:publish --private -r production
```

---

## 8. Post-publish verification

- [ ] Confirm the app appears correctly in **Settings → Applications** marketplace browsing on a fresh workspace
- [ ] Install it on a throwaway/test workspace end-to-end — Cmd+K → Connect WhatsApp Business → full signup flow → confirm `WORKSPACE_API_KEY` prompt, encrypted key handoff, and a real WhatsApp message creating a `Person` record
- [ ] Check **Settings → Applications → WhatsApp Business → Distribution tab** for the share link and provenance status
