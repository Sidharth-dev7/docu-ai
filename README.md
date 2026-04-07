# Docu AI

A Slack bot that automatically generates Confluence documentation drafts whenever a release is announced in a designated Slack channel.

## How It Works

1. A release message is posted in the configured Slack `#releases` channel
2. Claude AI interprets the announcement — identifies the product, version, affected pages, and whether it's a feature release or bug-fix-only
3. **Bug-fix-only releases**: Posts a summary to the notifications channel. No Confluence draft or Jira task created.
4. **Feature releases** (with or without bug fixes):
   - Playwright logs into the product and captures screenshots of affected pages
   - Fetches the existing Confluence article and style samples
   - Claude generates an updated article in Confluence Storage Format with green highlights on new/updated content and screenshots embedded inline
   - Creates a new Confluence draft page (never modifies the original)
   - Creates a Jira task under "Draft" status
   - Posts a notification to the Slack notifications channel with the Confluence link (and bug fixes listed if any)

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `SLACK_BOT_TOKEN` | Slack bot token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Slack app signing secret |
| `SLACK_RELEASES_CHANNEL` | Channel ID where releases are posted (e.g. `C0AR413J3B7`) |
| `SLACK_NOTIFICATIONS_CHANNEL` | Channel ID for bot notifications |
| `CONFLUENCE_BASE_URL` | Must include `/wiki` (e.g. `https://yourcompany.atlassian.net/wiki`) |
| `CONFLUENCE_EMAIL` | Atlassian account email |
| `CONFLUENCE_API_TOKEN` | Atlassian classic API token |
| `JIRA_BASE_URL` | e.g. `https://yourcompany.atlassian.net` |
| `JIRA_EMAIL` | Atlassian account email |
| `JIRA_API_TOKEN` | Atlassian **classic** API token (scoped tokens cause errors) |

> **Note:** Channel IDs are not channel names. Right-click a channel in Slack → Copy link to get the ID.

### 3. Configure products

Edit `config/products.json` to add your products. Each product needs:
- Login URL and credentials for Playwright screenshots
- A `pages` map of section names to URL paths
- Confluence article ID, parent ID, and space key
- Jira project key
- Creator emails for notifications

### 4. Set up Slack app

- Enable **Event Subscriptions** and subscribe to `message.channels`
- Set the Request URL to `https://<your-ngrok-url>/slack/events`
- Add OAuth scopes: `chat:write`, `channels:history`, `channels:read`
- Invite the bot to both the releases and notifications channels

### 5. Run the bot

```bash
# Expose local server via ngrok
ngrok http 3000

# Start the bot
node index.js
```

## Project Structure

```
├── index.js                  # Entry point — Slack Bolt app
├── handlers/
│   └── release.js            # Full release pipeline orchestrator
├── services/
│   ├── claude.js             # Claude API — interpret announcements & generate drafts
│   ├── confluence.js         # Confluence REST API — fetch/create pages, upload attachments
│   ├── jira.js               # Jira REST API — create and transition tasks
│   ├── playwright.js         # Headless browser — login and capture screenshots
│   ├── slack.js              # Slack messaging helpers
│   └── email.js              # Email service (currently disabled)
├── config/
│   ├── products.json         # Per-product configuration
│   └── index.js              # Config helpers
└── utils/
    └── diff.js               # Diff utilities
```

## Running Tests

```bash
# Run all tests
npm test

# Run a single test file
npx jest tests/handlers/release.test.js

# Run tests matching a pattern
npx jest --testNamePattern="should post alert"
```
