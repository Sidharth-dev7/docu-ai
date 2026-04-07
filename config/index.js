// docu-ai/config/index.js
const products = require('./products.json').products;

function getProductByName(name) {
  const lower = name.toLowerCase();
  return products.find(p =>
    p.name.toLowerCase() === lower ||
    p.keywords.some(k => k.toLowerCase() === lower)
  ) || null;
}

function getAllProducts() {
  return products;
}

module.exports = { getProductByName, getAllProducts };
