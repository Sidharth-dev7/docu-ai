// docu-ai/tests/handlers/release.test.js
jest.mock('../../services/claude');
jest.mock('../../services/playwright');
jest.mock('../../services/confluence');
jest.mock('../../services/jira');
jest.mock('../../services/email');

const claude = require('../../services/claude');
const playwright = require('../../services/playwright');
const confluence = require('../../services/confluence');
const jira = require('../../services/jira');
const email = require('../../services/email');
const { createReleaseHandler } = require('../../handlers/release');

const mockSlack = { postDraftNotification: jest.fn(), postAlert: jest.fn() };
const handler = createReleaseHandler(mockSlack);

const NOTIFICATIONS_CHANNEL = 'docs-notifications';
const FAKE_VERSION = '2.1.0';
const FAKE_PAGES = [{ name: 'Settings', path: '/settings' }];
const FAKE_PAGES_ENRICHED = [{ name: 'Settings', path: '/settings', changeType: 'new_feature', changeDescription: 'Added export button' }];

const fakeProduct = {
  name: 'Product A',
  url: 'https://producta.example.com',
  loginPath: '/login',
  credentials: { usernameSelector: '#email', passwordSelector: '#password', submitSelector: 'button', username: 'ai@co.com', password: 'pw' },
  confluenceSpaceKey: 'DOCS',
  confluenceArticleId: '111',
  confluenceParentId: '000',
  styleSampleIds: ['222', '333'],
  jiraProjectKey: 'DOCS',
  jiraAssigneeAccountId: 'abc123',
  creatorEmail: 'writer@company.com',
};

beforeEach(() => {
  jest.clearAllMocks();

  playwright.captureScreenshots.mockResolvedValue([
    { pageName: 'Settings', base64: 'abc123' },
  ]);
  confluence.fetchArticle.mockResolvedValue({ id: '111', title: 'Docs', content: '<p>Old</p>', spaceKey: 'DOCS' });
  confluence.fetchArticles.mockResolvedValue([
    { id: '222', title: 'Sample 1', content: '<p>Style</p>', spaceKey: 'DOCS' },
  ]);
  confluence.createDraftPage.mockResolvedValue({ id: '999', url: 'https://confluence/pages/999' });
  confluence.uploadScreenshot.mockResolvedValue();
  claude.generateDraft.mockResolvedValue({ title: 'Product A v2.1.0 — Draft', content: '<p>New</p>' });
  jira.createTask.mockResolvedValue({ id: 'DOCS-42', url: 'https://jira/DOCS-42' });
  email.sendDraftEmail.mockResolvedValue();
  mockSlack.postDraftNotification.mockResolvedValue();
  mockSlack.postAlert.mockResolvedValue();
});

test('runs full pipeline for a valid release message', async () => {
  await handler('Product A v2.1.0 released — updated Settings', NOTIFICATIONS_CHANNEL, fakeProduct, FAKE_VERSION, FAKE_PAGES);
  expect(confluence.createDraftPage).toHaveBeenCalled();
  expect(jira.createTask).toHaveBeenCalled();
  expect(mockSlack.postDraftNotification).toHaveBeenCalled();
  expect(mockSlack.postAlert).not.toHaveBeenCalled();
});

test('continues pipeline if screenshot capture fails', async () => {
  playwright.captureScreenshots.mockRejectedValue(new Error('Login failed'));
  await handler('Product A v2.1.0 released — updated Settings', NOTIFICATIONS_CHANNEL, fakeProduct, FAKE_VERSION, FAKE_PAGES);
  expect(confluence.createDraftPage).toHaveBeenCalled();
  expect(mockSlack.postAlert).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining('screenshot'),
  }));
});

test('continues pipeline and sends Slack notification if Jira fails', async () => {
  jira.createTask.mockRejectedValue(new Error('Jira down'));
  await handler('Product A v2.1.0 released — updated Settings', NOTIFICATIONS_CHANNEL, fakeProduct, FAKE_VERSION, FAKE_PAGES);
  expect(mockSlack.postDraftNotification).toHaveBeenCalled();
  expect(mockSlack.postAlert).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining('Jira task creation failed'),
  }));
});

test('does not call email (email step is currently disabled)', async () => {
  await handler('Product A v2.1.0 released — updated Settings', NOTIFICATIONS_CHANNEL, fakeProduct, FAKE_VERSION, FAKE_PAGES);
  expect(email.sendDraftEmail).not.toHaveBeenCalled();
  expect(mockSlack.postDraftNotification).toHaveBeenCalled();
});

test('bubbles up error if Confluence page creation fails', async () => {
  confluence.createDraftPage.mockRejectedValue(new Error('Confluence API 500'));
  await expect(
    handler('Product A v2.1.0 released — updated Settings', NOTIFICATIONS_CHANNEL, fakeProduct, FAKE_VERSION, FAKE_PAGES)
  ).rejects.toThrow('Confluence API 500');
  expect(mockSlack.postDraftNotification).not.toHaveBeenCalled();
});

test('calls reportProgress for each pipeline step', async () => {
  const reportProgress = jest.fn().mockResolvedValue();
  await handler('Product A v2.1.0 released — updated Settings', NOTIFICATIONS_CHANNEL, fakeProduct, FAKE_VERSION, FAKE_PAGES_ENRICHED, [], reportProgress);
  expect(reportProgress).toHaveBeenCalledWith('Screenshots captured');
  expect(reportProgress).toHaveBeenCalledWith('Confluence article fetched');
  expect(reportProgress).toHaveBeenCalledWith('Draft generated');
  expect(reportProgress).toHaveBeenCalledWith('Confluence page created');
  expect(reportProgress).toHaveBeenCalledWith('Attachments uploaded');
  expect(reportProgress).toHaveBeenCalledWith('Jira task created');
  expect(reportProgress).toHaveBeenCalledWith('Done');
  expect(reportProgress).toHaveBeenCalledTimes(7);
});

test('continues pipeline if reportProgress throws', async () => {
  const reportProgress = jest.fn().mockRejectedValue(new Error('Slack update failed'));
  await handler('Product A v2.1.0 released — updated Settings', NOTIFICATIONS_CHANNEL, fakeProduct, FAKE_VERSION, FAKE_PAGES_ENRICHED, [], reportProgress);
  expect(mockSlack.postDraftNotification).toHaveBeenCalled();
});
