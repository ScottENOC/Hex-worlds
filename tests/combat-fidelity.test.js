#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('phase6combatDeclaration.js', 'utf8');
const context = { console, declaredCombats: [], highlightedTilesByType: {}, window: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'phase6combatDeclaration.js' });

const merge = context.window.mergeNextCombatDeclarations;
const parse = context.window.parseAdvanceSelection;
assert.equal(typeof merge, 'function');
assert.equal(typeof parse, 'function');

const queue = [
  { fromHex: { row: 4, col: 4 }, targetHex: { row: 5, col: 5 } },
  { fromHex: { row: 6, col: 5 }, targetHex: { row: 5, col: 5 } },
  { fromHex: { row: 7, col: 7 }, targetHex: { row: 7, col: 8 } },
  { fromHex: { row: 4, col: 4 }, targetHex: { row: 5, col: 5 } },
];
const combat = merge(queue);
assert.deepStrictEqual(JSON.parse(JSON.stringify(combat.targetHex)), { row: 5, col: 5 });
assert.equal(combat.fromHexes.length, 2, 'duplicate origin should be deduplicated');
assert.equal(queue.length, 1, 'other target must remain queued');
assert.deepStrictEqual(JSON.parse(JSON.stringify(queue[0].targetHex)), { row: 7, col: 8 });

assert.deepStrictEqual(Array.from(parse('all', 3)), [0, 1, 2]);
assert.deepStrictEqual(Array.from(parse('none', 3)), []);
assert.deepStrictEqual(Array.from(parse('1, 3', 4)), [0, 2]);
assert.deepStrictEqual(Array.from(parse('2 2 9 junk', 3)), [1]);

console.log('Combat fidelity regression passed.');
