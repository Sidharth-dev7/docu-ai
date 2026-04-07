const { highlightDiff } = require('../../utils/diff');

test('wraps added text in green span', () => {
  const oldText = 'The button is blue.';
  const newText = 'The button is blue. Click it to submit.';
  const result = highlightDiff(oldText, newText);
  expect(result).toContain('#d4edda');
  expect(result).toContain('Click it to submit');
});

test('wraps removed text in red span', () => {
  const oldText = 'The button is blue. Click it to submit.';
  const newText = 'The button is blue.';
  const result = highlightDiff(oldText, newText);
  expect(result).toContain('#f8d7da');
  expect(result).toContain('Click it to submit');
});

test('unchanged text has no highlight spans', () => {
  const text = 'Nothing changed here.';
  const result = highlightDiff(text, text);
  expect(result).not.toContain('background-color');
  expect(result).toContain('Nothing changed here.');
});

test('returns a string', () => {
  const result = highlightDiff('old content', 'new content');
  expect(typeof result).toBe('string');
});
