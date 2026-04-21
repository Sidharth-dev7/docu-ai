# Docu AI — v2.0 Refinements

**Date:** 2026-04-13
**Status:** Planned — not yet implemented

## What's New in v2.0

### 1. Real-time Pipeline Progress in Slack

When a feature release is posted, a live progress message appears immediately in the notifications channel and updates step-by-step as the pipeline runs:

```
Docu AI  ·  preparing draft for *ProductName v1.2.3*
✅  Screenshots captured
✅  Confluence article fetched
⏳  Generating draft...
```

The final draft-ready notification replaces this message when complete.

### 2. Screenshot Context Annotations in Confluence Draft

Each screenshot in the generated Confluence draft now includes an infobox explaining what changed on that page:

- **New feature pages** — infobox above the screenshot + AI-generated documentation content section below it (green-highlighted, matching the article's language style)
- **Design change pages** — infobox only, describing the visual change

Claude extracts the change type and description from the release announcement text, inferring when not explicit.

---

## Design Spec

Full design: [`docs/superpowers/specs/2026-04-13-docu-ai-refinements-design.md`](superpowers/specs/2026-04-13-docu-ai-refinements-design.md)

## Implementation Plan

Full plan: [`~/.claude/plans/pure-drifting-liskov.md`](~/.claude/plans/pure-drifting-liskov.md)

## Files Affected

- `services/claude.js`
- `handlers/release.js`
- `index.js`
- `tests/services/claude.test.js`
- `tests/handlers/release.test.js`
