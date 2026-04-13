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
 * @returns {Promise<{product: string, version: string, affectedPages: Array<{name, path, changeType, changeDescription}>} | null>}
 */
async function interpretAnnouncement(messageText, products) {
  const productList = products
    .map(p => {
      const pageNames = p.pages ? `pages: ${Object.keys(p.pages).join(', ')}` : '';
      return `- "${p.name}" (keywords: ${p.keywords.join(', ')}${pageNames ? '; ' + pageNames : ''})`;
    })
    .join('\n');

  // console.log('[Docu AI] Calling Claude API with key:', process.env.ANTHROPIC_API_KEY?.slice(0, 20) + '...');

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
    {
      "name": "<page name exactly as listed above>",
      "path": "<URL path like /settings>",
      "changeType": "<'new_feature' or 'design_change'>",
      "changeDescription": "<one concise sentence describing what changed on this specific page>"
    }
  ]
}

For releaseType: use "bugfix_only" only if there are zero new features or enhancements — purely fixes. Use "feature" if there is at least one new feature, improvement, or UI change.
For bugFixes: list each bug fix as a short plain-text description. Empty array if none.
For affectedPages: use the exact page names listed above for the identified product. Only include pages relevant to new features/changes (not bug fixes). If no specific pages are mentioned, return an empty array.
For changeType: use "new_feature" if a new capability or UI element was added, "design_change" if an existing UI element was modified in appearance or layout. Extract from the announcement if explicit, otherwise infer.
For changeDescription: one concise sentence describing what changed on that specific page.`,
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
    console.error('[Docu AI] JSON parse failed');
    return null;
  }

  if (!parsed.product) return null;
  const VALID_RELEASE_TYPES = ['bugfix_only', 'feature'];
  parsed.releaseType = VALID_RELEASE_TYPES.includes(parsed.releaseType) ? parsed.releaseType : 'feature';
  parsed.bugFixes = Array.isArray(parsed.bugFixes) ? parsed.bugFixes : [];
  parsed.affectedPages = (Array.isArray(parsed.affectedPages) ? parsed.affectedPages : []).map(p =>
    typeof p === 'string'
      ? { name: p, path: '', changeType: 'design_change', changeDescription: '' }
      : { changeType: 'design_change', changeDescription: '', ...p }
  );
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
 * @param {Array<{name, path, changeType, changeDescription}>} params.affectedPages
 * @param {string} params.productName
 * @param {string} params.version
 * @returns {Promise<{title: string, content: string}>}
 */
async function generateDraft({ releaseText, existingContent, styleSamples, screenshotBase64s, affectedPages, productName, version, imageWidth = '700' }) {
  const styleContext = styleSamples
    .map((s, i) => `--- Style Sample ${i + 1} ---\n${s}`)
    .join('\n\n');

  const pagesContext = affectedPages.map(p =>
    `${p.name} (${p.changeType === 'new_feature' ? 'new feature' : 'design change'}: ${p.changeDescription || ''})`
  ).join(', ');

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

${screenshotBase64s.length > 0 ? `The attached screenshots show the updated UI for the pages listed below.
Where the existing article has images or where updated UI is described, embed the relevant screenshot inline.
Place each screenshot immediately after the section that describes that page/feature. If the existing article already had a screenshot in that location, replace it with the new one.
Use this exact macro format with width ${imageWidth}: <ac:image ac:width="${imageWidth}"><ri:attachment ri:filename="FILENAME"/></ac:image>

Available screenshots and their change context:
${affectedPages.map(p => `- ${p.name}.png — ${p.changeType === 'new_feature' ? 'NEW FEATURE' : 'DESIGN CHANGE'}: ${p.changeDescription || ''}`).join('\n')}

For each screenshot, apply the following rules:
1. If the page's changeDescription is non-empty, insert a Confluence info macro ABOVE the screenshot. Use "New Feature" as the title if the changeType is "new_feature", or "Design Change" if it is "design_change". The macro format is:
<ac:structured-macro ac:name="info">
  <ac:parameter ac:name="title">New Feature</ac:parameter>
  <ac:rich-text-body><p>CHANGE_DESCRIPTION</p></ac:rich-text-body>
</ac:structured-macro>
Replace "New Feature" with "Design Change" where appropriate, and replace CHANGE_DESCRIPTION with the actual description.
2. For NEW FEATURE pages only: after the screenshot, add a new green-highlighted documentation paragraph describing the feature from a user's perspective, written in the same language style as the existing article. Wrap this paragraph in: <span style="background-color: #d4edda;">...</span>` : ''}

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
