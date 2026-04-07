// docu-ai/services/confluence.js
require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');

function authToken() {
  return Buffer.from(
    `${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`
  ).toString('base64');
}

function authHeaders() {
  return { Authorization: `Basic ${authToken()}`, 'Content-Type': 'application/json' };
}

const base = () => `${process.env.CONFLUENCE_BASE_URL}/rest/api/content`;

async function fetchArticle(articleId) {
  const res = await axios.get(`${base()}/${articleId}`, {
    headers: authHeaders(),
    params: { expand: 'body.storage,space' },
  });
  return {
    id: res.data.id,
    title: res.data.title,
    content: res.data.body.storage.value,
    spaceKey: res.data.space.key,
  };
}

async function fetchArticles(articleIds) {
  return Promise.all(articleIds.map(fetchArticle));
}

async function createDraftPage({ spaceKey, parentId, title, content }) {
  const body = {
    type: 'page',
    title,
    space: { key: spaceKey },
    ancestors: [{ id: parentId }],
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
  };
  const res = await axios.post(base(), body, { headers: authHeaders() });
  return {
    id: res.data.id,
    url: `${res.data._links.base}${res.data._links.webui}`,
  };
}

async function uploadScreenshot(pageId, filename, imageBuffer) {
  const form = new FormData();
  form.append('file', imageBuffer, { filename, contentType: 'image/png' });
  await axios.post(
    `${base()}/${pageId}/child/attachment`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Basic ${authToken()}`,
        'X-Atlassian-Token': 'nocheck',
      },
    }
  );
}

module.exports = { fetchArticle, fetchArticles, createDraftPage, uploadScreenshot };
