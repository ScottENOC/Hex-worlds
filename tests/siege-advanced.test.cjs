#!/usr/bin/env node
const assert=require('assert');const fs=require('fs');const vm=require('vm');
const source=fs.readFileSync('siegeAdvanced.js','utf8');
const tileData={
 '5,5':{isFortress:true,isPort:true,faction:'blue',fortressStrength:2,lakes:[0,1]},
 '4,5':{lakes:[0,1,2,3,4,5]},'4,6':{lakes:[0,1,2,3,4,5]},'5,4':{terrain:['plains']},'5,6':{terrain:['plains']},'6,5':{terrain:['plains']},'6,6':{terrain:['plains']}
};
function adj(r,c){
 if(r===5&&c===5)return [[4,5],[4,6],[5,4],[5,6],[6,5],[6,6]];
 return [[5,5],[4,5],[4,6],[5,4],[5,6],[6,5],[6,6]].filter(([rr,cc])=>!(rr===r&&cc===c));
}
let units=[
 {faction:'red',row:4,col:5,isFleet:true,combatStrength:1,cargo:[{faction:'red',combatStrength:1}]},
 {faction:'red',row:5,col:4,isFleet:false,combatStrength:1},
 {faction:'red',row:6,col:5,isFleet:false,combatStrength:1},
 {faction:'blue',row:5,col:5,isFleet:false,combatStrength:1,castlePosition:'inside'}
];
const context={console,window:{scenarioMeta:{id:'board-game'}},tileData,units,getAdjacentCoords:adj,getBesiegedFortresses:()=>new Set(),turnOrder:['red'],currentTurnIndex:0,turnNumber:2,alert:()=>{},setTimeout:()=>{},document:{},svg:{},selectedUnit:null,currentPhase:'movement',drawMap:()=>{},getAdjacentEnemies:()=>[],addCombatDeclaration:()=>({}),mergeNextCombatDeclarations:q=>({declarations:q}),startCombatResolution:function(){},resolveCurrentCombat:function(){},confirm:()=>false};
vm.createContext(context);vm.runInContext(source,context);
let c=context.window.getDivineRightSiegeConditions('red','5,5',tileData['5,5']);
assert.equal(c.portFleetMet,true,'port siege needs and has a fleet');
assert.equal(c.attackingCombatUnits,4,'fleet cargo counts for siege strength');
assert.equal(c.outsideDefenders.length,0);
units.push({faction:'blue',row:5,col:5,isFleet:false,combatStrength:1,castlePosition:'outside'});
c=context.window.getDivineRightSiegeConditions('red','5,5',tileData['5,5']);
assert.equal(c.legal,false,'outside defenders block declaration');
units.pop();
units=units.filter(u=>!u.isFleet);context.units=units;
c=context.window.getDivineRightSiegeConditions('red','5,5',tileData['5,5']);
assert.equal(c.portFleetMet,false,'port cannot be maintained without a fleet');
console.log('Advanced siege fidelity regression passed.');
