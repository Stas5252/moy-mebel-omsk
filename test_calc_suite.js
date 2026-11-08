const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('=== TEST SUITE: SAWMILL CALCULATOR & LEADS (UPDATED TARIFFS & ROUNDING) ===\n');

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

// Check lead-form.js syntax
const leadFormJs = fs.readFileSync('js/lead-form.js', 'utf8');
try {
  new Function(leadFormJs);
  console.log('✅ js/lead-form.js compiled successfully without syntax errors.');
} catch (err) {
  console.error('❌ Syntax error in js/lead-form.js:', err.message);
  process.exit(1);
}

// 2. Extract calculator engine directly from raspil.html
const calcScriptMatch = raspilHtml.match(/\/\/ --- ЦЕНТРАЛИЗОВАННЫЙ КАЛЬКУЛЯТОР ЗАКАЗА[\s\S]*?function formatAreaBadge\(m2\) \{[\s\S]*?\}/);
if (!calcScriptMatch) {
  console.error('❌ Could not locate calculator block in raspil.html');
  process.exit(1);
}

const sandbox = { window: {} };
vm.createContext(sandbox);

try {
  vm.runInContext(`(function() {
    ${calcScriptMatch[0]}
    window.calculateSawOrder = calculateSawOrder;
    window.formatSawCalcLead = formatSawCalcLead;
    window.roundAreaUp = roundAreaUp;
    window.formatItemArea = formatItemArea;
    window.formatTotalArea = formatTotalArea;
  })()`, sandbox);
} catch (e) {
  console.error('❌ Error executing calculator script:', e);
  process.exit(1);
}

const { calculateSawOrder, formatSawCalcLead, roundAreaUp, formatItemArea, formatTotalArea } = sandbox.window;
assert(typeof calculateSawOrder === 'function', 'calculateSawOrder should be a function');
assert(typeof formatSawCalcLead === 'function', 'formatSawCalcLead should be a function');
console.log('✅ calculateSawOrder and formatSawCalcLead successfully loaded from raspil.html\n');

// ==========================================
// TEST 0: Реал-кейс из скриншота от пользователя
// 510 × 480 мм + 481 × 84 мм (Серый шагрень 16мм, 980 ₽, кромка 0.4 мм по кругу)
// ==========================================
console.log('--- TEST 0: Реал-кейс пользователя (В итоговой должно быть 0,3 м²) ---');
const userOrderItems = [
  {
    length: 510,
    width: 480,
    count: 1,
    matPriceM2: 980,
    matName: 'Серый шагрень 16мм',
    el1: '0.4',
    el2: '0.4',
    ew1: '0.4',
    ew2: '0.4',
    hasTexture: true
  },
  {
    length: 481,
    width: 84,
    count: 1,
    matPriceM2: 980,
    matName: 'Серый шагрень 16мм',
    el1: '0.4',
    el2: '0.4',
    ew1: '0.4',
    ew2: '0.4',
    hasTexture: true
  }
];

const stateUser = calculateSawOrder(userOrderItems);
console.log('User Order:');
console.log('Item 1 area:', stateUser.items[0].formattedArea);
console.log('Item 2 area:', stateUser.items[1].formattedArea);
console.log('Total Raw Area:', stateUser.rawTotalArea);
console.log('Total Formatted Area (итоговая квадратура):', stateUser.formattedArea);
console.log('Billed Edge 0.4 mm:', stateUser.billedEdgeMeters['0.4'] + ' м');
console.log('Order Edge Costs 0.4 mm:', stateUser.orderEdgeCosts['0.4'] + ' ₽');
console.log('Base Order Total:', stateUser.baseOrderTotal + ' ₽');
console.log('Final Total (min 500 ₽):', stateUser.finalTotal + ' ₽');
console.log('Item 1 cost:', stateUser.items[0].cost + ' ₽');
console.log('Item 2 cost:', stateUser.items[1].cost + ' ₽');

