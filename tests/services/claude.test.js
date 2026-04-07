// docu-ai/tests/services/claude.test.js
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

const Anthropic = require('@anthropic-ai/sdk');
const { interpretAnnouncement, generateDraft } = require('../../services/claude');

let mockCreate;

beforeEach(() => {
  mockCreate = Anthropic.mock.results[0].value.messages.create;
  mockCreate.mockReset();
});

const fakeProducts = [
  { name: 'Product A', keywords: ['PA', 'product-a'] },
  { name: 'Product B', keywords: ['PB', 'product-b'] },
];

test('interpretAnnouncement returns product, affectedPages and version', async () => {
  mockCreate.mockResolvedValue({
    content: [{
      text: JSON.stringify({
        product: 'Product A',
        version: '2.1.0',
        affectedPages: [
          { name: 'Settings', path: '/settings' },
          { name: 'Billing', path: '/billing' },
        ],
      }),
    }],
  });

  const result = await interpretAnnouncement(
    'Product A v2.1.0 released — updated Settings and Billing pages',
    fakeProducts
  );

  expect(result.product).toBe('Product A');
  expect(result.version).toBe('2.1.0');
  expect(result.affectedPages).toHaveLength(2);
  expect(result.affectedPages[0].path).toBe('/settings');
});

test('interpretAnnouncement returns null when product cannot be identified', async () => {
  mockCreate.mockResolvedValue({
    content: [{ text: JSON.stringify({ product: null, version: null, affectedPages: [] }) }],
  });

  const result = await interpretAnnouncement('Random message with no product info', fakeProducts);
  expect(result).toBeNull();
});

test('generateDraft returns title and content string', async () => {
  mockCreate.mockResolvedValue({
    content: [{
      text: JSON.stringify({
        title: 'Product A v2.1.0 — Draft (Docu AI)',
        content: '<p>Updated content here.</p>',
      }),
    }],
  });

  const result = await generateDraft({
    releaseText: 'Product A v2.1.0 — updated Settings page',
    existingContent: '<p>Old content.</p>',
    styleSamples: ['<p>Sample article 1.</p>'],
    screenshotBase64s: [],
    affectedPages: [{ name: 'Settings', path: '/settings' }],
    productName: 'Product A',
    version: '2.1.0',
  });

  expect(result.title).toContain('Product A');
  expect(typeof result.content).toBe('string');
  expect(result.content.length).toBeGreaterThan(0);
});
