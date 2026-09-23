const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('scenarioLoader.js', 'utf8');

function makeContext({ rules, tileData, units, adjacency = {} }) {
  const context = {
    console,
    tileData,
    units,
    window: {
      scenarioRules: rules,
      addEventListener: () => {},
    },
    getAdjacentCoords(row, col) {
      return adjacency[`${row},${col}`] || [];
    },
    // Globals referenced by other scenarioLoader functions but unused here.
    kingdomColors: {}, factions: {}, reserves: {}, victoryPoints: {}, gold: {},
    factionList: [], diplomacyHands: {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

// Disabled scenarios must be completely inert (protects Divine Right fidelity).
{
  const tileData = { '1,1': { row: 1, col: 1, faction: 'none' } };
  const ctx = makeContext({
    rules: { canSeizeTerrain: false },
    tileData,
    units: [{ faction: 'red', row: 1, col: 1, combatStrength: 10 }],
  });
  assert.strictEqual(ctx.updateTerritorialPressure().length, 0);
  assert.strictEqual(tileData['1,1'].faction, 'none');
}

// A strong army must hold a clear advantage for three full rounds before a flip.
{
  const tileData = { '1,1': { row: 1, col: 1, faction: 'none' } };
  const ctx = makeContext({
    rules: { canSeizeTerrain: true, territorialPressure: { requiredRounds: 3, requiredLead: 2 } },
    tileData,
    units: [{ faction: 'red', row: 1, col: 1, combatStrength: 5 }],
  });
  ctx.updateTerritorialPressure();
  ctx.updateTerritorialPressure();
  assert.strictEqual(tileData['1,1'].faction, 'none');
  const changed = ctx.updateTerritorialPressure();
  assert.strictEqual(tileData['1,1'].faction, 'red');
  assert.strictEqual(changed.length, 1);
}

// Existing ownership gets defensive inertia: 3 pressure cannot dislodge a +2 owner.
{
  const tileData = { '1,1': { row: 1, col: 1, faction: 'blue' } };
  const ctx = makeContext({
    rules: { canSeizeTerrain: true, territorialPressure: { requiredRounds: 3, requiredLead: 2, defenderBase: 2 } },
    tileData,
    units: [{ faction: 'red', row: 1, col: 1, combatStrength: 3 }],
  });
  for (let i = 0; i < 5; i++) ctx.updateTerritorialPressure();
  assert.strictEqual(tileData['1,1'].faction, 'blue');
  assert.strictEqual(tileData['1,1'].controlContest, undefined);
}

// Forts radiate weaker pressure into adjacent countryside and can slowly paint it.
{
  const tileData = {
    '1,1': { row: 1, col: 1, faction: 'blue', isFortress: true, fortressStrength: 2 },
    '1,2': { row: 1, col: 2, faction: 'none' },
  };
  const ctx = makeContext({
    rules: {
      canSeizeTerrain: true,
      territorialPressure: {
        requiredRounds: 3,
        requiredLead: 2,
        fortMultiplier: 3,
        adjacentFortFactor: 0.5,
      },
    },
    tileData,
    units: [],
    adjacency: { '1,1': [[1,2]] },
  });
  ctx.updateTerritorialPressure();
  ctx.updateTerritorialPressure();
  assert.strictEqual(tileData['1,2'].faction, 'none');
  ctx.updateTerritorialPressure();
  assert.strictEqual(tileData['1,2'].faction, 'blue');
}

const customScenario = JSON.parse(fs.readFileSync('scenarios/custom/scenario.json', 'utf8'));
assert.strictEqual(customScenario.rules.canSeizeTerrain, true);
assert.strictEqual(customScenario.rules.territorialPressure.requiredRounds, 3);

console.log('territorial pressure regression: ok');
