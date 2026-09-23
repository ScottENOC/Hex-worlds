#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('phase6combatDeclaration.js', 'utf8');
const context = {
  console,
  declaredCombats: [],
  highlightedTilesByType: {},
  units: [],
  window: { scenarioRules: { splitStackCombat: true } },
  setTimeout: () => {},
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'phase6combatDeclaration.js' });

const merge = context.window.mergeNextCombatDeclarations;
const parse = context.window.parseAdvanceSelection;
const ensureIds = context.window.ensureCombatUnitIds;
const available = context.window.availableCombatUnitsAt;
const addDeclaration = context.window.addCombatDeclaration;
assert.equal(typeof merge, 'function');
assert.equal(typeof parse, 'function');
assert.equal(typeof ensureIds, 'function');
assert.equal(typeof addDeclaration, 'function');

// Existing multi-hex behaviour remains intact, now carrying exact allocated IDs.
const queue = [
  { fromHex: { row: 4, col: 4 }, targetHex: { row: 5, col: 5 }, unitIds: ['u1'] },
  { fromHex: { row: 6, col: 5 }, targetHex: { row: 5, col: 5 }, unitIds: ['u3'] },
  { fromHex: { row: 7, col: 7 }, targetHex: { row: 7, col: 8 }, unitIds: ['u9'] },
  { fromHex: { row: 4, col: 4 }, targetHex: { row: 5, col: 5 }, unitIds: ['u2', 'u1'] },
];
const combat = merge(queue);
assert.deepStrictEqual(JSON.parse(JSON.stringify(combat.targetHex)), { row: 5, col: 5 });
assert.equal(combat.fromHexes.length, 2, 'duplicate origin should be deduplicated');
assert.deepStrictEqual(Array.from(combat.unitIds).sort(), ['u1', 'u2', 'u3']);
assert.equal(queue.length, 1, 'other target must remain queued');
assert.deepStrictEqual(JSON.parse(JSON.stringify(queue[0].targetHex)), { row: 7, col: 8 });

// A single stack can now split its counters across different adjacent targets.
context.units = [
  { faction: 'immer', row: 4, col: 4, combatStrength: 2 },
  { faction: 'immer', row: 4, col: 4, combatStrength: 1 },
  { faction: 'immer', row: 4, col: 4, combatStrength: 3 },
];
ensureIds(context.units);
assert.equal(new Set(context.units.map(u => u.combatId)).size, 3, 'combat IDs must be unique');
context.declaredCombats.length = 0;
addDeclaration({ row: 4, col: 4 }, { row: 5, col: 5 }, [context.units[0]]);
let remaining = available({ row: 4, col: 4 }, 'immer', context.declaredCombats);
assert.deepStrictEqual(Array.from(remaining, u => u.combatId).sort(), [context.units[1].combatId, context.units[2].combatId].sort());
addDeclaration({ row: 4, col: 4 }, { row: 5, col: 4 }, [context.units[1]]);
assert.equal(context.declaredCombats.length, 2, 'same origin may attack two different targets');
assert.notEqual(context.declaredCombats[0].unitIds[0], context.declaredCombats[1].unitIds[0]);
remaining = available({ row: 4, col: 4 }, 'immer', context.declaredCombats);
assert.deepStrictEqual(Array.from(remaining, u => u.combatId), [context.units[2].combatId]);

// Re-adding counters to the same origin/target folds into one declaration.
addDeclaration({ row: 4, col: 4 }, { row: 5, col: 5 }, [context.units[2]]);
assert.equal(context.declaredCombats.length, 2);
assert.equal(context.declaredCombats[0].unitIds.length, 2);

assert.deepStrictEqual(Array.from(parse('all', 3)), [0, 1, 2]);
assert.deepStrictEqual(Array.from(parse('none', 3)), []);
assert.deepStrictEqual(Array.from(parse('1, 3', 4)), [0, 2]);
assert.deepStrictEqual(Array.from(parse('2 2 9 junk', 3)), [1]);

console.log('Combat fidelity regression passed.');
