#!/usr/bin/env node
const assert=require('assert');const fs=require('fs');const vm=require('vm');
const source=fs.readFileSync('navalRules.js','utf8');
const tileData={
 '1,1':{lakes:[0,1,2,3,4,5]},'1,2':{lakes:[0,1,2,3,4,5]},'1,3':{lakes:[0,1]},
 '2,1':{terrain:['plains'],isPort:true,faction:'red'},'2,2':{terrain:['plains']}
};
let units=[];
function adj(r,c){return [[r,c-1],[r,c+1],[r-1,c],[r+1,c]].filter(([rr,cc])=>tileData[`${rr},${cc}`]);}
const context={console,window:{scenarioMeta:{id:'board-game'}},tileData,units,getAdjacentCoords:adj,validMoves:()=>[],turnOrder:['red'],currentTurnIndex:0,currentPhase:'movement',selectedUnit:null,setTimeout:()=>{},document:{},svg:{},alert:()=>{},confirm:()=>false,prompt:()=>null,drawMap:()=>{}};
vm.createContext(context);vm.runInContext(source,context);
const fleet={faction:'red',originalFaction:'red',row:1,col:1,moveSpeed:3,isFleet:true,combatId:'f1'};units.push(fleet);
assert(context.window.fleetValidMoves(fleet).some(([r,c])=>r===1&&c===3),'fleet should reach coastal hex');
units.push({faction:'blue',row:1,col:2,isFleet:true});
assert(!context.window.fleetValidMoves(fleet).some(([r,c])=>r===1&&c===2),'enemy fleet blocks entry');
units.pop();
const army={faction:'red',row:1,col:1,isFleet:false,combatStrength:1,name:'Army'};units.push(army);
assert.equal(context.window.embarkUnit(fleet,army),true);assert.equal(units.includes(army),false);assert.equal(fleet.cargo.length,1);
const army2={faction:'red',row:1,col:1,isFleet:false,combatStrength:1,name:'Army2'};units.push(army2);
assert.equal(context.window.embarkUnit(fleet,army2),false,'one combat unit per fleet');
fleet.row=1;fleet.col=3;assert.equal(context.window.canDisembarkHere(fleet),true);assert.equal(context.window.disembarkAll(fleet),1);assert(units.includes(army));
console.log('Naval fidelity regression passed.');
