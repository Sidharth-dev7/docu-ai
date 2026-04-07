# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the bot
node index.js

# Run all tests
npm test

# Run a single test file
npx jest tests/handlers/release.test.js

# Run tests matching a pattern
npx jest --testNamePattern="should post alert"
```

The bot requires ngrok (or equivalent) to receive Slack events locally:
```bash
ngrok http 3000
# Paste the forwarding URL into Slack app → Event Subscriptions → Request URL as: https://<ngrok-url>/slack/events
```

## Architecture

Docu AI is a Slack bot that auto-generates Confluence documentation drafts when a release is posted in a dedicated Slack channel.

**Entry point:** `index.js` — Slack Bolt app. Listens to all messages, filters to `SLACK_RELEASES_CHANNEL`, calls `interpretAnnouncement` (Claude), then branches:
- **Bug-fix-only** (`releaseType === "bugfix_only"`): posts a `:bug:` summary to `SLACK_NOTIFICATIONS_CHANNEL` and stops. No Confluence draft, no Jira task.
- **Feature release** (`releaseType === "feature"`): delegates to `handleRelease`, passing `bugFixes` along so they appear at the bottom of the Slack notification.

**Pipeline (`handlers/release.js`):** The single orchestrator. Runs these steps in order:
1. Playwright screenshots affected pages (non-fatal — draft continues without them)
2. Fetch existing Confluence article + style sample articles (fatal if fails)
3. Claude generates updated draft content in Confluence Storage Format HTML
4. Claude-generated HTML already includes green highlights on new/updated content
5. Create new Confluence draft page under `confluenceParentId` (never modifies originals). Title includes timestamp to avoid duplicates.
6. Upload screenshots as attachments (non-fatal)
7. Create Jira task with issue type `Asset`, then transition it to "Draft" status via the transitions API (non-fatal — stays in "To Do" if transition not found)
8. Email skipped (disabled — SMTP setup pending)
9. Post Slack notification to `SLACK_NOTIFICATIONS_CHANNEL` (always last). If `bugFixes` were passed, they are listed below the Confluence link.

**Product config (`config/products.json`):** All per-product settings live here — login URL/credentials/selectors, a `pages` map of section names to URL paths, Confluence article IDs, Jira project key, assignee, and creator emails. `config/index.js` exposes `getProductByName()` and `getAllProducts()`. `creatorEmail` supports both a string and an array of strings.

**Claude model:** `claude-sonnet-4-6` (hardcoded in `services/claude.js`). Two calls per pipeline run:
- `interpretAnnouncement` — identifies product, version, `releaseType` (`"bugfix_only"` | `"feature"`), `bugFixes` (array of strings), and `affectedPages` from Slack text. Uses known page names from `products.json` so Claude picks exact names rather than guessing paths. Strips ` ```json ``` ` fences before parsing.
- `generateDraft` — produces updated article as Confluence Storage Format HTML. Claude applies green (`#d4edda`) highlights to new/updated content inline. Does NOT use a mechanical diff.

**Screenshot flow:** Playwright logs in using product credentials, waits for redirect away from `/login`, then navigates to each affected page using the `pages` map in `products.json`. If a page name from Claude doesn't match any known page, it's skipped. Client-side 404s (SPA apps) are detected by checking body text and skipped. Screenshots are uploaded as attachments and Claude embeds them inline using `<ac:image ac:width="N"><ri:attachment ri:filename="..."/></ac:image>` macros at the correct position in the article.

**Confluence storage format:** Draft pages use Confluence Storage Format (HTML subset). Highlights use inline `<span style="background-color: #d4edda;">` for new/updated content. Image macros use `ac:width` matching the original article's image dimensions.

**Auth pattern:** Confluence and Jira both use HTTP Basic Auth (`email:api_token` base64-encoded). Playwright uses dedicated product credentials stored in `products.json` (not `.env`). Jira uses a classic (unscoped) API token — scoped tokens cause 400 errors on issue creation.

## Environment

All secrets go in `.env` (see `.env.example`). Key variables:
- `SLACK_RELEASES_CHANNEL` / `SLACK_NOTIFICATIONS_CHANNEL` — must be Slack **channel IDs** (e.g. `C0AR413J3B7`), not names
- `CONFLUENCE_BASE_URL` — must include `/wiki` (e.g. `https://yourcompany.atlassian.net/wiki`)
- `JIRA_BASE_URL` — same domain without `/wiki` (e.g. `https://yourcompany.atlassian.net`)
- `JIRA_API_TOKEN` — must be a **classic** Atlassian API token (not a scoped token)
- `EMAIL_PASS` — Gmail App Password without spaces (16 chars). Email sending is currently disabled in `handlers/release.js`.

## Known Issues / To Do
- Email notifications disabled pending Gmail App Password setup
- Draft content quality is ~70% — Claude prompt tuning ongoing
