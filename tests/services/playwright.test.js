// docu-ai/tests/services/playwright.test.js
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

const { chromium } = require('playwright');
const { captureScreenshots } = require('../../services/playwright');

const fakeProductConfig = {
  url: 'https://producta.example.com',
  loginPath: '/login',
  credentials: {
    usernameSelector: '#email',
    passwordSelector: '#password',
    submitSelector: 'button[type=submit]',
    username: 'ai@company.com',
    password: 'secret',
  },
};

const fakePages = [
  { name: 'Settings', path: '/settings' },
  { name: 'Billing', path: '/billing' },
];

let mockPage, mockBrowser, mockContext;

beforeEach(() => {
  mockPage = {
    goto: jest.fn().mockResolvedValue(null),
    fill: jest.fn().mockResolvedValue(null),
    click: jest.fn().mockResolvedValue(null),
    waitForLoadState: jest.fn().mockResolvedValue(null),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
  };
  mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
  };
  mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    close: jest.fn().mockResolvedValue(null),
  };
  chromium.launch.mockResolvedValue(mockBrowser);
});

test('returns one screenshot per affected page', async () => {
  const results = await captureScreenshots(fakeProductConfig, fakePages);
  expect(results).toHaveLength(2);
  expect(results[0].pageName).toBe('Settings');
  expect(results[1].pageName).toBe('Billing');
});

test('each screenshot result contains a base64 string', async () => {
  const results = await captureScreenshots(fakeProductConfig, fakePages);
  results.forEach(r => {
    expect(typeof r.base64).toBe('string');
    expect(r.base64.length).toBeGreaterThan(0);
  });
});

test('closes the browser after capturing', async () => {
  await captureScreenshots(fakeProductConfig, fakePages);
  expect(mockBrowser.close).toHaveBeenCalled();
});

test('returns empty array when affectedPages is empty', async () => {
  const results = await captureScreenshots(fakeProductConfig, []);
  expect(results).toHaveLength(0);
});
