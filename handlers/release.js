// docu-ai/handlers/release.js
const { generateDraft } = require('../services/claude');
const { captureScreenshots } = require('../services/playwright');
const { fetchArticle, fetchArticles, createDraftPage, uploadScreenshot } = require('../services/confluence');
const { createTask } = require('../services/jira');
const { sendDraftEmail } = require('../services/email');
const { highlightDiff } = require('../utils/diff');

/**
 * Creates the release pipeline handler bound to a Slack service instance.
 * @param {Object} slackService - { postDraftNotification, postAlert }
 * @returns {Function} handler(messageText, notificationsChannel, productConfig, version, affectedPages)
 */
function createReleaseHandler(slackService) {
  /**
   * Runs the full Docu AI pipeline for a single release announcement.
   * Product identification and version extraction happen in index.js before calling this.
   * @param {string} messageText - Raw Slack message text
   * @param {string} notificationsChannel - Slack channel for notifications/alerts
   * @param {Object} productConfig - Pre-resolved product config from config/products.json
   * @param {string} version - Version string extracted from the announcement (e.g. "2.1.0")
   * @param {Array<{name, path}>} affectedPages - Pages to screenshot, resolved by interpretAnnouncement
   * @param {Array<string>} bugFixes - Bug fix descriptions to include in the notification
   * @param {Function} reportProgress - Optional callback(stepLabel) for live progress updates
   */
  async function handleRelease(messageText, notificationsChannel, productConfig, version, affectedPages, bugFixes = [], reportProgress = () => {}) {
    const config = productConfig;

    affectedPages = affectedPages.map(p =>
      typeof p === 'string'
        ? { name: p, path: '', changeType: 'design_change', changeDescription: '' }
        : p
    );

    // Step 1: Screenshot capture (non-fatal — pipeline continues on failure)
    let screenshots = [];
    try { await reportProgress('Capturing screenshots'); } catch {}
    try {
      screenshots = await captureScreenshots(config, affectedPages);
    } catch (err) {
      await slackService.postAlert({
        channel: notificationsChannel,
        message: `screenshot capture failed for ${config.name} v${version}: ${err.message}. Draft will be created without screenshots.`,
      });
    }

    // Step 2: Fetch existing article and style samples
    try { await reportProgress('Fetching Confluence article'); } catch {}
    let existingArticle, styleSamples;
    try {
      existingArticle = await fetchArticle(config.confluenceArticleId);
    } catch (err) {
      throw new Error(`Failed to fetch Confluence article ${config.confluenceArticleId}: ${err.message}`);
    }
    try {
      styleSamples = await fetchArticles(config.styleSampleIds);
    } catch (err) {
      throw new Error(`Failed to fetch Confluence style samples: ${err.message}`);
    }

    // Step 3: Generate new draft content
    try { await reportProgress('Generating draft'); } catch {}
    let draft;
    try {
      const stripHtml = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const imageWidthMatch = existingArticle.content.match(/ac:width="(\d+)"/);
      const imageWidth = imageWidthMatch ? imageWidthMatch[1] : '700';
      draft = await generateDraft({
        releaseText: messageText,
        existingContent: stripHtml(existingArticle.content),
        styleSamples: styleSamples.map(s => stripHtml(s.content)),
        imageWidth,
        screenshotBase64s: screenshots.map(s => s.base64),
        affectedPages,
        productName: config.name,
        version,
      });
    } catch (err) {
      throw new Error(`Failed to generate draft via Claude: ${err.message}`);
    }

    // Step 4: Claude returns Confluence HTML with highlights and screenshots placed inline
    const highlightedContent = draft.content;

    // Step 5: Create Confluence draft page
    try { await reportProgress('Creating Confluence page'); } catch {}
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const draftPage = await createDraftPage({
      spaceKey: config.confluenceSpaceKey,
      parentId: config.confluenceParentId,
      title: `${draft.title} (${timestamp})`,
      content: highlightedContent,
    });

    // Step 6: Upload screenshots as attachments (non-fatal)
    try { await reportProgress('Uploading attachments'); } catch {}
    for (const screenshot of screenshots) {
      try {
        const buffer = Buffer.from(screenshot.base64, 'base64');
        await uploadScreenshot(draftPage.id, `${screenshot.pageName}.png`, buffer);
      } catch (err) {
        await slackService.postAlert({
          channel: notificationsChannel,
          message: `Screenshot upload failed for ${screenshot.pageName}: ${err.message}. Draft is at ${draftPage.url}`,
        });
      }
    }

    // Step 7: Create Jira task (non-fatal)
    try { await reportProgress('Creating Jira task'); } catch {}
    try {
      await createTask({
        productName: config.name,
        version,
        confluenceUrl: draftPage.url,
        projectKey: config.jiraProjectKey,
        assigneeAccountId: config.jiraAssigneeAccountId,
      });
    } catch (err) {
      await slackService.postAlert({
        channel: notificationsChannel,
        message: `Jira task creation failed for ${config.name} v${version}: ${err.message}. Draft is at ${draftPage.url}`,
      });
    }

    // Step 8: Send email (skipped for now)
    if (false) try {
      await sendDraftEmail({
        to: Array.isArray(config.creatorEmail) ? config.creatorEmail.join(', ') : config.creatorEmail,
        productName: config.name,
        version,
        confluenceUrl: draftPage.url,
      });
    } catch (err) {
      console.warn(`[Docu AI] Email delivery failed for ${config.name} v${version}:`, err.message);
      // Slack notification below covers communication
    }

    // Step 9: Slack notification (always last)
    await slackService.postDraftNotification({
      channel: notificationsChannel,
      productName: config.name,
      version,
      confluenceUrl: draftPage.url,
      bugFixes,
    });
    try { await reportProgress('Done'); } catch {}
  }

  return handleRelease;
}

module.exports = { createReleaseHandler };
