// docu-ai/tests/services/claude.test.js
let mockCreate;
jest.mock('@anthropic-ai/sdk', () => {
  mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

const { interpretAnnouncement, generateDraft } = require('../../services/claude');

beforeEach(() => {
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

test('interpretAnnouncement returns enriched affectedPages with changeType and changeDescription', async () => {
  mockCreate.mockResolvedValue({
    content: [{
      text: JSON.stringify({
        product: 'Product A',
        version: '2.1.0',
        releaseType: 'feature',
        bugFixes: [],
        affectedPages: [
          { name: 'Dashboard', path: '/dashboard', changeType: 'new_feature', changeDescription: 'Added export button' },
        ],
      }),
    }],
  });

  const result = await interpretAnnouncement('Product A v2.1.0 released', fakeProducts);
  expect(result.affectedPages[0].changeType).toBe('new_feature');
  expect(result.affectedPages[0].changeDescription).toBe('Added export button');
});

test('interpretAnnouncement normalizes plain-string affectedPages to objects', async () => {
  mockCreate.mockResolvedValue({
    content: [{
      text: JSON.stringify({
        product: 'Product A',
        version: '1.0.0',
        releaseType: 'feature',
        bugFixes: [],
        affectedPages: ['Settings'],
      }),
    }],
  });

  const result = await interpretAnnouncement('Product A v1.0.0', fakeProducts);
  expect(result.affectedPages[0].name).toBe('Settings');
  expect(result.affectedPages[0].changeType).toBe('design_change');
  expect(result.affectedPages[0].changeDescription).toBe('');
});

test('interpretAnnouncement normalizes affectedPages objects missing changeType', async () => {
  mockCreate.mockResolvedValue({
    content: [{
      text: JSON.stringify({
        product: 'Product A',
        version: '1.0.0',
        releaseType: 'feature',
        bugFixes: [],
        affectedPages: [{ name: 'Billing', path: '/billing' }],
      }),
    }],
  });

  const result = await interpretAnnouncement('Product A v1.0.0', fakeProducts);
  expect(result.affectedPages[0].changeType).toBe('design_change');
  expect(result.affectedPages[0].changeDescription).toBe('');
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

  expect(result.title).toBe('Product A v2.1.0 — Draft (Docu AI)');
  expect(typeof result.content).toBe('string');
  expect(result.content.length).toBeGreaterThan(0);
});
