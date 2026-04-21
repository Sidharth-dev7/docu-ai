// docu-ai/services/jira.js
require('dotenv').config();
const axios = require('axios');

function authHeaders() {
  const token = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

async function createTask({ productName, version, confluenceUrl, projectKey, assigneeAccountId }) {
  const payload = {
    fields: {
      project: { key: projectKey },
      summary: `[Docu AI] New draft ready — ${productName} v${version}`,
      description: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: `A new documentation draft has been generated for ${productName} v${version}. Review and approve: ${confluenceUrl}`,
          }],
        }],
      },
      issuetype: { name: 'Asset' },
      assignee: { accountId: assigneeAccountId },
    },
  };

  let res;
  try {
    res = await axios.post(
      `${process.env.JIRA_BASE_URL}/rest/api/3/issue`,
      payload,
      { headers: authHeaders() }
    );
  } catch (err) {
    console.error('[Docu AI] Jira error status:', err.response?.status);
    console.error('[Docu AI] Jira error response:', JSON.stringify(err.response?.data, null, 2));
    throw err;
  }

  const issueKey = res.data.key;

  // Attempt to transition to "Draft" status (non-fatal)
  try {
    const transitionsRes = await axios.get(
      `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
      { headers: authHeaders() }
    );
    const draftTransition = transitionsRes.data.transitions.find(
      t => t.name.toLowerCase() === 'draft'
    );
    if (draftTransition) {
      await axios.post(
        `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
        { transition: { id: draftTransition.id } },
        { headers: authHeaders() }
      );
    } else {
      console.warn(`[Docu AI] No "Draft" transition found for ${issueKey}; left in default status`);
    }
  } catch (err) {
    console.warn(`[Docu AI] Could not transition ${issueKey} to Draft:`, err.message);
  }

  return {
    id: issueKey,
    url: `${process.env.JIRA_BASE_URL}/browse/${issueKey}`,
  };
}

module.exports = { createTask };
