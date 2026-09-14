const visaSantander = require('./visaSantander');
const amexSantander = require('./amexSantander');
const mastercardGalicia = require('./mastercardGalicia');
const visaGalicia = require('./visaGalicia');
const cordobesa = require('./cordobesa');

const PARSERS = {
  VISA_SANTANDER: visaSantander,
  AMEX_SANTANDER: amexSantander,
  MASTERCARD_GALICIA: mastercardGalicia,
  VISA_GALICIA: visaGalicia,
  CORDOBESA: cordobesa,
};

function getParser(bankProfile) {
  const parser = PARSERS[bankProfile];
  if (!parser) throw new Error(`No hay parser registrado para bank_profile "${bankProfile}"`);
  return parser;
}

module.exports = { getParser, PARSERS };
