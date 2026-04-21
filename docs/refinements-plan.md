# Docu AI — Refinements Plan

## Context

Two improvements to the Docu AI Slack bot pipeline:

1. **Draft quality — screenshot context annotations:** Reviewers can see screenshots in Confluence drafts but have no context about *why* a screenshot is there. A new feature and a layout redesign look the same. Each screenshot needs an infobox explaining the change type, and new features need a green-highlighted doc section below the screenshot matching the page's language style.

2. **UX — real-time pipeline progress:** The pipeline takes ~2 min to complete. Users posting releases have no visibility into progress until the final notification lands. A live-updating Slack message in the notifications channel will show each step completing in real time.

---

## Design

### Feature 1: Real-time progress updates

- `index.js` posts a progress message to `SLACK_NOTIFICATIONS_CHANNEL` immediately when a feature release is detected, saving the returned `ts`
- A `reportProgress(completedSteps[], currentStep)` callback is passed into `handleRelease`
- Each pipeline step calls `reportProgress` on completion; `client.chat.update()` rewrites the message
- Message format — clean, minimalistic, green ticks:
  ```
  Docu AI  ·  preparing draft for *ProductName v1.2.3*
  ✅  Screenshots captured
  ✅  Confluence article fetched
  ⏳  Generating draft...
  ```
- 7 visible steps: Screenshots → Confluence fetch → Draft generation → Page created → Attachments uploaded → Jira task created → Done
- Final step replaces the progress message with the normal draft-ready notification (Confluence link + bug fixes)
- If `reportProgress` itself fails (Slack API error), it logs and continues silently — never kills the pipeline

### Feature 2: Per-page change annotations in Confluence draft

**Schema change to `interpretAnnouncement`:**

`affectedPages` changes from `string[]` to:
```json
[
  {
    "name": "Dashboard",
    "changeType": "new_feature",
    "changeDescription": "Added CSV export button to the top bar"
  },
  {
    "name": "Settings",
    "changeType": "design_change",
    "changeDescription": "Redesigned the permissions panel layout"
  }
]
```

Claude extracts `changeType` from announcement text if explicit, infers otherwise. `changeDescription` is one sentence.

**What gets inserted per screenshot in the draft:**
- All pages: Confluence info macro (`<ac:structured-macro ac:name="info">`) above the screenshot with the `changeDescription`
- `new_feature` pages only: a green-highlighted (`#d4edda`) documentation content block immediately below the screenshot, written in the same language style as the existing article
- `design_change` pages: infobox only — no new content block

**Fallback normalization in `handlers/release.js`:**
If `affectedPages` comes back as flat strings (Claude ignores new schema), wrap each as `{ name, changeType: "design_change", changeDescription: "" }`. If `changeDescription` is empty, skip the infobox for that page.

---

## Files to Modify

| File | Change |
|------|--------|
| `services/claude.js` | Update `interpretAnnouncement` prompt + JSON schema for enriched `affectedPages`; update `generateDraft` prompt to insert infoboxes + green content blocks |
| `handlers/release.js` | Accept `reportProgress` callback param; call it at each of the 7 steps; use `page.name` for page matching; normalize flat-string `affectedPages` |
| `index.js` | Post initial progress message on feature release; save `ts`; build + pass `reportProgress` callback |
| `tests/services/claude.test.js` | Add tests for new `affectedPages` schema, normalization fallback, and that `generateDraft` prompt includes infobox/green-content instructions |
| `tests/handlers/release.test.js` | Add tests for `reportProgress` called at each step; Slack update failure doesn't propagate |

---

## Implementation Steps

1. **`services/claude.js` — `interpretAnnouncement`**
   - Update system prompt to request enriched `affectedPages` schema (name + changeType + changeDescription)
   - Update JSON strip/parse logic to handle the new shape
   - Keep backward-compat: if `affectedPages` is strings, normalization in release.js handles it

2. **`services/claude.js` — `generateDraft`**
   - Update prompt to instruct Claude to insert a Confluence info macro above each screenshot
   - For `new_feature` pages: instruct Claude to add a green-highlighted content block below the screenshot, matching existing article language style
   - Pass enriched `affectedPages` metadata into the prompt

3. **`handlers/release.js`**
   - Add `reportProgress` as optional callback param (default: no-op)
   - Call `reportProgress` after each of the 7 trackable steps
   - Update page name matching to use `page.name` from enriched object
   - Add normalization: `affectedPages.map(p => typeof p === 'string' ? { name: p, changeType: 'design_change', changeDescription: '' } : p)`

4. **`index.js`**
   - After `interpretAnnouncement` returns `feature`, immediately post progress message to `SLACK_NOTIFICATIONS_CHANNEL` via `client.chat.postMessage`
   - Build `reportProgress` closure over `client`, `channel`, and `ts`
   - Pass `reportProgress` to `handleRelease`

5. **Tests**
   - `claude.test.js`: new schema shape, fallback, prompt content assertions
   - `release.test.js`: callback invocation count, Slack failure non-propagation

---

## Render Deployment (Always-On Hosting)

Socket Mode was added so the bot can run 24/7 without ngrok or a public HTTP endpoint — it maintains a persistent outbound WebSocket connection to Slack.

**`render.yaml`** — defines a `web` service named `docu-ai`:
- **Build:** `npm install && npx playwright install chromium --with-deps`
- **Start:** `node index.js`
- **Health check:** `GET /`
- All secrets passed as env vars (`sync: false` — set manually in Render dashboard):
  - `ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`
  - `SLACK_RELEASES_CHANNEL`, `SLACK_NOTIFICATIONS_CHANNEL`
  - `CONFLUENCE_BASE_URL`, `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN`
  - `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
  - `PLAYWRIGHT_USERNAME`, `PLAYWRIGHT_PASSWORD` (moved from `products.json` to env)

**Socket Mode requirement:** `SLACK_APP_TOKEN` must be a Slack App-Level Token (starts with `xapp-`). Enable Socket Mode in the Slack app settings and generate this token under *App-Level Tokens* with `connections:write` scope.

**Playwright on Render:** Chromium is installed during build via `npx playwright install chromium --with-deps`. Render's free tier may time out on long pipeline runs (~2 min); use at least the Starter plan for reliable execution.

---

## Verification

```bash
# Run all tests
npm test

# Smoke test: post a mock feature release message to the releases channel
# Expected:
# 1. Progress message appears immediately in notifications channel
# 2. Message updates step-by-step as pipeline runs
# 3. Final message is replaced with draft-ready notification + Confluence link
# 4. Confluence draft contains infoboxes above screenshots
# 5. New-feature pages have green content block below screenshot
# 6. Design-change pages have infobox only

# Run specific test files
npx jest tests/services/claude.test.js
npx jest tests/handlers/release.test.js
```
