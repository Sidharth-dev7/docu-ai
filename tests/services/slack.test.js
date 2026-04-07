// docu-ai/tests/services/slack.test.js
const { createSlackService } = require('../../services/slack');

const mockClient = { chat: { postMessage: jest.fn().mockResolvedValue({}) } };
const slack = createSlackService(mockClient);

beforeEach(() => mockClient.chat.postMessage.mockClear());

test('postDraftNotification sends to the notifications channel', async () => {
  await slack.postDraftNotification({
    channel: 'docs-notifications',
    productName: 'Product A',
    version: '2.1.0',
    confluenceUrl: 'https://confluence.example.com/pages/999',
  });

  expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ channel: 'docs-notifications' })
  );
});

test('postDraftNotification message contains product name and version', async () => {
  await slack.postDraftNotification({
    channel: 'docs-notifications',
    productName: 'Product A',
    version: '2.1.0',
    confluenceUrl: 'https://confluence.example.com/pages/999',
  });

  const call = mockClient.chat.postMessage.mock.calls[0][0];
  expect(call.text).toContain('Product A');
  expect(call.text).toContain('2.1.0');
});

test('postAlert sends message to specified channel', async () => {
  await slack.postAlert({ channel: 'docs-notifications', message: 'Something went wrong.' });
  const call = mockClient.chat.postMessage.mock.calls[0][0];
  expect(call.channel).toBe('docs-notifications');
  expect(call.text).toContain('Something went wrong.');
});
