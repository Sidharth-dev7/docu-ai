const Diff = require('diff');

const GREEN = '#d4edda';
const RED = '#f8d7da';

/**
 * Compares oldContent and newContent at the word level.
 * Returns an HTML string with added text in green and removed text in red.
 * @param {string} oldContent
 * @param {string} newContent
 * @returns {string}
 */
function highlightDiff(oldContent, newContent) {
  const parts = Diff.diffWords(oldContent, newContent);
  return parts.map(part => {
    if (part.added) {
      return `<span style="background-color: ${GREEN};">${part.value}</span>`;
    }
    if (part.removed) {
      return `<span style="background-color: ${RED};">${part.value}</span>`;
    }
    return part.value;
  }).join('');
}

module.exports = { highlightDiff };
