// Simple profanity filter utility
const PROFANE_WORDS = [
  'damn', 'hell', 'ass', 'shit', 'fuck', 'bitch', 'bastard', 'crap',
  'dick', 'piss', 'cock', 'pussy', 'asshole', 'bullshit', 'motherfucker',
  'wtf', 'stfu', 'fck', 'f*ck', 'sh*t', 'b*tch'
];

function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return PROFANE_WORDS.some(word => {
    const regex = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    return regex.test(lower);
  });
}

function filterProfanity(text) {
  if (!text || typeof text !== 'string') return text;
  let filtered = text;
  PROFANE_WORDS.forEach(word => {
    const regex = new RegExp('\\b(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi');
    filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
  });
  return filtered;
}

module.exports = { containsProfanity, filterProfanity, PROFANE_WORDS };
