// Regenerates data/defaultWords.js (file:// fallback) from data/defaultWords.json.
// Run after editing the JSON:  node tools/build-words.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const json = JSON.parse(fs.readFileSync(path.join(dir, 'defaultWords.json'), 'utf8'));
fs.writeFileSync(
  path.join(dir, 'defaultWords.js'),
  '// AUTO-GENERATED from defaultWords.json by tools/build-words.js. Do not edit.\n' +
  'window.__DEFAULT_WORDS_DATA__ = ' + JSON.stringify(json, null, 2) + ';\n'
);
console.log('Wrote data/defaultWords.js');
