// docu-ai/services/slack.js

function createSlackService(client) {
  async function postDraftNotification({ channel, productName, version, confluenceUrl, bugFixes = [] }) {
    let text = `:memo: New draft available for *${productName} v${version}*\n:confluence: <${confluenceUrl}|View Confluence Draft>`;
    if (bugFixes.length > 0) {
      text += `\n\n:bug: *Bug fixes in this release:*\n${bugFixes.map(f => `• ${f}`).join('\n')}`;
    }
    await client.chat.postMessage({ channel, text });
  }

  async function postBugFixNotification({ channel, productName, version, bugFixes }) {
    const fixes = bugFixes.length > 0
      ? `\n${bugFixes.map(f => `• ${f}`).join('\n')}`
      : '';
    await client.chat.postMessage({
      channel,
      text: `:bug: *${productName} v${version}* — bug fix release${fixes}`,
    });
  }

  async function postAlert({ channel, message }) {
    await client.chat.postMessage({ channel, text: `:warning: ${message}` });
  }

  return { postDraftNotification, postBugFixNotification, postAlert };
}

module.exports = { createSlackService };