// Проверки:
// Деталь 1: 510x480 = 0.2448 -> "0,24 м²"
assert.strictEqual(stateUser.items[0].formattedArea, '0,24 м²', 'Item 1 area must be formatted to 0,24 м²');
// Деталь 2: 481x84 = 0.040404 -> "0,04 м²"
assert.strictEqual(stateUser.items[1].formattedArea, '0,04 м²', 'Item 2 area must be formatted to 0,04 м²');
// ИТОГОВАЯ КВАДРАТУРА ДОЛЖНА БЫТЬ 0,3 м² (требование пользователя!)
assert.strictEqual(stateUser.formattedArea, '0,3 м²', 'Итоговая квадратура должна округляться вверх до 0,3 м²!');
assert.strictEqual(stateUser.billedEdgeMeters['0.4'], 4, 'Кромка 0.4 мм: 4 м');
assert.strictEqual(stateUser.orderEdgeCosts['0.4'], 4 * 47, 'Стоимость кромки 4 * 47 = 188 ₽');

const userLead = formatSawCalcLead(stateUser);
console.log('\nGenerated Lead for User Order:\n' + userLead + '\n');
assert(userLead.includes('Квадратура: 0,3 м²'), 'Lead must say "Квадратура: 0,3 м²"');
assert(userLead.includes('0,24 м²'), 'Lead item 1 must say 0,24 м²');
assert(userLead.includes('0,04 м²'), 'Lead item 2 must say 0,04 м²');
assert(userLead.includes('0.4 мм: 4 м'), 'Lead must say 0.4 мм: 4 м');
console.log('✅ TEST 0 PASSED!\n');

