# Docu AI Refinements — Design Spec
**Date:** 2026-04-13

## Overview

Two improvements to the Docu AI Slack bot pipeline:

1. **Screenshot context annotations** — Confluence draft reviewers currently see screenshots with no context about what changed. Each screenshot needs an infobox explaining whether it's a new feature or design change, and new features need a green-highlighted doc section below the screenshot.

2. **Real-time pipeline progress** — The pipeline takes ~2 min. A live-updating Slack message in the notifications channel will show each step completing in real time.

---

## Feature 1: Real-time Progress Updates

### Flow

1. `index.js` posts a progress message to `SLACK_NOTIFICATIONS_CHANNEL` immediately when a feature release is detected, saving the returned `ts`
2. A `reportProgress(completedSteps[], currentStep)` callback is passed into `handleRelease`
3. Each pipeline step calls `reportProgress` on completion; `client.chat.update()` rewrites the message
4. Final step replaces the progress message with the normal draft-ready notification

### Message Format

```
Docu AI  ·  preparing draft for *ProductName v1.2.3*
✅  Screenshots captured
✅  Confluence article fetched
⏳  Generating draft...
```

Clean, minimalistic, green ticks. No extra noise.

### Steps Tracked (7)

Screenshots → Confluence fetch → Draft generation → Page created → Attachments uploaded → Jira task created → Done

### Error Handling

If `reportProgress` fails (Slack API error updating the message), it logs and continues silently — never kills the pipeline.

---

## Feature 2: Per-page Change Annotations in Confluence Draft

### Schema Change — `interpretAnnouncement`

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

Claude extracts `changeType` from the announcement text if explicit, infers if not mentioned. `changeDescription` is one sentence.

### What Gets Inserted Per Screenshot

- **All pages:** Confluence info macro above the screenshot with the `changeDescription`
  ```xml
  <ac:structured-macro ac:name="info">
    <ac:parameter ac:name="title">Design Change</ac:parameter>
    <ac:rich-text-body><p>Redesigned the permissions panel layout</p></ac:rich-text-body>
  </ac:structured-macro>
  ```
- **`new_feature` only:** Green-highlighted (`#d4edda`) documentation content block immediately below the screenshot, written in the same language style as the existing article
- **`design_change` only:** Infobox only — no new content block

### Fallback Normalization

If `affectedPages` comes back as flat strings (Claude ignores new schema), `handlers/release.js` normalizes:
```js
affectedPages.map(p =>
  typeof p === 'string'
    ? { name: p, changeType: 'design_change', changeDescription: '' }
    : p
)
```

If `changeDescription` is empty, the infobox is skipped for that page.

---

## Files to Modify

| File | Change |
|------|--------|
| `services/claude.js` | Update `interpretAnnouncement` prompt + schema; update `generateDraft` prompt for infoboxes + green content blocks |
| `handlers/release.js` | Accept `reportProgress` callback; call at each step; normalize `affectedPages`; use `page.name` for matching |
| `index.js` | Post initial progress message; save `ts`; build + pass `reportProgress` callback |
| `tests/services/claude.test.js` | New schema shape, normalization fallback, prompt content assertions |
| `tests/handlers/release.test.js` | Callback invocation count, Slack failure non-propagation |

---

## Verification

```bash
npm test
npx jest tests/services/claude.test.js
npx jest tests/handlers/release.test.js
```

Smoke test: post a mock feature release → confirm progress message appears and updates → confirm Confluence draft has infoboxes and green content sections on new-feature pages.
