// Final edge-rule hooks that need to run after the other fidelity layers.
(function(){
  function enabled(){return window.scenarioMeta?.id==='board-game';}
  function d6(){return Math.floor(Math.random()*6)+1;}
  function kingdomOf(u){return u?.originalFaction||u?.usurpedKingdom||u?.faction||null;}
  function isMagic(u){return !!(u?.isMagical||u?.isEatersOfWisdom||u?.isBlackHand||u?.isGhostRiders||(u?.isLeader&&!u?.isPrisoner&&u?.magicGift==='Sword of Wizardry'));}

  // Keep device-derived movement flags synchronized at the point validMoves is asked.
  const baseValid=typeof validMoves==='function'?validMoves:null;
  if(baseValid) validMoves=function(unit){
    if(enabled()&&unit?.isLeader){
      unit.airboatActive=unit.magicGift==='Airboat of Armera';
      unit.flyingCarpetActive=typeof unitHasMagicDevice==='function'&&unitHasMagicDevice(unit,'Flying Carpet');
    }
    const moves=baseValid(unit);
    if(!enabled()||!unit)return moves;
    if(unit.isUsurper)return moves.filter(([r,c])=>!tileData[`${r},${c}`]?.isTempleOfKings);
    return moves;
  };

  function declaredAttackers(targetHex){
    const out=[];
    for(const decl of (declaredCombats||[])){
      if(decl.targetHex?.row!==targetHex.row||decl.targetHex?.col!==targetHex.col)continue;
      const stack=units.filter(u=>u.row===decl.fromHex?.row&&u.col===decl.fromHex?.col);
      const chosen=Array.isArray(decl.unitIds)&&decl.unitIds.length?stack.filter(u=>decl.unitIds.includes(u.combatId)):stack;
      out.push(...chosen);
    }
    return [...new Set(out)];
  }

  // Ghost Rider fright prevents retreat by nonmagical target stacks. Also feed
  // the declared air attackers into the flying-retreat layer before currentCombat exists.
  const baseRetreat=typeof attemptRetreatBeforeCombat==='function'?attemptRetreatBeforeCombat:null;
  if(baseRetreat) attemptRetreatBeforeCombat=function(defenders,targetHex){
    if(!enabled())return baseRetreat(defenders,targetHex);
    const attackers=declaredAttackers(targetHex);
    if(attackers.some(u=>u.isGhostRiders)&&defenders.some(u=>!isMagic(u))){
      alert('Ghost Riders paralyse the stack with fright; retreat before combat is impossible.');
      return false;
    }
    const prior=window.currentCombat;
    if(!prior)window.currentCombat={attackers};
    try{return baseRetreat(defenders,targetHex);}finally{if(!prior)delete window.currentCombat;}
  };

  // Usurper diplomacy is uniquely an unmodified 6 and consumes the diplomacy action.
  const baseDiplo=typeof handleDiploPlayPhase==='function'?handleDiploPlayPhase:null;
  if(baseDiplo) handleDiploPlayPhase=function(faction,onComplete){
    if(!enabled())return baseDiplo(faction,onComplete);
    const targets=units.filter(u=>u.isUsurper&&u.faction&&u.faction!==faction&&u.usurpedKingdom);
    if(targets.length&&controlTypes[faction]!=='cpu'){
      const yes=confirm(`Attempt to deactivate an enemy Usurper instead of normal diplomacy?\nNeeds an unmodified 6.`);
      if(yes){
        const target=targets.length===1?targets[0]:targets[Number.parseInt(prompt(targets.map((u,i)=>`${i+1}. ${u.usurpedKingdom}`).join('\n')),10)-1];
        if(!target){onComplete();return;}
        const roll=d6();
        if(roll===6){alert(`Usurper deactivation succeeds on ${roll}.`);if(typeof deactivateUsurper==='function')deactivateUsurper(target.usurpedKingdom);}
        else alert(`Usurper remains in power: ${roll} (needs 6).`);
        onComplete();return;
      }
    }
    return baseDiplo(faction,onComplete);
  };

  // Exact Temple core: monarchs only; one Temple gift maximum; sleeping rulers
  // may be rescued or murdered by another monarch, and that helper forfeits its Test.
  runTempleOfKingsTests=function(faction){
    if(!enabled())return;
    const templeEntry=Object.entries(tileData).find(([,t])=>t?.isTempleOfKings);if(!templeEntry)return;
    const [key]=templeEntry;const [tr,tc]=key.split(',').map(Number);
    const acting=units.filter(u=>u.isLeader&&!u.isSpecialMerc&&!u.isUsurper&&!u.isEatersOfWisdom&&u.faction===faction&&u.row===tr&&u.col===tc);
    const sleepers=()=>units.filter(u=>u.isLeader&&u.templeSleep&&u.row===tr&&u.col===tc);
    for(const monarch of acting){
      if(monarch.templeSleep)continue;
      let spent=false;
      const sleeping=sleepers().filter(u=>u!==monarch);
      if(sleeping.length){
        const friendly=sleeping.filter(u=>u.faction===faction);
        const enemy=sleeping.filter(u=>u.faction!==faction);
        if(friendly.length&&confirm(`${monarch.name||kingdomOf(monarch)} may rescue a sleeping friendly monarch instead of taking the Test. Rescue?`)){
          const target=friendly[0];target.templeSleep=false;target.templeRescuedTurn=turnNumber;spent=true;alert(`${target.name||kingdomOf(target)} is rescued from enchanted sleep.`);
        }else if(enemy.length&&confirm(`${monarch.name||kingdomOf(monarch)} may murder a sleeping enemy monarch instead of taking the Test. Murder?`)){
          const target=enemy[0];if(typeof resolveMonarchDeath==='function')resolveMonarchDeath(target,null,{noVictoryPoints:true,cause:'temple murder'});else{const i=units.indexOf(target);if(i>=0)units.splice(i,1);}spent=true;alert('The sleeping monarch is murdered. No VP or diplomatic penalty is awarded.');
        }
      }
      if(spent)continue;
      if(monarch.templeEntryTurn!==undefined&&monarch.templeEntryTurn!==turnNumber&&!monarch.templeActedLastVisit){
        if(typeof resolveMonarchDeath==='function')resolveMonarchDeath(monarch,null,{noVictoryPoints:true,cause:'dream of paradise'});continue;
      }
      monarch.templeEntryTurn=turnNumber;monarch.templeActedLastVisit=true;
      const roll=d6();
      if(roll===1){if(typeof resolveMonarchDeath==='function')resolveMonarchDeath(monarch,null,{noVictoryPoints:true,cause:'Test of Gods'});else{const i=units.indexOf(monarch);if(i>=0)units.splice(i,1);}alert('Test of the Gods: 1 — instant death.');}
      else if(roll===6){monarch.templeSleep=true;alert('Test of the Gods: 6 — enchanted sleep.');}
      else if(monarch.magicGift){alert(`Test of the Gods: ${roll} — a gift is offered, but this monarch already holds a Temple gift.`);}
      else{
        const gifts=['Helm of Wisdom','Airboat of Armera','Talisman of Dispel','Mask of Influence','Wand of Healing','Sword of Wizardry'];
        const available=gifts.filter(g=>!units.some(u=>u.magicGift===g));
        if(!available.length)alert(`Test of the Gods: ${roll} — no Temple gifts remain.`);
        else{const gift=available[Math.floor(Math.random()*available.length)];monarch.magicGift=gift;alert(`Test of the Gods: ${roll} — ${gift} is granted.`);}
      }
    }
  };
})();