// ==========================================
// TEST 1: Одна деталь без кромки (444 × 444 мм, Венге Линум 900 ₽/м²)
// ==========================================
console.log('--- TEST 1: Одна деталь без кромки (444 × 444 мм) ---');
const test1Items = [
  {
    length: 444,
    width: 444,
    count: 1,
    matPriceM2: 900,
    matName: 'Венге Линум 16мм',
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
assert.strictEqual(state1.formattedArea, '0,2 м²', 'Total area rounded up to 0,2 м²');
// 0.197136 * 900 = 177.4224 -> round 177 ₽
assert.strictEqual(state1.baseOrderTotal, 177, 'Base order total must be 177 ₽');
assert.strictEqual(state1.finalTotal, 500, 'Final total must be 500 ₽ (min order)');
assert.strictEqual(state1.isMinOrderApplied, true, 'Min order must be applied');
assert.strictEqual(state1.hasEdges, false, 'hasEdges must be false');
assert.strictEqual(state1.edgeSummaryText, 'Без кромки', 'Edge summary text must be "Без кромки"');

const lead1 = formatSawCalcLead(state1);
console.log('\nGenerated Lead for Test 1:\n' + lead1 + '\n');
assert(lead1.includes('Без кромки'), 'Lead must say "Без кромки"');
assert(!lead1.includes('0.4 мм: 1 м'), 'Lead must NOT contain phantom "0.4 мм: 1 м"');
assert(lead1.includes('ИТОГО: 500 ₽'), 'Lead must state final total 500 ₽');
assert(lead1.includes('Квадратура: 0,2 м²'), 'Lead must state total area 0,2 м²');
console.log('✅ TEST 1 PASSED!\n');

// ==========================================
// TEST 2: Большой заказ с новыми тарифами
// ==========================================
console.log('--- TEST 2: Большой заказ с новыми тарифами ---');
const test2Items = [
  // Позиция 1: 562×562 мм, 5 шт. Дуб Атланта 16 мм (900 ₽). Кромка 0.4 мм 4 стороны.
  {
    length: 562,
    width: 562,
    count: 5,
    matPriceM2: 900,
    matName: 'Дуб Атланта 16мм',
    el1: '0.4',
    el2: '0.4',
    ew1: '0.4',
    ew2: '0.4',
    hasTexture: false
  },
  // Позиция 2: 564×564 мм, 2 шт. Дуб Атланта 16 мм (900 ₽). Кромка 0.4 мм 4 стороны.
  {
    length: 564,
    width: 564,
    count: 2,
    matPriceM2: 900,
    matName: 'Дуб Атланта 16мм',
    el1: '0.4',
    el2: '0.4',
    ew1: '0.4',
    ew2: '0.4',
    hasTexture: false
  },
  // Позиция 3: 565×565 мм, 4 шт. Дуб Атланта 16 мм (900 ₽). Кромка 2 мм 4 стороны.
  {
    length: 565,
    width: 565,
    count: 4,
    matPriceM2: 900,
    matName: 'Дуб Атланта 16мм',
    el1: '2.0',
    el2: '2.0',
    ew1: '2.0',
    ew2: '2.0',
    hasTexture: false
  },
  // Позиция 4: 500×250 мм, 2 шт. Ясень Анкор светлый 16 мм (900 ₽). L1 и L2: 2 мм. W1 и W2: none.
  {
    length: 500,
    width: 250,
    count: 2,
    matPriceM2: 900,
    matName: 'Ясень Анкор светлый 16мм',
    el1: '2.0',
    el2: '2.0',
    ew1: 'none',
    ew2: 'none',
    hasTexture: false
  }
];

const state2 = calculateSawOrder(test2Items);
console.log('Test 2 rawTotalArea:', state2.rawTotalArea);
console.log('Test 2 formattedArea (итоговая квадратура):', state2.formattedArea);
console.log('Test 2 totalMatCost:', state2.totalMatCost.toFixed(2));
console.log('Test 2 billedEdgeMeters:', state2.billedEdgeMeters);
console.log('Test 2 orderEdgeCosts:', state2.orderEdgeCosts);
console.log('Test 2 totalEdgeCost:', state2.totalEdgeCost);
console.log('Test 2 finalTotal:', state2.finalTotal);

const itemCosts = state2.items.map(i => i.cost);
console.log('Test 2 item costs:', itemCosts);

assert.strictEqual(Math.round(state2.rawTotalArea * 1000000) / 1000000, 3.742312, 'Area must be 3.742312 m²');
assert.strictEqual(state2.formattedArea, '3,8 м²', 'Total area rounded up to 3,8 м²');
// Mat cost: 3.742312 * 900 = 3368.08 ₽
assert.strictEqual(Math.round(state2.totalMatCost * 100) / 100, 3368.08, 'Material cost must be 3368.08 ₽');
// Edges: 0.4 mm -> 16 m * 47 = 752 ₽; 2.0 mm -> 12 m * 87 = 1044 ₽. Total edges = 1796 ₽.
assert.strictEqual(state2.billedEdgeMeters['0.4'], 16, 'Edge 0.4 mm must be 16 m');
assert.strictEqual(state2.orderEdgeCosts['0.4'], 16 * 47, 'Edge 0.4 mm cost must be 16*47 = 752 ₽');
assert.strictEqual(state2.billedEdgeMeters['2.0'], 12, 'Edge 2.0 mm must be 12 m');
assert.strictEqual(state2.orderEdgeCosts['2.0'], 12 * 87, 'Edge 2.0 mm cost must be 12*87 = 1044 ₽');
// Total: 3368.08 + 1796 = 5164.08 -> 5164 ₽
assert.strictEqual(state2.finalTotal, 5164, 'Final total must be 5164 ₽');
assert.strictEqual(itemCosts.reduce((a, b) => a + b, 0), 5164, 'Sum of item costs must match total');

const lead2 = formatSawCalcLead(state2).replace(/\u00a0/g, ' ');
console.log('\nGenerated Lead for Test 2:\n' + lead2 + '\n');
assert(lead2.includes('ИТОГО: 5 164 ₽'), 'Lead must contain ИТОГО: 5 164 ₽');
assert(lead2.includes('0.4 мм: 16 м'), 'Lead must contain 0.4 мм: 16 м');
assert(lead2.includes('2.0 мм: 12 м'), 'Lead must contain 2.0 мм: 12 м');
assert(lead2.includes('Квадратура: 3,8 м²'), 'Lead must contain Квадратура: 3,8 м²');
console.log('✅ TEST 2 PASSED!\n');

// ==========================================
// TEST 3: Удаление кромки (редактирование)
// ==========================================
console.log('--- TEST 3: Удаление кромки ---');
let itemWithEdge = {
  length: 500,
  width: 500,
  count: 1,
  matPriceM2: 900,
  matName: 'Дуб Атланта 16мм',
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
