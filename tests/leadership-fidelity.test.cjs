#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const leadership = fs.readFileSync('rulesLeadershipFidelity.js','utf8');
const special = fs.readFileSync('specialUnitFidelity.js','utf8');
const loader = fs.readFileSync('phase5Movement.js','utf8');

const context = {
  console, Math, Set, Map, Number, Object, Array, String, JSON, parseInt,
  alert:()=>{}, prompt:()=> 'none', confirm:()=>false, setTimeout:fn=>fn(),
  window:{scenarioMeta:{id:'board-game'},scenarioRules:{}},
  PERSONALITY_CARDS:{11:{id:11,name:'old'},17:{id:17,name:'old17',monarchCantLeave:true}},
  personalityCards:{neutralK:16},
  units:[], tileData:{}, neutralFactions:new Set(['neutralK']),
  controlTypes:{player:'human',neutralK:'neutral'}, turnNumber:3,
  turnOrder:['player'], currentTurnIndex:0, currentPhase:'movement', selectedUnit:null,
  highlightedTilesByType:{movement:[],combat:[],event:[],siege:[]},
  getPersonalityCard:k=>context.PERSONALITY_CARDS[context.personalityCards[k]],
  getAdjacentCoords:(r,c)=>[[r-1,c],[r+1,c],[r,c-1],[r,c+1],[r-1,c-1],[r+1,c+1]],
  validMoves:()=>[], getAdjacentEnemies:()=>[],
  initGame:()=>true, formAlliance:(f,k)=>{for(const u of context.units)if(u.faction===k)u.faction=f;},
  endTurn:()=>{}, handleEventPhase:()=>{}, drawMap:()=>{}, showHexInfo:()=>{},
  fateDieRoll:()=>{}, handleDiploPlayPhase:(_f,cb)=>cb(), recordBorderViolation:()=>true,
};
vm.createContext(context);
vm.runInContext(leadership,context,{filename:'rulesLeadershipFidelity.js'});

assert.equal(Object.keys(context.PERSONALITY_CARDS).length,20,'twenty unique numbered personalities');
assert.equal(context.PERSONALITY_CARDS[11].name,'Avaricious');
assert.equal(context.PERSONALITY_CARDS[15].immuneToDiplomaticDeactivation,true);
assert.equal(context.PERSONALITY_CARDS[16].combatDieBonus,1);
assert.equal(context.PERSONALITY_CARDS[17].monarchCantLeave,true);

// Neutral regulars are dormant until activation.
context.tileData['5,5']={faction:'neutralK',originalFaction:'neutralK',isCapital:true,isFortress:true};
context.tileData['5,6']={faction:'neutralK',originalFaction:'neutralK'};
const neutralRegular={faction:'neutralK',row:5,col:5,startCoords:[5,5],combatStrength:2,siegeStrength:1,moveSpeed:5};
const neutralLeader={faction:'neutralK',row:5,col:5,startCoords:[5,5],isLeader:true,combatStrength:0,moveSpeed:7};
context.units.push(neutralRegular,neutralLeader);
context.window.prepareInactiveKingdoms();
assert.equal(neutralRegular.row,null);
assert.equal(neutralRegular.neutralDormant,true);

// If its printed placement hex is occupied, activation uses an adjacent own hex.
context.units.push({faction:'enemy',row:5,col:5,combatStrength:1});
context.window.deployActivatedKingdom('player','neutralK');
assert.equal(neutralRegular.faction,'player');
assert.notDeepEqual([neutralRegular.row,neutralRegular.col],[5,5]);
assert.equal(neutralRegular.cannotAttackUntilTurn,4);

// Personality #16 supplies one +1 leader Combat Roll bonus.
neutralLeader.originalFaction='neutralK'; neutralLeader.faction='player'; neutralLeader.row=5; neutralLeader.col=6;
const ownRegular={faction:'player',originalFaction:'neutralK',row:5,col:6,combatStrength:3};
assert.equal(context.window.getDivineRightCombatLeaderBonus([neutralLeader,ownRegular],{row:5,col:6}),1);

// Ghost Riders require magic attackers; Wandering People music succeeds on 5-6.
const ghost={isGhostRiders:true};
assert.equal(context.window.canAttackGhostRiders([{combatStrength:3}],[ghost]),false);
assert.equal(context.window.canAttackGhostRiders([{isMagical:true}],[ghost]),true);
assert.equal(context.window.wanderingMusicBlocksAttack([{isWanderingTroop:true}],()=>0.8),true);
assert.equal(context.window.wanderingMusicBlocksAttack([{isWanderingTroop:true}],()=>0.2),false);

// Withdrawal grace is recorded without immediately penalising the trapped unit.
context.tileData['8,8']={faction:'neutralK',originalFaction:'neutralK'};
const trapped={faction:'player',row:8,col:8,combatStrength:1}; context.units.push(trapped);
context.window.markNeutralWithdrawalGrace('neutralK');
assert.equal(trapped.withdrawNeutralKingdom,'neutralK');
assert.equal(trapped.withdrawGraceUntilOwnTurn,true);

vm.runInContext(special,context,{filename:'specialUnitFidelity.js'});
const baseMoves=context.validMoves;
context.validMoves=()=>[[5,5],[5,6]];
// Loader contains all final layers in deterministic order.
for(const f of ['rulesMinorFidelity.js','rulesFidelityCompat.js','rulesLeadershipFidelity.js','specialUnitFidelity.js','combatLeadershipResolution.js']){
  assert(loader.includes(f),`loader must include ${f}`);
}
console.log('Leadership/personality fidelity regression passed.');
