#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('rulesMinorFidelity.js', 'utf8');
const loader = fs.readFileSync('phase5Movement.js', 'utf8');

const vp = {};
const context = {
  console,
  Math,
  Set,
  Map,
  Number,
  Object,
  Array,
  String,
  JSON,
  parseInt,
  alert: () => {},
  prompt: () => '0',
  confirm: () => false,
  setTimeout: (fn) => fn(),
  window: { scenarioMeta: { id: 'board-game' } },
  tileData: {
    '5,5': { faction: 'neutralK', originalFaction: 'neutralK', isFortress: true, isCapital: true, fortressStrength: 3 },
    '1,1': { faction: 'captor', isFortress: true, isCapital: true, fortressStrength: 3 },
    '2,2': { faction: 'player', isPort: true, isFortress: true },
    '3,3': { faction: 'player', isPort: true, isFortress: false },
    '4,4': { faction: 'none' },
  },
  units: [],
  neutralFactions: new Set(['neutralK']),
  controlTypes: { player: 'human', captor: 'human', neutralK: 'neutral' },
  ambassadorBanned: {},
  diplomacyHands: {},
  personalityCards: { neutralK: 11 },
  PERSONALITY_CARDS: { 11: { id: 11, name: 'Test' }, 17: { id: 17, name: 'Other' } },
  DIPLO_CARD_TEMPLATES: [
    { type: 'bribe', value: 2, label: 'Bribe +2' },
    { type: 'bribe', value: 2, label: 'Bribe +2' },
    { type: 'bribe', value: 2, label: 'Bribe +2' },
    { type: 'longOration', value: 1, label: 'Long Oration +1' },
  ],
  turnNumber: 4,
  turnOrder: ['player', 'captor'],
  currentTurnIndex: 0,
  currentPhase: 'movement',
  selectedUnit: null,
  eliminatedFactions: new Set(),
  addVictoryPoints: (f, n) => { vp[f] = (vp[f] || 0) + n; },
  updateVPInfo: () => {},
  drawMap: () => {},
  removeUnit: u => { const i = context.units.indexOf(u); if (i >= 0) context.units.splice(i, 1); },
  handleReserveDeployment: (_n, _r, _m, cb) => cb(),
  updateTurnInfo: () => {},
  dispatchCPUIfNeeded: () => {},
  getNeutralKingdoms: () => ['neutralK'],
  formAlliance: () => {},
  getPersonalityCard: k => context.PERSONALITY_CARDS[context.personalityCards[k]],
  validMoves: () => [],
  deactivateKingdom: () => true,
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'rulesMinorFidelity.js' });

// The 46-card bug is corrected by removing the extra Bribe +2.
assert.equal(context.DIPLO_CARD_TEMPLATES.filter(c => c.type === 'bribe' && c.value === 2).length, 2);

// Border violation penalty is non-stacking; execution-style permanent penalties add separately.
assert.equal(context.window.recordDiplomaticViolation('player', 'neutralK'), true);
assert.equal(context.window.recordDiplomaticViolation('player', 'neutralK'), false);
assert.equal(context.window.diplomaticPenaltyMagnitude('player', 'neutralK'), 1);
context.window.recordPermanentDiplomaticPenalty('player', 'neutralK');
assert.equal(context.window.diplomaticPenaltyMagnitude('player', 'neutralK'), 2);
assert.equal(context.window.getDiplomaticPenaltyModifier('player', 'neutralK'), -2);

// Bad Omens suppresses regular combat/siege values but not movement allowance.
const regular = { faction: 'player', combatStrength: 3, siegeStrength: 2, moveSpeed: 5 };
context.units.push(regular);
const hitKingdom = context.window.applyBadOmens('player', () => 0);
assert.equal(hitKingdom, 'player');
assert.equal(regular.combatStrength, 0);
assert.equal(regular.siegeStrength, 0);
assert.equal(regular.moveSpeed, 5);

// Castle ports shelter all fleets from Storms; non-castle ports shelter one.
const castleFleetA = { faction: 'player', isFleet: true, row: 2, col: 2 };
const castleFleetB = { faction: 'player', isFleet: true, row: 2, col: 2 };
const smallPortA = { faction: 'player', isFleet: true, row: 3, col: 3 };
const smallPortB = { faction: 'player', isFleet: true, row: 3, col: 3 };
const seaFleet = { faction: 'player', isFleet: true, row: 4, col: 4 };
context.units.push(castleFleetA, castleFleetB, smallPortA, smallPortB, seaFleet);
const vulnerable = context.window.stormVulnerableFleets('player');
assert(!vulnerable.includes(castleFleetA) && !vulnerable.includes(castleFleetB));
assert.equal(vulnerable.filter(u => u === smallPortA || u === smallPortB).length, 1);
assert(vulnerable.includes(seaFleet));

// Non-player monarch capture awards 30 VP and places the monarch in a prison castle.
const allyMonarch = { isLeader: true, originalFaction: 'neutralK', faction: 'player', row: 6, col: 6 };
context.units.push(allyMonarch);
const prison = context.window.resolveMonarchCapture(allyMonarch, 'captor');
assert(prison && prison.key === '1,1');
assert.equal(allyMonarch.isPrisoner, true);
assert.equal(allyMonarch.capturedBy, 'captor');
assert.equal(vp.captor, 30);

// The late-load chain must keep every advanced module plus this one.
for (const filename of ['navalRules.js', 'diplomacyAdvanced.js', 'siegeAdvanced.js', 'siegeResolution.js', 'rulesMinorFidelity.js']) {
  assert(loader.includes(filename), `phase5Movement.js must load ${filename}`);
}

console.log('Minor rules fidelity regression passed.');
