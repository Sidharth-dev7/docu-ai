// docu-ai/services/claude.js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

/**
 * Interprets a Slack release announcement and identifies the product, version,
 * and which pages of the product UI were affected.
 *
 * @param {string} messageText - The raw Slack release message
 * @param {Array<{name: string, keywords: string[]}>} products - All configured products
 * @returns {Promise<{product: string, version: string, affectedPages: Array<{name, path}>} | null>}
 */
async function interpretAnnouncement(messageText, products) {
  const productList = products
    .map(p => {
      const pageNames = p.pages ? `pages: ${Object.keys(p.pages).join(', ')}` : '';
      return `- "${p.name}" (keywords: ${p.keywords.join(', ')}${pageNames ? '; ' + pageNames : ''})`;
    })
    .join('\n');

  console.log('[Docu AI] Calling Claude API with key:', process.env.ANTHROPIC_API_KEY?.slice(0, 20) + '...');

  let response;
  try {
    response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are a release detection assistant. Given a Slack release announcement, identify the product, version number, release type, bug fixes, and which pages/features of its UI were updated.

Known products:
${productList}

Release announcement:
"${messageText}"

Respond ONLY with valid JSON in this exact format:
{
  "product": "<product name exactly as listed above, or null if unidentifiable>",
  "version": "<version string like 2.1.0, or null>",
  "releaseType": "<'bugfix_only' if the release contains ONLY bug fixes with no new features, otherwise 'feature'>",
  "bugFixes": ["<short description of each bug fix, one per item>"],
  "affectedPages": [
    { "name": "<feature name>", "path": "<URL path like /settings>" }
  ]
}

For releaseType: use "bugfix_only" only if there are zero new features or enhancements — purely fixes. Use "feature" if there is at least one new feature, improvement, or UI change.
For bugFixes: list each bug fix as a short plain-text description. Empty array if none.
For affectedPages: use the exact page names listed above for the identified product. Only include pages relevant to new features/changes (not bug fixes). If no specific pages are mentioned, return an empty array.`,
    }],
    });
  } catch (err) {
    console.error('[Docu AI] Claude API call failed:', err.message);
    return null;
  }

  console.log('[Docu AI] Claude raw response:', response.content[0].text);

  let parsed;
  try {
    const raw = response.content[0].text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(raw);
  } catch {
    console.log('[Docu AI] JSON parse failed');
    return null;
  }

  if (!parsed.product) return null;
  // Ensure defaults for new fields
  parsed.releaseType = parsed.releaseType || 'feature';
  parsed.bugFixes = Array.isArray(parsed.bugFixes) ? parsed.bugFixes : [];
  return parsed;
}

/**
 * Generates a new draft article incorporating the release changes.
 *
 * @param {Object} params
 * @param {string} params.releaseText
 * @param {string} params.existingContent - Plain text of the existing Confluence article
 * @param {string[]} params.styleSamples - Plain text of 4-5 style sample articles
 * @param {string[]} params.screenshotBase64s - Base64 encoded screenshots (may be empty)
 * @param {Array<{name, path}>} params.affectedPages
 * @param {string} params.productName
 * @param {string} params.version
 * @returns {Promise<{title: string, content: string}>}
 */
async function generateDraft({ releaseText, existingContent, styleSamples, screenshotBase64s, affectedPages, productName, version, imageWidth = '700' }) {
  const styleContext = styleSamples
    .map((s, i) => `--- Style Sample ${i + 1} ---\n${s}`)
    .join('\n\n');

  const pagesContext = affectedPages.map(p => p.name).join(', ');

  const imageContent = screenshotBase64s.map(b64 => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: b64 },
  }));

  const messages = [{
    role: 'user',
    content: [
      ...imageContent,
      {
        type: 'text',
        text: `You are a technical documentation writer. Your job is to update an existing product article to reflect a new release.

Release announcement:
"${releaseText}"

Updated pages/features: ${pagesContext}

Existing article content (plain text):
${existingContent}

Writing style samples from this team (follow this style closely):
${styleContext}

${screenshotBase64s.length > 0 ? `The attached screenshots show the updated UI for: ${pagesContext}.
Where the existing article has images or where updated UI is described, embed the relevant screenshot inline using this Confluence macro (replace FILENAME with the actual filename):
<ac:image><ri:attachment ri:filename="FILENAME"/></ac:image>
Available screenshot filenames: ${affectedPages.map(p => `${p.name}.png`).join(', ')}
Place each screenshot immediately after the section that describes that page/feature. If the existing article already had a screenshot in that location, replace it with the new one.
Use this exact macro format with width ${imageWidth}: <ac:image ac:width="${imageWidth}"><ri:attachment ri:filename="FILENAME"/></ac:image>` : ''}

Write the updated article in Confluence Storage Format (HTML). Keep all existing content exactly as-is unless it directly relates to the release changes. ONLY add or update content that is explicitly mentioned in the release announcement. Do NOT add new sections, explanations, or information that is not in the release notes or existing article.

Highlight changes as follows:
- Wrap any NEW or UPDATED sentences/bullet points in: <span style="background-color: #d4edda;">...</span>
- Leave all unchanged content as-is with no highlight

Use proper Confluence HTML structure:
- Intro/opening paragraph: <p> (never use a heading for the intro)
- Headings: <h2>, <h3>
- Paragraphs: <p>
- Lists: <ul><li> or <ol><li>
- Notes: <p><strong>📌 Note</strong> ...</p>

Respond with ONLY the Confluence Storage Format HTML. No JSON, no markdown, no code fences.`,
      },
    ],
  }];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages,
  });

  return {
    title: `${productName} v${version} — Draft (Docu AI)`,
    content: response.content[0].text.trim(),
  };
}

module.exports = { interpretAnnouncement, generateDraft };
