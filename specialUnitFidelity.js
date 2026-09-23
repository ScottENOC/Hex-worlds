// Selected advanced special-unit interactions with explicit rulebook text.
(function(){
  function enabled(){return window.scenarioMeta?.id==='board-game';}
  function d6(){return Math.floor(Math.random()*6)+1;}
  function kingdomOf(u){return u?.originalFaction||u?.faction||null;}

  // Ghost Riders may not enter castles or stack with any other unit. Other units
  // likewise may not end movement stacked with the Riders.
  const baseValidMoves=typeof validMoves==='function'?validMoves:null;
  if(baseValidMoves) validMoves=function(unit){
    const moves=baseValidMoves(unit);
    if(!enabled()) return moves;
    return moves.filter(([r,c])=>{
      const stack=units.filter(u=>u.row===r&&u.col===c&&u!==unit);
      const tile=tileData[`${r},${c}`];
      if(unit?.isGhostRiders) return !tile?.isFortress && stack.length===0;
      if(stack.some(u=>u.isGhostRiders)) return false;
      return true;
    });
  };

  // A cursed monarch rolls twice for leader fate and takes the first adverse
  // result. Reuse the main resolver by feeding it the selected result once.
  const baseFate=typeof fateDieRoll==='function'?fateDieRoll:null;
  if(baseFate) fateDieRoll=function(unit){
    if(!enabled()||!unit?.cursed||unit.hasTakenAFateDieRoll) return baseFate.apply(this,arguments);
    const r1=d6(),r2=d6();
    const chosen=(r1===1||r1===6)?r1:((r2===1||r2===6)?r2:r2);
    alert(`${unit.name||kingdomOf(unit)||'Cursed monarch'} is cursed: fate rolls ${r1} and ${r2}; result ${chosen} applies.`);
    const old=Math.random;
    Math.random=()=>Math.max(0,Math.min(0.999999,(chosen-0.5)/6));
    try{return baseFate.apply(this,arguments);}finally{Math.random=old;}
  };

  function findPlayerMonarch(faction){
    return units.find(u=>u.isLeader&&u.faction===faction&&(!u.originalFaction||u.originalFaction===faction)&&!u.isPrisoner) ||
      units.find(u=>u.isLeader&&u.faction===faction&&!u.isPrisoner) || null;
  }
  function clearWanderingGifts(hostFaction){
    for(const t of Object.values(tileData)){
      if((t.originalFaction||t.faction)===hostFaction && t.wanderingPeopleGifts) delete t.wanderingPeopleGifts;
    }
  }
  function driveOutWanderingPeople(attacker, row, col){
    const settlers=units.filter(u=>u.row===row&&u.col===col&&(u.isWanderingPeople||u.isWanderingTroop));
    if(!settlers.length)return false;
    const host=settlers[0].faction;
    if(host===attacker.faction)return false;
    for(const u of [...settlers]){const i=units.indexOf(u);if(i>=0)units.splice(i,1);}
    clearWanderingGifts(host);
    const hostMonarch=findPlayerMonarch(host), attackingMonarch=findPlayerMonarch(attacker.faction);
    const roll=d6();
    if(roll<=3&&hostMonarch)hostMonarch.cursed=true;
    else if(roll<=5&&attackingMonarch)attackingMonarch.cursed=true;
    else if(roll===6){if(hostMonarch)hostMonarch.cursed=true;if(attackingMonarch)attackingMonarch.cursed=true;}
    alert(`The Wandering People are driven out. Curse roll ${roll}: ${roll<=3?'host monarch':roll<=5?'attacking monarch':'both monarchs'} cursed.`);
    drawMap();
    return true;
  }

  // Watch a legal movement into the Wandering People's settlement, but let the
  // normal movement handler perform the move before resolving the expulsion.
  if(typeof svg!=='undefined'&&svg?.addEventListener&&svg.dataset.wanderingExpulsion!=='1'){
    svg.dataset.wanderingExpulsion='1';
    svg.addEventListener('click',event=>{
      if(!enabled()||currentPhase!=='movement'||!selectedUnit||(selectedUnit.combatStrength||0)<=0)return;
      const text=event.target?.dataset?.hex;if(!text)return;
      const [r,c]=text.split(',').map(Number);
      if(!validMoves(selectedUnit).some(([rr,cc])=>rr===r&&cc===c))return;
      const has=units.some(u=>u.row===r&&u.col===c&&(u.isWanderingPeople||u.isWanderingTroop)&&u.faction!==selectedUnit.faction);
      if(!has)return;
      const attacker=selectedUnit;
      setTimeout(()=>driveOutWanderingPeople(attacker,r,c),0);
    },true);
  }

  // Detect deactivations that occur inside the earlier diplomacy module and mark
  // foreign active units in the now-neutral realm for their one-Movement-Phase
  // withdrawal grace.
  const baseDiplo=typeof handleDiploPlayPhase==='function'?handleDiploPlayPhase:null;
  if(baseDiplo) handleDiploPlayPhase=function(faction,onComplete){
    const before=new Set();
    for(const t of Object.values(tileData)) if(t?.allyOf) before.add(t.originalFaction||t.faction);
    return baseDiplo(faction,()=>{
      for(const kingdom of before){
        const stillAllied=Object.values(tileData).some(t=>(t.originalFaction||t.faction)===kingdom&&t.allyOf);
        if(!stillAllied&&neutralFactions.has(kingdom)&&typeof markNeutralWithdrawalGrace==='function') markNeutralWithdrawalGrace(kingdom);
      }
      onComplete();
    });
  };

  window.driveOutWanderingPeople=driveOutWanderingPeople;
})();
