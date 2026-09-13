const { parseSantanderStatement } = require('./santanderShared');
const { parse: parseLegacy, isLegacyFormat } = require('./santanderLegacy');

function parse(text) {
  if (isLegacyFormat(text)) return parseLegacy(text);
  return parseSantanderStatement(text);
}

module.exports = { parse };
