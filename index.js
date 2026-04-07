// docu-ai/index.js
require('dotenv').config();
const { App } = require('@slack/bolt');
const { createSlackService } = require('./services/slack');
const { createReleaseHandler } = require('./handlers/release');
const { getProductByName, getAllProducts } = require('./config/index');
const { interpretAnnouncement } = require('./services/claude');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const slackService = createSlackService(app.client);
const handleRelease = createReleaseHandler(slackService);

const RELEASES_CHANNEL = process.env.SLACK_RELEASES_CHANNEL;
const NOTIFICATIONS_CHANNEL = process.env.SLACK_NOTIFICATIONS_CHANNEL;

// Listen to all messages in the #releases channel
app.message(async ({ message }) => {
  console.log(`[Docu AI] Event received — channel: ${message.channel}, channel_type: ${message.channel_type}`);
  // Only process messages from the configured releases channel
  if (message.channel_type !== 'channel') return;
  if (message.channel !== RELEASES_CHANNEL) return;

  const messageText = message.text || '';
  if (!messageText.trim()) return;

  console.log(`[Docu AI] Release message received: ${messageText.slice(0, 80)}...`);

  try {
    const allProducts = getAllProducts();
    const interpretation = await interpretAnnouncement(messageText, allProducts);

    if (!interpretation) {
      console.log('[Docu AI] interpretAnnouncement returned null');
      await slackService.postAlert({
        channel: NOTIFICATIONS_CHANNEL,
        message: 'Could not identify product from release message — manual review needed.',
      });
      return;
    }

    const productConfig = getProductByName(interpretation.product);
    if (!productConfig) {
      await slackService.postAlert({
        channel: NOTIFICATIONS_CHANNEL,
        message: `Product "${interpretation.product}" identified but not found in config. Check products.json.`,
      });
      return;
    }

    if (interpretation.releaseType === 'bugfix_only') {
      await slackService.postBugFixNotification({
        channel: NOTIFICATIONS_CHANNEL,
        productName: interpretation.product,
        version: interpretation.version,
        bugFixes: interpretation.bugFixes,
      });
      return;
    }

    await handleRelease(messageText, NOTIFICATIONS_CHANNEL, productConfig, interpretation.version, interpretation.affectedPages, interpretation.bugFixes);
  } catch (err) {
    console.error('[Docu AI] Pipeline error:', err);
    await slackService.postAlert({
      channel: NOTIFICATIONS_CHANNEL,
      message: `Unexpected error processing release: ${err.message}`,
    });
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('[Docu AI] Bot is running on port', process.env.PORT || 3000);
})();
