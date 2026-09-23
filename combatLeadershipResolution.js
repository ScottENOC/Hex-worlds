// Final combat resolver layer for verified leader/special-unit Combat Roll effects.
(function () {
  function enabled(){ return window.scenarioMeta?.id === 'board-game'; }
  function rule(name,fallback=false){ const r=window.scenarioRules||{}; return r[name]!=null?!!r[name]:fallback; }
  function restoreOrigins(attackers,map,fromHex){
    for(const u of attackers){ if(!units.includes(u)) continue; const h=map?.get?.(u)||fromHex; if(h){u.row=h.row;u.col=h.col;} }
  }
  function chooseAdvance(attackers,faction,target,origins){
    const eligible=attackers.filter(u=>units.includes(u)&&(!u.isLeader||u.isEatersOfWisdom));
    if(!eligible.length) return [];
    if(controlTypes[faction]==='cpu') return eligible;
    if(typeof parseAdvanceSelection!=='function') return confirm('Advance all surviving attackers?')?eligible:[];
    const menu=eligible.map((u,i)=>`${i+1}. ${u.name||u.originalFaction||u.faction}`).join('\n');
    const raw=prompt(`Advance after combat into (${target.row},${target.col})?\n${menu}\n\nEnter all, none, or unit numbers:`);
    if(raw===null||/^\s*(none|0)\s*$/i.test(raw)) return [];
    if(/^\s*(all|a)\s*$/i.test(raw)) return eligible;
    return parseAdvanceSelection(raw,eligible.length).map(i=>eligible[i]).filter(Boolean);
  }

  const legacy=typeof resolveCurrentCombat==='function'?resolveCurrentCombat:null;
  resolveCurrentCombat=function(){
    if(!enabled()||!window.currentCombat) return legacy?.apply(this,arguments);
    const {attackers,defenders,fromHex,targetHex}=window.currentCombat;
    const attackerOrigins=window.currentCombat.attackerOrigins||new Map((attackers||[]).map(u=>[u,fromHex]));
    if(!attackers?.length) return legacy?.apply(this,arguments);

    const attackerFaction=attackers[0]?.faction;
    const defenderFaction=defenders[0]?.faction;

    if(typeof canAttackGhostRiders==='function'&&!canAttackGhostRiders(attackers,defenders)){
      alert('Only magical units may attack the Ghost Riders of Khos. The attack is cancelled.');
      restoreOrigins(attackers,attackerOrigins,fromHex);
      document.getElementById('combat-panel').style.display='none';
      startCombatResolution();
      return;
    }
    if(typeof wanderingMusicBlocksAttack==='function'&&wanderingMusicBlocksAttack(defenders)){
      alert('The Wandering People Troop plays its entrancing music. The attackers are entranced and the attack is cancelled.');
      for(const u of attackers) u.hasMoved=true;
      restoreOrigins(attackers,attackerOrigins,fromHex);
      document.getElementById('combat-panel').style.display='none';
      startCombatResolution();
      return;
    }

    const tile=tileData[`${targetHex.row},${targetHex.col}`];
    const terrainList=Array.isArray(tile?.terrain)?tile.terrain:[tile?.terrain];
    const eater=defenders.find(u=>u.isEatersOfWisdom);
    if(eater&&units.some(u=>u.row===targetHex.row&&u.col===targetHex.col&&u.faction!==eater.faction&&(u.combatStrength||0)>0)) eater.combatStrength=0;

    let as=attackers.reduce((s,u)=>s+(u.combatStrength||0),0);
    let ds=defenders.reduce((s,u)=>s+(u.combatStrength||0),0);
    if(terrainList.includes('mountain_pass')) ds*=2;
    if(typeof getEnchantedCastleBonus==='function') ds*=getEnchantedCastleBonus(targetHex.row,targetHex.col);
    let ab=0,db=0;
    if(as>ds&&ds>0) ab=Math.floor(as/ds)-1;
    else if(ds>as&&as>0){db=Math.floor(ds/as)-1;if(db===0)db=1;}
    if(terrainList.includes('mountain')) db+=1;

    const aLeader=typeof getDivineRightCombatLeaderBonus==='function'?getDivineRightCombatLeaderBonus(attackers,targetHex):0;
    const dLeader=typeof getDivineRightCombatLeaderBonus==='function'?getDivineRightCombatLeaderBonus(defenders,targetHex):0;
    const aSleep=units.some(u=>u.isLeader&&u.faction===attackerFaction&&u.templeSleep)?-1:0;
    const dSleep=units.some(u=>u.isLeader&&u.faction===defenderFaction&&u.templeSleep)?-1:0;
    const aFright=typeof getIsleOfFrightPenalty==='function'?getIsleOfFrightPenalty(attackerFaction):0;
    const dFright=typeof getIsleOfFrightPenalty==='function'?getIsleOfFrightPenalty(defenderFaction):0;
    const ar=Math.floor(Math.random()*6)+1, dr=Math.floor(Math.random()*6)+1;
    const at=ar+ab+aLeader+aSleep+aFright, dt=dr+db+dLeader+dSleep+dFright;
    let al=0,dl=0,result;
    if(at>dt){dl=at-dt;result=`<p>Attackers win! Defenders lose ${dl} unit(s).</p>`;}
    else if(dt>at){al=dt-at;result=`<p>Defenders win! Attackers lose ${al} unit(s).</p>`;}
    else{al=dl=at;result=`<p>Tie! Both sides lose ${al} unit(s).</p>`;}

    const lossHexes=new Set();
    for(let i=0;i<dl;i++){
      const u=typeof chooseCombatCasualty==='function'?chooseCombatCasualty(defenders,defenderFaction,`${defenderFaction||'Defender'} defence`):defenders.find(x=>!x.isLeader&&units.includes(x));
      if(!u)break;lossHexes.add(`${u.row},${u.col}`);removeUnit(u);const j=defenders.indexOf(u);if(j>=0)defenders.splice(j,1);
    }
    for(let i=0;i<al;i++){
      const u=typeof chooseCombatCasualty==='function'?chooseCombatCasualty(attackers,attackerFaction,`${attackerFaction||'Attacker'} attack`):attackers.find(x=>!x.isLeader&&units.includes(x));
      if(!u)break;lossHexes.add(`${u.row},${u.col}`);removeUnit(u);const j=attackers.indexOf(u);if(j>=0)attackers.splice(j,1);
    }
    for(const key of lossHexes){const [r,c]=key.split(',').map(Number);for(const l of units.filter(u=>u.isLeader&&u.row===r&&u.col===c))fateDieRoll(l);}
    if(eater&&eater.combatStrength===0)eater.combatStrength=eater.baseCombatStrength||2;

    restoreOrigins(attackers,attackerOrigins,fromHex);
    const liveDef=defenders.filter(u=>!u.isLeader||u.isEatersOfWisdom);
    if(!liveDef.length&&attackers.length){
      for(const l of defenders.filter(u=>u.isLeader&&!u.isEatersOfWisdom)) fateDieRoll(l);
      const advancing=rule('optionalAdvanceAfterCombat',false)?chooseAdvance(attackers,attackerFaction,targetHex,attackerOrigins):[...attackers];
      for(const u of advancing)if(units.includes(u)){u.row=targetHex.row;u.col=targetHex.col;}
      result+=`<p>${advancing.length} attacker${advancing.length===1?'':'s'} advanced.</p>`;
    }

    document.getElementById('combat-info').innerHTML=`
      <p><strong>Combat Result</strong></p>
      <p>Attacker: ${ar}${ab?` +${ab} ratio`:''}${aLeader?` +${aLeader} leader`:''} = ${at}</p>
      <p>Defender: ${dr}${db?` +${db} terrain/ratio`:''}${dLeader?` +${dLeader} leader`:''} = ${dt}</p>${result}`;
    document.getElementById('resolve-button').style.display='none';
    document.getElementById('continue-button').style.display='inline';
  };
})();
