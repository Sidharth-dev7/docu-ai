// docu-ai/tests/services/jira.test.js
jest.mock('axios');
const axios = require('axios');
const { createTask } = require('../../services/jira');

process.env.JIRA_BASE_URL = 'https://test.atlassian.net';
process.env.JIRA_EMAIL = 'ai@test.com';
process.env.JIRA_API_TOKEN = 'test-token';

test('createTask returns id and url', async () => {
  axios.post.mockResolvedValue({
    data: { id: 'DOCS-42', key: 'DOCS-42' },
  });
  axios.get.mockResolvedValue({ data: { transitions: [] } });

  const result = await createTask({
    productName: 'Product A',
    version: '2.1.0',
    confluenceUrl: 'https://test.atlassian.net/wiki/pages/999',
    projectKey: 'DOCS',
    assigneeAccountId: 'abc123',
  });

  expect(result.id).toBe('DOCS-42');
  expect(result.url).toContain('DOCS-42');
});

test('createTask sends correct issue payload', async () => {
  axios.post.mockResolvedValue({ data: { id: 'DOCS-1', key: 'DOCS-1' } });
  axios.get.mockResolvedValue({ data: { transitions: [] } });

  await createTask({
    productName: 'Product A',
    version: '2.1.0',
    confluenceUrl: 'https://test.atlassian.net/wiki/pages/999',
    projectKey: 'DOCS',
    assigneeAccountId: 'abc123',
  });

  const payload = axios.post.mock.calls[0][1];
  expect(payload.fields.summary).toContain('Product A');
  expect(payload.fields.summary).toContain('2.1.0');
  expect(payload.fields.assignee.accountId).toBe('abc123');
});
