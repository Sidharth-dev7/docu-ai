// docu-ai/tests/utils/config.test.js
const { getProductByName, getAllProducts } = require('../../config/index');

test('finds product by exact name', () => {
  const p = getProductByName('Product A');
  expect(p).not.toBeNull();
  expect(p.name).toBe('Product A');
});

test('finds product by keyword', () => {
  const p = getProductByName('PA');
  expect(p).not.toBeNull();
  expect(p.name).toBe('Product A');
});

test('returns null for unknown product', () => {
  const p = getProductByName('Unknown Product XYZ');
  expect(p).toBeNull();
});

test('getAllProducts returns all 3 products', () => {
  const all = getAllProducts();
  expect(all).toHaveLength(3);
});
