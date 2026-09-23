// Replace the prototype's adjacent-only siege roll with the full maintained
// besieging force defined by siegeAdvanced.js.
(function () {
  function enabled(){ return window.scenarioMeta?.id === 'board-game'; }
  function d6(){ return Math.floor(Math.random()*6)+1; }
  function counts(u){ return !!u && (u.combatStrength||0)>0 && (!u.isLeader || u.isEatersOfWisdom); }

  function chooseAdvanceUnits(unitsList, tile, key){
    const eligible=unitsList.filter(u=>units.includes(u));
    if(!eligible.length) return [];
    const faction=eligible[0].faction;
    if(controlTypes[faction]==='cpu') return eligible;
    const menu=eligible.map((u,i)=>`${i+1}. ${u.name||u.originalFaction||u.faction}`).join('\n');
    const answer=prompt(`Castle ${tile.name||key} is plundered. Advance besiegers?\n${menu}\n\nEnter all, none, or unit numbers:`);
    if(typeof parseUnitSelection==='function') return parseUnitSelection(answer,eligible.length,false).map(i=>eligible[i]).filter(Boolean);
    return /^all$/i.test(String(answer||''))?eligible:[];
  }

  function eliminateCastleCombatUnits(row,col,tile){
    const victims=units.filter(u=>u.row===row&&u.col===col&&u.faction===tile.faction&&counts(u));
    for(const u of [...victims]){
      const idx=units.indexOf(u); if(idx>=0) units.splice(idx,1);
    }
    const leaders=units.filter(u=>u.row===row&&u.col===col&&u.faction===tile.faction&&u.isLeader&&!u.isEatersOfWisdom);
    for(const leader of leaders) if(typeof fateDieRoll==='function') fateDieRoll(leader);
  }

  const base=typeof getBesiegedFortresses==='function'?getBesiegedFortresses:null;
  if(!base) return;
  getBesiegedFortresses=function(){
    const attackable=base();
    if(!enabled()||!attackable?.size) return attackable;

    for(const key of [...attackable]){
      const tile=tileData[key]; if(!tile?.siegeState) continue;
      const attacker=tile.siegeState.attackerFaction;
      const c=typeof getDivineRightSiegeConditions==='function'?getDivineRightSiegeConditions(attacker,key,tile):null;
      if(!c?.legal) continue;
      const [row,col]=key.split(',').map(Number);
      const defenderCargo=units
        .filter(u=>u.isFleet&&u.row===row&&u.col===col&&u.faction===tile.faction)
        .flatMap(f=>Array.isArray(f.cargo)?f.cargo:[])
        .filter(counts).length;
      const defenderStrength=Math.max(1,(tile.siegeIntrinsicDefence??tile.fortressStrength??0)+c.insideDefenders.length+defenderCargo);
      const attackerStrength=Math.max(0,c.attackingCombatUnits);
      let bonus=Math.max(0,Math.floor(attackerStrength/defenderStrength)-1);
      if(c.besiegers.some(u=>u.isOgsbogg)) bonus+=1;
      if(typeof getTalismanEnchantedCastleSiegeBonus==='function') bonus+=getTalismanEnchantedCastleSiegeBonus(c.besiegers,row,col)||0;
      if(typeof getIsleOfFrightPenalty==='function') bonus+=getIsleOfFrightPenalty(attacker)||0;
      const roll=d6(), total=roll+bonus;

      for(const u of c.besiegers){u.hasMoved=true;u.madeSiegeAttackTurn=turnNumber;}
      if(total>=6){
        eliminateCastleCombatUnits(row,col,tile);
        const vp=tile.stubstaffVP??((tile.siegeIntrinsicDefence??tile.fortressStrength??0)*(tile.isCapital?10:5));
        if(typeof addVictoryPoints==='function'&&vp) addVictoryPoints(attacker,vp);
        tile.fortressStrength=0; tile.plundered=true; delete tile.siegeState;
        const advancing=chooseAdvanceUnits(c.besiegers,tile,key);
        for(const u of advancing){u.row=row;u.col=col;u.castlePosition='outside';}
        alert(`${tile.name||key} is PLUNDERED! Siege roll ${roll}${bonus?` + ${bonus}`:''} = ${total}. ${attacker} gains ${vp} VP.`);
      }else{
        alert(`${tile.name||key} holds. Siege roll ${roll}${bonus?` + ${bonus}`:''} = ${total}; 6+ required.`);
      }
    }
    // Suppress the legacy adjacent-only resolver in index.js; this wrapper has
    // already resolved every attackable siege with the full maintained force.
    return new Set();
  };
})();
