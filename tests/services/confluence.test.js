// docu-ai/tests/services/confluence.test.js
jest.mock('axios');
const axios = require('axios');
const { fetchArticle, fetchArticles, createDraftPage, uploadScreenshot } = require('../../services/confluence');

process.env.CONFLUENCE_BASE_URL = 'https://test.atlassian.net/wiki';
process.env.CONFLUENCE_EMAIL = 'ai@test.com';
process.env.CONFLUENCE_API_TOKEN = 'test-token';

const fakeArticleResponse = {
  data: {
    id: '123',
    title: 'Product A Docs',
    body: { storage: { value: '<p>Existing content.</p>' } },
    space: { key: 'DOCS' },
  },
};

const fakeCreateResponse = {
  data: {
    id: '999',
    _links: { base: 'https://test.atlassian.net/wiki', webui: '/pages/999' },
  },
};

test('fetchArticle returns id, title, content and spaceKey', async () => {
  axios.get.mockResolvedValue(fakeArticleResponse);
  const result = await fetchArticle('123');
  expect(result.id).toBe('123');
  expect(result.title).toBe('Product A Docs');
  expect(result.content).toBe('<p>Existing content.</p>');
  expect(result.spaceKey).toBe('DOCS');
});

test('fetchArticles returns array of articles', async () => {
  axios.get.mockResolvedValue(fakeArticleResponse);
  const results = await fetchArticles(['123', '456']);
  expect(results).toHaveLength(2);
  expect(results[0].id).toBe('123');
});

test('createDraftPage returns id and url', async () => {
  axios.post.mockResolvedValue(fakeCreateResponse);
  const result = await createDraftPage({
    spaceKey: 'DOCS',
    parentId: '000',
    title: 'Product A v2.1 — Draft (Docu AI)',
    content: '<p>New content.</p>',
  });
  expect(result.id).toBe('999');
  expect(result.url).toContain('/pages/999');
});

test('fetchArticle calls the correct Confluence endpoint', async () => {
  axios.get.mockResolvedValue(fakeArticleResponse);
  await fetchArticle('123');
  expect(axios.get).toHaveBeenCalledWith(
    'https://test.atlassian.net/wiki/rest/api/content/123',
    expect.objectContaining({ params: { expand: 'body.storage,space' } })
  );
});
