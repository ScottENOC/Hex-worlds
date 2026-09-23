#!/usr/bin/env node
const assert=require('assert');const fs=require('fs');const vm=require('vm');
const source=fs.readFileSync('diplomacyAdvanced.js','utf8');
const units=[
 {faction:'red',isLeader:true,originalFaction:'red',row:9,col:9},
 {faction:'blue',isLeader:true,originalFaction:'blue',row:8,col:8},
 {faction:'blue',originalFaction:'pon',row:2,col:2,isLeader:false,isMercenary:false,startCoords:[2,2]},
 {faction:'blue',originalFaction:'pon',row:2,col:2,isLeader:true,isMercenary:false,startCoords:[2,2]}
];
const tileData={'2,2':{isFortress:true,isCapital:true,faction:'blue',originalFaction:'pon',allyOf:'blue',fortressStrength:3}};
const context={console,window:{scenarioMeta:{id:'board-game'}},units,tileData,turnNumber:4,controlTypes:{red:'human',blue:'human'},neutralFactions:new Set(),diplomacyHands:{red:[],blue:[]},ambassadorStatus:{},formAlliance:()=>{},handleDiploPlayPhase:()=>{},getNeutralKingdoms:()=>['pon'],isAmbassadorBanned:()=>false,banAmbassador:()=>{},getPersonalityCard:()=>null,alert:()=>{},prompt:()=>null,Math};
vm.createContext(context);vm.runInContext(source,context);
assert.deepStrictEqual(Array.from(context.window.enemyAlliedKingdoms('red')),['pon']);
assert.equal(context.window.deactivateKingdom('pon','test'),true);
assert.equal(tileData['2,2'].faction,'pon');assert.equal(tileData['2,2'].allyOf,undefined);
const survivors=units.filter(u=>u.originalFaction==='pon');assert(survivors.every(u=>u.deactivated));assert(survivors.every(u=>u.row===null&&u.col===null));
assert(context.neutralFactions.has('pon'));
console.log('Diplomacy fidelity regression passed.');
