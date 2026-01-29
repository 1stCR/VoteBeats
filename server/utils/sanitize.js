// Input sanitization utility to prevent XSS
// Only escape HTML-dangerous characters (< and >), not quotes/apostrophes
// React automatically escapes output, so we only need to prevent HTML injection
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeObject(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = sanitizeString(result[field]);
    }
  }
  return result;
}

module.exports = { sanitizeString, sanitizeObject };
