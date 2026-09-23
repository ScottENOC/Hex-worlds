// Advanced siege/castle fidelity: inside/outside units, port fleets, seaborne troops, sorties and relief.
(function () {
  function enabled(){ return window.scenarioMeta?.id === 'board-game'; }
  function kind(tile){ return typeof drTileKind === 'function' ? drTileKind(tile) : ((tile?.lakes||[]).length>=6?'sea':(tile?.lakes||[]).length?'coastal':'land'); }
  function counts(unit){ return !!unit && ((unit.combatStrength||0)>0) && (!unit.isLeader || unit.isEatersOfWisdom); }
  function intrinsic(tile){ return tile.siegeIntrinsicDefence != null ? tile.siegeIntrinsicDefence : Math.max(0,tile.fortressStrength||0); }
  function cargoCombat(fleet){ return typeof getFleetCargoCombatUnits==='function' ? getFleetCargoCombatUnits(fleet) : (fleet.cargo||[]).filter(counts); }

  function initialiseCastlePositions(){
    if(!enabled()) return;
    for(const u of units){
      const t=tileData[`${u.row},${u.col}`];
      if(t?.isFortress && u.faction===t.faction && u.castlePosition==null) u.castlePosition='inside';
    }
  }
  function setCastlePosition(unit, position){
    const t=tileData[`${unit?.row},${unit?.col}`];
    if(!unit || !t?.isFortress || unit.faction!==t.faction || !['inside','outside'].includes(position)) return false;
    unit.castlePosition=position; return true;
  }

  function canZone(unit,targetTile){
    const k=kind(targetTile);
    return unit.isFleet ? (k==='sea'||k==='coastal') : (k==='land'||k==='coastal');
  }
  function covers(unit,row,col){
    if(!counts(unit) || !canZone(unit,tileData[`${row},${col}`])) return false;
    if(unit.row===row&&unit.col===col) return true;
    return getAdjacentCoords(unit.row,unit.col).some(([r,c])=>r===row&&c===col);
  }
  function candidateBesiegers(attacker,row,col){
    const ring=getAdjacentCoords(row,col);
    return units.filter(u=>u.faction===attacker&&counts(u)&&!(u.row===row&&u.col===col)&&ring.some(([r,c])=>covers(u,r,c)));
  }
  function castleDefenders(row,col,tile){
    const friendly=units.filter(u=>u.row===row&&u.col===col&&u.faction===tile.faction&&counts(u));
    return {
      outside:friendly.filter(u=>u.castlePosition==='outside'),
      inside:friendly.filter(u=>u.castlePosition!=='outside')
    };
  }
  function siegeConditions(attacker,key,tile){
    const [row,col]=key.split(',').map(Number);
    const ring=getAdjacentCoords(row,col);
    const besiegers=candidateBesiegers(attacker,row,col);
    const covered=ring.map(([r,c])=>({row:r,col:c,covering:besiegers.filter(u=>covers(u,r,c))}));
    const def=castleDefenders(row,col,tile);
    const carried=besiegers.filter(u=>u.isFleet).flatMap(cargoCombat);
    const attackingCount=besiegers.length+carried.length;
    const required=intrinsic(tile)+def.inside.length;
    const portFleetMet=!tile.isPort||besiegers.some(u=>u.isFleet);
    const magicMet=!tile.requiresMagicalSieger||besiegers.some(u=>u.isMagical||u.isEatersOfWisdom||u.isBlackHand);
    return {
      ring,besiegers,carriedCombatUnits:carried,covered,
      outsideDefenders:def.outside,insideDefenders:def.inside,
      fullyEncircled:covered.length===6&&covered.every(h=>h.covering.length),
      attackingCombatUnits:attackingCount,requiredCombatUnits:required,
      portFleetMet,magicalRequirementMet:magicMet,
      legal:intrinsic(tile)>0&&!def.outside.length&&covered.length===6&&covered.every(h=>h.covering.length)&&attackingCount>=required&&portFleetMet&&magicMet
    };
  }
  function breakSiege(tile,key,reason){ if(!tile.siegeState)return; delete tile.siegeState; if(reason)console.log(`[siege] ${key}: ${reason}`); }
  function declareSiege(tile,key,attacker,c){
    tile.siegeIntrinsicDefence=intrinsic(tile);
    tile.siegeState={attackerFaction:attacker,declaredTurn:turnNumber,declaredTurnIndex:currentTurnIndex};
    if(tile.stubstaffVP==null) tile.stubstaffVP=intrinsic(tile)*(tile.isCapital?10:5);
    alert(`${attacker.toUpperCase()} places ${tile.name||key} under siege. ${c.attackingCombatUnits} combat unit(s); ${c.requiredCombatUnits} required.`);
  }
  function subsequent(state){ return turnNumber>state.declaredTurn || (turnNumber===state.declaredTurn&&currentTurnIndex!==state.declaredTurnIndex); }

  const legacyGet=typeof getBesiegedFortresses==='function'?getBesiegedFortresses:null;
  getBesiegedFortresses=function(){
    if(!enabled()) return legacyGet?legacyGet():new Set();
    initialiseCastlePositions();
    const attacker=turnOrder[currentTurnIndex], attackable=new Set();
    for(const [key,tile] of Object.entries(tileData)){
      if(!tile?.isFortress) continue;
      if((tile.fortressStrength||0)<=0){ if(tile.siegeIntrinsicDefence>0)tile.plundered=true; breakSiege(tile,key,'castle plundered'); continue; }
      if(!tile.faction||tile.faction==='none'||tile.faction===attacker){ if(tile.siegeState?.attackerFaction===attacker)breakSiege(tile,key,'castle friendly'); continue; }
      const owner=tile.siegeState?.attackerFaction||attacker;
      const c=siegeConditions(owner,key,tile);
      if(tile.siegeState){
        if(!c.legal){breakSiege(tile,key,c.outsideDefenders.length?'defenders remain outside':'siege conditions lost');continue;}
        if(tile.siegeState.attackerFaction===attacker&&subsequent(tile.siegeState)){
          for(const u of c.besiegers){u.hasMoved=true;u.madeSiegeAttackTurn=turnNumber;}
          attackable.add(key);
        }
      } else if(c.legal) declareSiege(tile,key,attacker,c);
    }
    return attackable;
  };
  window.getDivineRightSiegeConditions=siegeConditions;
  window.setCastlePosition=setCastlePosition;

  // Inside units cannot be attacked in ordinary combat while castle defence remains intact.
  const baseAdjacent=typeof getAdjacentEnemies==='function'?getAdjacentEnemies:null;
  if(baseAdjacent) getAdjacentEnemies=function(unit){
    const coords=baseAdjacent(unit);
    if(!enabled()) return coords;
    return coords.filter(([r,c])=>{
      const t=tileData[`${r},${c}`];
      if(!t?.isFortress||(t.fortressStrength||0)<=0) return true;
      const enemies=units.filter(u=>u.row===r&&u.col===c&&u.faction!==unit.faction&&counts(u));
      return enemies.some(u=>u.castlePosition==='outside');
    });
  };

  function installCastleUi(){
    const hud=document.getElementById('hud'); if(!hud||document.getElementById('castle-position-btn'))return;
    const btn=document.createElement('button'); btn.id='castle-position-btn';btn.style.display='none';hud.appendChild(btn);
    function refresh(){
      const t=selectedUnit&&tileData[`${selectedUnit.row},${selectedUnit.col}`];
      const show=enabled()&&currentPhase==='movement'&&selectedUnit&&t?.isFortress&&selectedUnit.faction===t.faction;
      btn.style.display=show?'inline-block':'none';
      if(show) btn.textContent=selectedUnit.castlePosition==='outside'?'Move Inside Castle':'Move Outside Walls';
    }
    btn.addEventListener('click',()=>{if(!selectedUnit)return;setCastlePosition(selectedUnit,selectedUnit.castlePosition==='outside'?'inside':'outside');drawMap();refresh();});
    svg.addEventListener('click',()=>setTimeout(refresh,0));
  }

  // Mark declarations against besiegers as potential relief attacks.
  const baseAdd=typeof addCombatDeclaration==='function'?addCombatDeclaration:null;
  if(baseAdd) addCombatDeclaration=function(fromHex,targetHex,selectedUnits){
    const d=baseAdd(fromHex,targetHex,selectedUnits); if(!d||!enabled())return d;
    const faction=selectedUnits?.[0]?.faction;
    for(const [key,t] of Object.entries(tileData)){
      if(!t?.siegeState||t.faction!==faction)continue;
      const [cr,cc]=key.split(',').map(Number);
      const targetAdj=getAdjacentCoords(cr,cc).some(([r,c])=>r===targetHex.row&&c===targetHex.col);
      const besiegerHere=units.some(u=>u.row===targetHex.row&&u.col===targetHex.col&&u.faction===t.siegeState.attackerFaction&&counts(u));
      if(targetAdj&&besiegerHere){d.reliefCastleKey=key;break;}
    }
    return d;
  };

  const baseMerge=typeof mergeNextCombatDeclarations==='function'?mergeNextCombatDeclarations:null;
  if(baseMerge) mergeNextCombatDeclarations=function(queue){
    const m=baseMerge(queue); if(m) window.__pendingReliefCastleKey=m.declarations?.find(d=>d.reliefCastleKey)?.reliefCastleKey||null; return m;
  };

  function installCombatWrappers(){
    if(!enabled()||typeof startCombatResolution!=='function'||startCombatResolution.__castleWrapped)return;
    const baseStart=startCombatResolution;
    startCombatResolution=function(){
      const target=declaredCombats[0]?.targetHex;
      const hidden=[];
      if(target){
        const t=tileData[`${target.row},${target.col}`];
        if(t?.isFortress&&(t.fortressStrength||0)>0){
          for(let i=units.length-1;i>=0;i--){const u=units[i];if(u.row===target.row&&u.col===target.col&&u.castlePosition!=='outside'){hidden.push({u,i});units.splice(i,1);}}
        }
      }
      baseStart();
      for(const {u,i} of hidden.sort((a,b)=>a.i-b.i)) units.splice(Math.min(i,units.length),0,u);
      if(window.currentCombat&&window.__pendingReliefCastleKey){window.currentCombat.reliefCastleKey=window.__pendingReliefCastleKey;window.__pendingReliefCastleKey=null;}
      if(hidden.length) drawMap();
    };
    startCombatResolution.__castleWrapped=true;

    if(typeof resolveCurrentCombat==='function'){
      const baseResolve=resolveCurrentCombat;
      resolveCurrentCombat=function(){
        const before=window.currentCombat;
        const originInside=new Map();
        for(const u of before?.attackers||[]){const o=before.attackerOrigins?.get(u)||before.fromHex;const t=o&&tileData[`${o.row},${o.col}`];if(t?.isFortress&&u.castlePosition==='inside')originInside.set(u,`${o.row},${o.col}`);}
        baseResolve();
        // Sortiers which did not advance may remain outside the walls and thereby break the siege.
        const returned=[...originInside.keys()].filter(u=>units.includes(u)&&originInside.get(u)===`${u.row},${u.col}`);
        if(returned.length&&confirm(`${returned.length} surviving sortie unit(s) returned to the castle hex. Leave them OUTSIDE the walls?`)) for(const u of returned)u.castlePosition='outside';

        const reliefKey=before?.reliefCastleKey;
        if(reliefKey){
          const [cr,cc]=reliefKey.split(',').map(Number), castle=tileData[reliefKey];
          const enemy=castle?.siegeState?.attackerFaction;
          const ring=getAdjacentCoords(cr,cc);
          const physicallySurrounded=ring.every(([r,c])=>units.some(u=>u.row===r&&u.col===c&&u.faction===enemy&&counts(u)));
          const target=before.targetHex;
          const targetStillBlocked=units.some(u=>u.row===target.row&&u.col===target.col&&u.faction===enemy&&counts(u));
          const survivors=(before.attackers||[]).filter(u=>units.includes(u));
          if(survivors.length&&(!physicallySurrounded||!targetStillBlocked)&&confirm(`Advance surviving relieving force into ${castle.name||'the besieged castle'}?`)){
            for(const u of survivors){u.row=cr;u.col=cc;u.castlePosition=confirm(`${u.name||u.faction}: go INSIDE the castle walls?`)?'inside':'outside';}
            drawMap();
          }
        }
      };
    }
  }

  setTimeout(()=>{initialiseCastlePositions();installCastleUi();installCombatWrappers();},0);
})();
