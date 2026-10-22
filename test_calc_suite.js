const fs = require('fs');
const assert = require('assert');

console.log('=== TEST SUITE: SAWMILL CALCULATOR & LEADS ===\n');

// 1. Check syntax of all script tags in raspil.html
const raspilHtml = fs.readFileSync('raspil.html', 'utf8');
const scriptRegex = /<script(?![^>]*type\s*=\s*['"]application\/ld\+json['"])[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIdx = 0;
while ((match = scriptRegex.exec(raspilHtml)) !== null) {
  scriptIdx++;
  const scriptContent = match[1];
  try {
    new Function(scriptContent);
  } catch (err) {
    console.error(`❌ Syntax error in script #${scriptIdx}:`, err.message);
    process.exit(1);
  }
}
console.log(`✅ All ${scriptIdx} script tags in raspil.html compiled successfully without syntax errors.`);

// 2. Extract calculateSawOrder & formatSawCalcLead directly from raspil.html
// to ensure we test the ACTUAL code inside raspil.html
const calcScriptMatch = raspilHtml.match(/\/\/ --- ЦЕНТРАЛИЗОВАННЫЙ КАЛЬКУЛЯТОР ЗАКАЗА[\s\S]*?function formatAreaBadge\(m2\) \{[\s\S]*?\}/);
if (!calcScriptMatch) {
  console.error('❌ Could not locate calculator block in raspil.html');
  process.exit(1);
}

// Create sandbox to execute the functions
const vm = require('vm');
const sandbox = {
  window: {}
};
vm.createContext(sandbox);

try {
  vm.runInContext(`(function() {
    ` + calcScriptMatch[0] + `
    window.calculateSawOrder = calculateSawOrder;
    window.formatSawCalcLead = formatSawCalcLead;
  })()`, sandbox);
} catch (e) {
  console.error('❌ Error executing calculator script:', e);
  process.exit(1);
}

const { calculateSawOrder, formatSawCalcLead } = sandbox.window;
assert(typeof calculateSawOrder === 'function', 'calculateSawOrder should be a function');
assert(typeof formatSawCalcLead === 'function', 'formatSawCalcLead should be a function');

console.log('✅ calculateSawOrder and formatSawCalcLead successfully loaded from raspil.html\n');

// ==========================================
// TEST 1: Одна деталь без кромки
// ==========================================
console.log('--- TEST 1: Одна деталь без кромки ---');
const test1Items = [
  {
    length: 444,
    width: 444,
    count: 1,
    matPriceM2: 850,
    matName: 'Венге Линум 16 мм',
    el1: 'none',
    el2: 'none',
    ew1: 'none',
    ew2: 'none',
    hasTexture: true
  }
];

const state1 = calculateSawOrder(test1Items);
console.log('Test 1 rawTotalArea:', state1.rawTotalArea);
console.log('Test 1 formattedArea:', state1.formattedArea);
console.log('Test 1 baseOrderTotal:', state1.baseOrderTotal);
console.log('Test 1 finalTotal:', state1.finalTotal);
console.log('Test 1 isMinOrderApplied:', state1.isMinOrderApplied);
console.log('Test 1 edgeSummaryText:', state1.edgeSummaryText);
console.log('Test 1 item cost:', state1.items[0].cost);

assert.strictEqual(Math.round(state1.rawTotalArea * 1000000) / 1000000, 0.197136, 'Area must be 0.197136 m²');
assert.strictEqual(state1.baseOrderTotal, 168, 'Base order total must be 168 ₽');
assert.strictEqual(state1.finalTotal, 500, 'Final total must be 500 ₽ (min order)');
assert.strictEqual(state1.isMinOrderApplied, true, 'Min order must be applied');
assert.strictEqual(state1.hasEdges, false, 'hasEdges must be false');
assert.strictEqual(state1.totalEdgeMeters['0.4'], 0, '0.4mm edge meters must be 0');
assert.strictEqual(state1.totalEdgeMeters['1.0'], 0, '1.0mm edge meters must be 0');
assert.strictEqual(state1.totalEdgeMeters['2.0'], 0, '2.0mm edge meters must be 0');
assert.strictEqual(state1.edgeSummaryText, 'Без кромки', 'Edge summary text must be "Без кромки"');

const lead1 = formatSawCalcLead(state1);
console.log('\nGenerated Lead for Test 1:\n' + lead1 + '\n');
assert(lead1.includes('Без кромки'), 'Lead must say "Без кромки"');
assert(!lead1.includes('0.4 мм: 1 м'), 'Lead must NOT contain phantom "0.4 мм: 1 м"');
assert(!lead1.includes('0.4 мм — 1 м'), 'Lead must NOT contain phantom "0.4 мм — 1 м"');
assert(lead1.includes('ИТОГО: 500 ₽'), 'Lead must state final total 500 ₽');
assert(lead1.includes('расчёт: 168 ₽'), 'Lead must state calculation 168 ₽');
console.log('✅ TEST 1 PASSED!\n');

// ==========================================
// TEST 2: Большой заказ
// ==========================================
console.log('--- TEST 2: Большой заказ (4 позиции) ---');
const test2Items = [
  // Позиция 1: 562×562 мм, 5 шт. Дуб Атланта 16 мм (850 ₽). Кромка 0.4 мм 4 стороны.
  {
    length: 562,
    width: 562,
    count: 5,
    matPriceM2: 850,
    matName: 'Дуб Атланта 16 мм',
    el1: '0.4',
    el2: '0.4',
    ew1: '0.4',
    ew2: '0.4',
    hasTexture: false
  },
  // Позиция 2: 564×564 мм, 2 шт. Дуб Атланта 16 мм (850 ₽). Кромка 0.4 мм 4 стороны.
  {
    length: 564,
    width: 564,
    count: 2,
    matPriceM2: 850,
    matName: 'Дуб Атланта 16 мм',
    el1: '0.4',
    el2: '0.4',
    ew1: '0.4',
    ew2: '0.4',
    hasTexture: false
  },
  // Позиция 3: 565×565 мм, 4 шт. Дуб Атланта 16 мм (850 ₽). Кромка 2 мм 4 стороны.
  {
    length: 565,
    width: 565,
    count: 4,
    matPriceM2: 850,
    matName: 'Дуб Атланта 16 мм',
    el1: '2.0',
    el2: '2.0',
    ew1: '2.0',
    ew2: '2.0',
    hasTexture: false
  },
  // Позиция 4: 500×250 мм, 2 шт. Ясень Анкор светлый 16 мм (850 ₽). L1 и L2: 2 мм. W1 и W2: none.
  {
    length: 500,
    width: 250,
    count: 2,
    matPriceM2: 850,
    matName: 'Ясень Анкор светлый 16 мм',
    el1: '2.0',
    el2: '2.0',
    ew1: 'none',
    ew2: 'none',
    hasTexture: false
  }
];

const state2 = calculateSawOrder(test2Items);
console.log('Test 2 rawTotalArea:', state2.rawTotalArea);
console.log('Test 2 formattedArea:', state2.formattedArea);
console.log('Test 2 totalMatCost:', state2.totalMatCost.toFixed(2));
console.log('Test 2 billedEdgeMeters:', state2.billedEdgeMeters);
console.log('Test 2 orderEdgeCosts:', state2.orderEdgeCosts);
console.log('Test 2 totalEdgeCost:', state2.totalEdgeCost);
console.log('Test 2 finalTotal:', state2.finalTotal);

const itemCosts = state2.items.map(i => i.cost);
console.log('Test 2 item costs:', itemCosts);

assert.strictEqual(Math.round(state2.rawTotalArea * 1000000) / 1000000, 3.742312, 'Area must be 3.742312 m²');
assert.strictEqual(Math.round(state2.totalMatCost * 100) / 100, 3180.97, 'Material cost must be 3180.97 ₽');
assert.strictEqual(state2.billedEdgeMeters['0.4'], 16, 'Edge 0.4 mm must be 16 m');
assert.strictEqual(state2.orderEdgeCosts['0.4'], 720, 'Edge 0.4 mm cost must be 720 ₽');
assert.strictEqual(state2.billedEdgeMeters['2.0'], 12, 'Edge 2.0 mm must be 12 m');
assert.strictEqual(state2.orderEdgeCosts['2.0'], 1020, 'Edge 2.0 mm cost must be 1020 ₽');
assert.strictEqual(state2.finalTotal, 4921, 'Final total must be EXACTLY 4921 ₽');

assert.deepStrictEqual(itemCosts, [1856, 747, 1921, 397], 'Item costs distribution must be exactly [1856, 747, 1921, 397]');
assert.strictEqual(itemCosts.reduce((a, b) => a + b, 0), 4921, 'Sum of item costs must match total');

const lead2 = formatSawCalcLead(state2);
console.log('\nGenerated Lead for Test 2:\n' + lead2 + '\n');
const cleanLead2 = lead2.replace(/\u00a0/g, ' ');
assert(cleanLead2.includes('ИТОГО: 4 921 ₽'), 'Lead must contain ИТОГО: 4 921 ₽');
assert(cleanLead2.includes('0.4 мм: 16 м'), 'Lead must contain 0.4 мм: 16 м');
assert(cleanLead2.includes('2.0 мм: 12 м'), 'Lead must contain 2.0 мм: 12 м');
console.log('✅ TEST 2 PASSED!\n');

// ==========================================
// TEST 3: Удаление кромки (редактирование)
// ==========================================
console.log('--- TEST 3: Удаление кромки ---');
let itemWithEdge = {
  length: 500,
  width: 500,
  count: 1,
  matPriceM2: 850,
  matName: 'Дуб Атланта 16 мм',
  el1: '0.4',
  el2: '0.4',
  ew1: 'none',
  ew2: 'none',
  hasTexture: false
};

const state3Before = calculateSawOrder([itemWithEdge]);
assert.strictEqual(state3Before.hasEdges, true, 'Should have edges before');
assert.strictEqual(state3Before.billedEdgeMeters['0.4'], 1, 'Should have 1m of 0.4mm edge');

// Edit item to remove edge
itemWithEdge.el1 = 'none';
itemWithEdge.el2 = 'none';
const state3After = calculateSawOrder([itemWithEdge]);
console.log('Test 3 after removing edge: hasEdges =', state3After.hasEdges, 'summary =', state3After.edgeSummaryText);
assert.strictEqual(state3After.hasEdges, false, 'hasEdges must be false after removing edge');
assert.strictEqual(state3After.billedEdgeMeters['0.4'], 0, '0.4mm edge must be 0');
assert.strictEqual(state3After.edgeSummaryText, 'Без кромки', 'Edge summary must be "Без кромки"');

const lead3 = formatSawCalcLead(state3After);
console.log('Test 3 lead text line:\n' + lead3.split('\n').pop());
assert(lead3.includes('Без кромки'), 'Lead must state "Без кромки"');
assert(!lead3.includes('0.4 мм'), 'Lead must NOT contain "0.4 мм"');
console.log('✅ TEST 3 PASSED!\n');

console.log('🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
