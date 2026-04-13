// docu-ai/tests/utils/config.test.js
const { getProductByName, getAllProducts } = require('../../config/index');

test('finds product by exact name', () => {
  const p = getProductByName('WebYes Accessibility');
  expect(p).not.toBeNull();
  expect(p.name).toBe('WebYes Accessibility');
});

test('finds product by keyword', () => {
  const p = getProductByName('WA');
  expect(p).not.toBeNull();
  expect(p.name).toBe('WebYes Accessibility');
});

test('returns null for unknown product', () => {
  const p = getProductByName('Unknown Product XYZ');
  expect(p).toBeNull();
});

test('getAllProducts returns all 2 products', () => {
  const all = getAllProducts();
  expect(all).toHaveLength(2);
});
