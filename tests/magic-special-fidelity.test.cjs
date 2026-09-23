#!/usr/bin/env node
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const magic=fs.readFileSync('magicSpecialFidelity.js','utf8');
const combat=fs.readFileSync('magicCombatCompat.js','utf8');
const loader=fs.readFileSync('phase5Movement.js','utf8');

let deployArgs=null;
const context={
  console,Math,Set,Map,Number,Object,Array,String,JSON,parseInt,
  alert:()=>{},prompt:()=> '1',confirm:()=>false,setTimeout:(fn)=>fn(),
  window:{scenarioMeta:{id:'board-game'}},
  document:{getElementById:()=>null,createElement:()=>({addEventListener(){}})},
  tileData:{
    '1,1':{faction:'player',isCapital:true,wanderingPeopleGifts:['Flying Carpet','Spinning Wheel','Guiding Light']},
    '2,1':{faction:'none',terrain:['forest'],lakes:[]},
    '3,1':{faction:'none',terrain:['plains'],lakes:[]},
  },
  units:[],turnOrder:['player'],currentTurnIndex:0,currentPhase:'event',turnNumber:3,
  controlTypes:{player:'human',enemy:'human'},neutralFactions:new Set(),personalityCards:{},PERSONALITY_CARDS:{},declaredCombats:[],
  specialMercPool:{usurper:[]},
  getAdjacentCoords:(r,c)=>[[r+1,c],[r-1,c]].filter(([rr])=>rr>=1&&rr<=3),
  validMoves:()=>[],getAdjacentEnemies:()=>[[2,1]],getRetreatThreshold:()=>3,
  attemptRetreatBeforeCombat:()=>false,
  handleReserveDeployment:(n,a,m,cb)=>{deployArgs=[n,a,m];if(cb)cb();},
  handleSpecialMercCard:(_f,_c,cb)=>cb(),
  handleEventPhase:()=>{},
  drawMap:()=>{},
};
vm.createContext(context);
vm.runInContext(magic,context,{filename:'magicSpecialFidelity.js'});

// Existing string gifts are normalized into owned, movable records.
assert.equal(context.window.factionOwnsWanderingGift('player','Spinning Wheel'),true);
assert.equal(context.tileData['1,1'].wanderingGiftRecords.length,3);

// Spinning Wheel adds exactly one mercenary to Random Event recruitment.
context.handleReserveDeployment(2,false,true,()=>{});
assert.deepEqual(deployArgs,[3,false,true]);

// Enemy combat units capture loose Wandering People gifts and ownership changes.
const invader={faction:'enemy',row:1,col:1,combatStrength:2,isLeader:false};
context.units.push(invader);
const captured=context.window.captureLooseMagicGifts(invader);
assert.equal(captured.length,3);
assert.equal(captured.every(g=>g.ownerFaction==='enemy'),true);
assert.equal(context.window.factionOwnsWanderingGift('enemy','Flying Carpet'),true);

// Urmoff begins unreachable while submerged to a normal fleet and dives on 3+.
const urmoff={faction:'enemy',row:2,col:1,isUrmoff:true,isFleet:true,submerged:true};
context.units.push(urmoff);
const fleet={faction:'player',row:1,col:1,isFleet:true};
assert.equal(context.getAdjacentEnemies(fleet).length,0);
urmoff.submerged=false;
const oldRandom=context.Math.random; context.Math.random=()=>0.5; // roll 4
assert.equal(context.attemptRetreatBeforeCombat([urmoff],{row:2,col:1}),true);
assert.equal(urmoff.submerged,true);
context.Math.random=oldRandom;

// Sword of Wizardry makes its leader magical for Ghost Rider combat.
context.window.canAttackGhostRiders=()=>false;
context.window.getDivineRightCombatLeaderBonus=()=>0;
vm.runInContext(combat,context,{filename:'magicCombatCompat.js'});
const swordLeader={isLeader:true,magicGift:'Sword of Wizardry'};
assert.equal(context.window.canAttackGhostRiders([swordLeader],[{isGhostRiders:true}]),true);

// Airboat is represented by its holder plus its separate CS 1 contribution.
const airboatLeader={isLeader:true,magicGift:'Airboat of Armera',combatStrength:0};
assert.equal(context.window.divineRightEffectiveCombatStrength([airboatLeader],{row:3,col:1}),1);

for(const name of ['magicSpecialFidelity.js','magicCombatCompat.js','magicRuleFinalCompat.js']){
  assert(loader.includes(name),`late loader must include ${name}`);
}
console.log('Magic/special-unit fidelity regression passed.');
