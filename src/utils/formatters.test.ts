import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPriceARS,
  getDimensionsForFormat,
  getDefaultFormatForCategory,
  filterAgendasByName,
  addOrUpdateCartItem,
  calculateCartTotals,
  validateUploadForm,
  deriveSolidHexFromRgb,
} from './formatters';
import { INITIAL_AGENDAS } from '../data/agendas';

test('formatPriceARS formats Argentine Pesos with es-AR dot separator', () => {
  assert.equal(formatPriceARS(18500), '$ 18.500');
  assert.equal(formatPriceARS(55500), '$ 55.500');
  assert.equal(formatPriceARS(1250000), '$ 1.250.000');
  assert.equal(formatPriceARS(0), '$ 0');
});

test('getDimensionsForFormat returns exact millimeter sizes for A5 and A6 with 25mm thickness', () => {
  const a5 = getDimensionsForFormat('A5');
  assert.equal(a5.widthMm, 148);
  assert.equal(a5.heightMm, 210);
  assert.equal(a5.thicknessMm, 25);

  const a6 = getDimensionsForFormat('A6');
  assert.equal(a6.widthMm, 105);
  assert.equal(a6.heightMm, 148);
  assert.equal(a6.thicknessMm, 25);

  assert.equal(getDefaultFormatForCategory('Semanales'), 'A5');
  assert.equal(getDefaultFormatForCategory('Diarias'), 'A5');
  assert.equal(getDefaultFormatForCategory('Mini'), 'A6');
});

test('INITIAL_AGENDAS has 8 items across Semanales, Diarias, and Mini', () => {
  assert.equal(INITIAL_AGENDAS.length, 8);
  const semanales = INITIAL_AGENDAS.filter((a) => a.category === 'Semanales');
  const diarias = INITIAL_AGENDAS.filter((a) => a.category === 'Diarias');
  const mini = INITIAL_AGENDAS.filter((a) => a.category === 'Mini');
  assert.ok(semanales.length >= 2);
  assert.ok(diarias.length >= 2);
  assert.ok(mini.length >= 2);
  assert.ok(INITIAL_AGENDAS.some((a) => a.hasElastic));
  assert.ok(INITIAL_AGENDAS.some((a) => !a.hasElastic));
});

test('filterAgendasByName filters accent-insensitively', () => {
  const results = filterAgendasByName(INITIAL_AGENDAS, 'botanica');
  assert.equal(results.length, 1);
  assert.ok(results[0].name.includes('Botánica'));

  const all = filterAgendasByName(INITIAL_AGENDAS, '   ');
  assert.equal(all.length, 8);
});

test('cart state updates and totals calculate accurately', () => {
  const item1 = INITIAL_AGENDAS[0]; // $ 18.500
  let cart = addOrUpdateCartItem([], item1, 3);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);

  const totals = calculateCartTotals(cart);
  assert.equal(totals.totalItems, 3);
  assert.equal(totals.totalPrice, item1.price * 3);
  assert.equal(totals.formattedTotal, '$ 55.500');

  cart = addOrUpdateCartItem(cart, item1, -2);
  assert.equal(cart[0].quantity, 1);

  cart = addOrUpdateCartItem(cart, item1, -1);
  assert.equal(cart.length, 0);
});

test('validateUploadForm enforces required fields and parses ARS prices', () => {
  const invalid = validateUploadForm({
    name: '',
    priceRaw: '',
    category: 'Semanales',
    shortDescription: '',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.price);
  assert.ok(invalid.errors.shortDescription);

  const valid = validateUploadForm({
    name: 'Agenda Patagonia 2027',
    priceRaw: '21.500',
    category: 'Diarias',
    shortDescription: 'Un día por página con papel bookcel.',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.parsedPrice, 21500);
});

test('deriveSolidHexFromRgb derives a valid hex string', () => {
  const hex = deriveSolidHexFromRgb(200, 100, 80, 0.8);
  assert.equal(hex, '#a05040');
});
