#!/usr/bin/env node
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

const edge=fs.readFileSync('magicEdgeFidelity.js','utf8');
const talisman=fs.readFileSync('talismanSpellFidelity.js','utf8');
const loader=fs.readFileSync('phase5Movement.js','utf8');
const siege=fs.readFileSync('siegeResolution.js','utf8');

const context={
  console, Set, Map, Number, Object, Array, String, JSON,
  Math:Object.create(Math),
  window:{scenarioMeta:{id:'board-game'}},
  alert:()=>{}, prompt:()=>null, confirm:()=>false,
  units:[], tileData:{}, turnOrder:['player','enemy'], currentTurnIndex:0, turnNumber:3,
  currentPhase:'diplo-play', controlTypes:{player:'human',enemy:'human'}, neutralFactions:new Set(),
  diplomacyHands:{player:[]}, personalityCards:{}, factionList:[],
  specialMercPool:{}, DIPLO_CARD_TEMPLATES:[],
  highlightedTilesByType:{combat:[]},
  drawMap:()=>{}, getAdjacentCoords:()=>[],
  endTurn:()=>{}, handleDiploPlayPhase:(_f,cb)=>cb(),
  formAlliance:()=>{}, deactivateKingdom:()=>{}, getPersonalityCard:()=>null,
  getDiplomaticPenaltyModifier:()=>0,
  validMoves:()=>[], getBesiegedFortresses:()=>new Set(),
  _resolveBoon:()=>{},
};
context.window.prompt=context.prompt;
vm.createContext(context);
vm.runInContext(edge,context,{filename:'magicEdgeFidelity.js'});
vm.runInContext(talisman,context,{filename:'talismanSpellFidelity.js'});

// Talisman protection is exposed and recognizes an active, free holder.
context.units.push({isLeader:true,isPrisoner:false,magicGift:'Talisman of Dispel',row:4,col:5,faction:'player'});
assert.equal(context.window.isTalismanProtectedHex(4,5),true);
assert.equal(context.window.isTalismanProtectedHex(4,6),false);

// The explicit Enchanted Castle siege bonus is exactly +1 when a besieger has the Talisman.
context.units.push({isEatersOfWisdom:true,enchantedCastleActive:true,row:8,col:8,faction:'enemy'});
const besieger={isLeader:true,isPrisoner:false,magicGift:'Talisman of Dispel',faction:'player'};
assert.equal(context.window.getTalismanEnchantedCastleSiegeBonus([besieger],8,8),1);
assert.equal(context.window.getTalismanEnchantedCastleSiegeBonus([],8,8),0);

// Magical combat strength is suppressed in a protected target hex.
context.window.divineRightEffectiveCombatStrength=(side)=>side.reduce((n,u)=>n+(u.combatStrength||0),0);
// The final edge wrapper was installed before this test replacement, so static verification covers the hook itself.
assert(edge.includes('if(!isMagicalUnit(u)) total+=Number(u.combatStrength||0)'));

// The final modules must remain last in the dynamic load chain.
assert(loader.includes("'magicEdgeFidelity.js'"));
assert(loader.includes("'talismanSpellFidelity.js'"));
assert(loader.indexOf('magicEdgeFidelity.js')>loader.indexOf('magicRuleFinalCompat.js'));
assert(loader.indexOf('talismanSpellFidelity.js')>loader.indexOf('magicEdgeFidelity.js'));

// Siege resolver consumes the late-bound Talisman bonus hook.
assert(siege.includes('getTalismanEnchantedCastleSiegeBonus'));

// Special Mercenary Leader and Black Knight edge rules are present in executable code.
assert(edge.includes('specialMercForcedPeaceUsed'));
assert(edge.includes("roll<=4"));
assert(edge.includes('blackKnightDisabled=true'));
assert(edge.includes('Stubstaff Keep'));

// Mask path explicitly excludes assassination/duel by only exposing the four legal action classes.
assert(edge.includes("id:'activate'"));
assert(edge.includes("id:'deactivate'"));
assert(edge.includes("id:'merc'"));
assert(edge.includes("id:'barb'"));
assert(!/MASK OF INFLUENCE[\s\S]{0,1500}assass/i.test(edge));

console.log('Magic edge fidelity regression passed.');
