const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('scenarioLoader.js', 'utf8');

function makeContext() {
  const tileData = {
    '1,1': { row:1, col:1, faction:'red', terrain:['plains'], lakes:[] },
    '1,2': { row:1, col:2, faction:'red', terrain:['plains'], lakes:[], isFortress:true, isCity:true, fortressStrength:5 },
    '2,1': { row:2, col:1, faction:'red', terrain:['plains'], lakes:[0,1,2,3,4,5] },
    '2,2': { row:2, col:2, faction:'blue', terrain:['plains'], lakes:[], isFortress:true, fortressStrength:2 },
  };
  const units = [
    { faction:'red', row:1, col:1, isLeader:true, combatStrength:0 },
    { faction:'red', row:1, col:1, combatStrength:1 },
    { faction:'red', row:1, col:2, combatStrength:1 },
    { faction:'blue', row:2, col:2, combatStrength:1 },
  ];
  const context = {
    console,
    tileData,
    units,
    gold:{ red:5, blue:5 },
    kingdomColors:{}, factions:{}, reserves:{}, victoryPoints:{}, factionList:[], diplomacyHands:{},
    turnOrder:['red','blue'], currentTurnIndex:0,
    window:{
      scenarioRules:{ economy:{ enabled:true, tileIncome:1, upkeepPerTroop:1, recruitCost:5, recruitMoveSpeed:5 }, canSeizeTerrain:true },
      addEventListener:()=>{},
    },
    getAdjacentCoords:()=>[],
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const ctx = makeContext();

// One ordinary tile = 1. A defence-5 city = its base 1 + 5 city income.
// The six-slice water hex is never taxable.
const red = ctx.calculateFactionEconomy('red');
assert.strictEqual(red.tiles, 2);
assert.strictEqual(red.cityBonus, 5);
assert.strictEqual(red.income, 7);
assert.strictEqual(red.troops, 2); // leader has no upkeep
assert.strictEqual(red.upkeep, 2);
assert.strictEqual(red.net, 5);

ctx.runSimpleEconomyRound();
assert.strictEqual(ctx.gold.red, 10);
assert.strictEqual(ctx.gold.blue, 7); // 1 tile + defence-2 city - 1 troop = +2

// Recruitment costs exactly five gold and creates one basic 1/1 troop at the city.
const before = ctx.units.length;
const recruit = ctx.recruitSimpleTroop('red', 1, 2);
assert.ok(recruit);
assert.strictEqual(ctx.gold.red, 5);
assert.strictEqual(ctx.units.length, before + 1);
assert.strictEqual(recruit.combatStrength, 1);
assert.strictEqual(recruit.siegeStrength, 1);
assert.strictEqual(recruit.hasMoved, true);

// Ordinary land and full water are not recruitment sites.
assert.strictEqual(ctx.recruitSimpleTroop('red', 1, 1), null);
assert.strictEqual(ctx.recruitSimpleTroop('red', 2, 1), null);

// Full water cannot retain ownership or territorial contest state.
ctx.tileData['2,1'].faction = 'red';
ctx.tileData['2,1'].controlContest = { faction:'blue', rounds:2 };
ctx.updateTerritorialPressure();
assert.strictEqual(ctx.tileData['2,1'].faction, 'none');
assert.strictEqual(ctx.tileData['2,1'].controlContest, undefined);

const scenario = JSON.parse(fs.readFileSync('scenarios/custom/scenario.json', 'utf8'));
assert.strictEqual(scenario.rules.economy.tileIncome, 1);
assert.strictEqual(scenario.rules.economy.upkeepPerTroop, 1);
assert.strictEqual(scenario.rules.economy.recruitCost, 5);
assert.ok(scenario.locations.length >= 8);

console.log('simple economy regression: ok');
