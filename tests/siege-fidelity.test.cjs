const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function adjacent(r, c) {
  return [
    [r + 1, c], [r - 1, c], [r, c + 1],
    [r, c - 1], [r + 1, c - 1], [r - 1, c + 1],
  ];
}

const context = {
  window: { scenarioMeta: { id: 'board-game' } },
  tileData: {},
  units: [],
  turnOrder: ['attacker'],
  currentTurnIndex: 0,
  turnNumber: 1,
  alert: () => {},
  console,
  getAdjacentCoords: adjacent,
  getBesiegedFortresses: () => new Set(),
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('phase4siege.js', 'utf8'), context);

function resetCastle({ seaApproach = false } = {}) {
  context.tileData = {};
  context.units = [];
  context.turnNumber = 1;
  context.currentTurnIndex = 0;
  context.tileData['0,0'] = {
    row: 0,
    col: 0,
    faction: 'defender',
    isFortress: true,
    fortressStrength: 2,
    isCapital: false,
    lakes: [],
  };
  const ring = adjacent(0, 0);
  ring.forEach(([r, c], i) => {
    context.tileData[`${r},${c}`] = {
      row: r,
      col: c,
      faction: 'none',
      terrain: ['plains'],
      lakes: seaApproach && i === 0 ? [0,1,2,3,4,5] : [],
    };
  });
  return ring;
}

function landUnit(row, col) {
  return { faction: 'attacker', row, col, combatStrength: 1, siegeStrength: 1, isLeader: false, isFleet: false, hasMoved: false };
}

function fleet(row, col) {
  return { faction: 'attacker', row, col, combatStrength: 1, siegeStrength: 1, isLeader: false, isFleet: true, hasMoved: false };
}

// A fully covered castle with enough combat units is declared under siege,
// but is not attackable until a subsequent siege-resolution phase.
{
  const ring = resetCastle();
  context.units.push(...ring.map(([r, c]) => landUnit(r, c)));

  let attackable = context.getBesiegedFortresses();
  assert.equal(attackable.size, 0, 'new siege should not roll immediately');
  assert.equal(context.tileData['0,0'].siegeState.attackerFaction, 'attacker');

  context.turnNumber = 2;
  attackable = context.getBesiegedFortresses();
  assert.equal(attackable.has('0,0'), true, 'persistent siege should roll next turn');
  assert.equal(context.units.every(u => u.hasMoved), true, 'siege attackers are spent for movement');
}

// Breaking the encirclement breaks the persistent siege.
{
  const ring = resetCastle();
  context.units.push(...ring.map(([r, c]) => landUnit(r, c)));
  context.getBesiegedFortresses();
  assert.ok(context.tileData['0,0'].siegeState);

  context.units.splice(1);
  context.turnNumber = 2;
  const attackable = context.getBesiegedFortresses();
  assert.equal(attackable.size, 0);
  assert.equal(context.tileData['0,0'].siegeState, undefined, 'siege should break when coverage is lost');
}

// Land Zones of Siege cannot cover an all-sea approach. A fleet restores the
// missing sea coverage, matching the port-siege rule naturally.
{
  const ring = resetCastle({ seaApproach: true });
  context.units.push(...ring.map(([r, c]) => landUnit(r, c)));
  let conditions = context.window.getDivineRightSiegeConditions('attacker', '0,0', context.tileData['0,0']);
  assert.equal(conditions.legal, false, 'land units alone must not seal an all-sea approach');

  const [seaR, seaC] = ring[0];
  context.units = context.units.filter(u => !(u.row === seaR && u.col === seaC));
  context.units.push(fleet(seaR, seaC));
  conditions = context.window.getDivineRightSiegeConditions('attacker', '0,0', context.tileData['0,0']);
  assert.equal(conditions.legal, true, 'fleet should seal the all-sea approach');
}

console.log('Siege fidelity regression tests passed.');
