// Remaining well-specified Divine Right magic-device, flying-unit, Urmoff and Usurper rules.
(function () {
  function enabled() { return window.scenarioMeta?.id === 'board-game'; }
  function d6() { return Math.floor(Math.random() * 6) + 1; }
  function kingdomOf(u) { return u?.originalFaction || u?.usurpedKingdom || u?.faction || null; }
  function unitName(u) { return u?.name || kingdomOf(u) || u?.faction || 'unit'; }

  // ---------------------------------------------------------------------------
  // Wandering People gifts: real movable/capturable devices rather than labels.
  // ---------------------------------------------------------------------------
  const WP_GIFTS = ['Flying Carpet', 'Spinning Wheel', 'Guiding Light'];

  function normalizeGiftRecords() {
    for (const tile of Object.values(tileData)) {
      if (!Array.isArray(tile?.wanderingPeopleGifts) || tile.wanderingGiftRecords) continue;
      const owner = tile.wanderingGiftOwner || tile.allyOf || tile.faction || tile.originalFaction || null;
      tile.wanderingGiftRecords = tile.wanderingPeopleGifts.map(name => ({ name, ownerFaction: owner }));
      delete tile.wanderingPeopleGifts;
    }
  }
  function looseGiftsAt(row, col) {
    const tile = tileData[`${row},${col}`];
    normalizeGiftRecords();
    return tile?.wanderingGiftRecords || [];
  }
  function carriedGifts(unit) {
    if (!unit) return [];
    if (!Array.isArray(unit.wanderingGiftRecords)) unit.wanderingGiftRecords = [];
    return unit.wanderingGiftRecords;
  }
  function unitHasDevice(unit, name) {
    if (!unit || unit.isPrisoner) return false;
    if (unit.magicGift === name) return true; // Temple gift
    return carriedGifts(unit).some(g => g.name === name);
  }
  function factionOwnsWanderingGift(faction, name) {
    normalizeGiftRecords();
    for (const tile of Object.values(tileData)) {
      if ((tile.wanderingGiftRecords || []).some(g => g.name === name && g.ownerFaction === faction)) return true;
    }
    return units.some(u => carriedGifts(u).some(g => g.name === name && g.ownerFaction === faction));
  }
  function transferLooseGiftToUnit(row, col, giftName, unit) {
    const tile = tileData[`${row},${col}`];
    normalizeGiftRecords();
    const list = tile?.wanderingGiftRecords || [];
    const idx = list.findIndex(g => g.name === giftName);
    if (idx < 0 || !unit) return false;
    const [gift] = list.splice(idx, 1);
    carriedGifts(unit).push(gift);
    return true;
  }
  function dropGift(unit, giftName) {
    const list = carriedGifts(unit);
    const idx = list.findIndex(g => g.name === giftName);
    if (idx < 0 || unit.row == null || unit.col == null) return false;
    const [gift] = list.splice(idx, 1);
    const tile = tileData[`${unit.row},${unit.col}`];
    if (!tile.wanderingGiftRecords) tile.wanderingGiftRecords = [];
    tile.wanderingGiftRecords.push(gift);
    return true;
  }
  function captureLooseGifts(unit) {
    if (!unit || unit.isLeader || (unit.combatStrength || 0) <= 0 || unit.row == null) return [];
    const list = looseGiftsAt(unit.row, unit.col);
    if (!list.length) return [];
    const hostile = list.some(g => g.ownerFaction && g.ownerFaction !== unit.faction);
    if (!hostile) return [];
    const captured = list.splice(0, list.length);
    for (const gift of captured) gift.ownerFaction = unit.faction;
    carriedGifts(unit).push(...captured);
    if (captured.length) alert(`${unit.faction.toUpperCase()} captures ${captured.map(g => g.name).join(', ')}.`);
    return captured;
  }
  function transferCarrierGiftsOnDefeat(leader, victorFaction, deathHex) {
    const gifts = carriedGifts(leader).splice(0);
    if (!gifts.length) return;
    if (victorFaction) {
      const receiver = units.find(u => u.faction === victorFaction && u.row === deathHex?.row && u.col === deathHex?.col && ((u.combatStrength || 0) > 0 || u.isLeader));
      if (receiver) {
        for (const g of gifts) g.ownerFaction = victorFaction;
        carriedGifts(receiver).push(...gifts);
        return;
      }
    }
    if (deathHex) {
      const tile = tileData[`${deathHex.row},${deathHex.col}`];
      if (tile) {
        if (!tile.wanderingGiftRecords) tile.wanderingGiftRecords = [];
        tile.wanderingGiftRecords.push(...gifts);
      }
    }
  }

  function installDeviceButton() {
    const hud = document.getElementById('hud');
    if (!hud || document.getElementById('device-button')) return;
    const btn = document.createElement('button');
    btn.id = 'device-button'; btn.textContent = 'Devices';
    btn.addEventListener('click', () => {
      if (!enabled()) return;
      const faction = turnOrder[currentTurnIndex];
      normalizeGiftRecords();
      const localUnits = units.filter(u => u.faction === faction && u.row != null && u.col != null && (u.isLeader || (u.combatStrength || 0) > 0));
      const loose = [];
      for (const [key,t] of Object.entries(tileData)) for (const g of (t.wanderingGiftRecords || [])) if ((t.faction === faction || t.allyOf === faction || g.ownerFaction === faction)) loose.push({ key, gift:g });
      const carriers = localUnits.filter(u => carriedGifts(u).length);
      const choice = Number.parseInt(prompt('MAGIC DEVICES\n1. Pick up device\n2. Transfer device between co-located friendly units\n3. Drop device\n0. Close'),10);
      if (choice === 1 && loose.length) {
        const text = loose.map((x,i)=>`${i+1}. ${x.gift.name} at ${x.key}`).join('\n');
        const gi = Number.parseInt(prompt(text),10)-1; const item=loose[gi]; if(!item)return;
        const [r,c]=item.key.split(',').map(Number);
        const eligible=localUnits.filter(u=>u.row===r&&u.col===c);
        if(!eligible.length){alert('No friendly leader/combat unit is present to carry it.');return;}
        const ui=Number.parseInt(prompt(eligible.map((u,i)=>`${i+1}. ${unitName(u)}`).join('\n')),10)-1;
        if(eligible[ui] && transferLooseGiftToUnit(r,c,item.gift.name,eligible[ui])) alert(`${eligible[ui].name||eligible[ui].faction} takes ${item.gift.name}.`);
      } else if (choice === 2 && carriers.length) {
        const from=carriers[Number.parseInt(prompt(carriers.map((u,i)=>`${i+1}. ${unitName(u)}: ${carriedGifts(u).map(g=>g.name).join(', ')}`).join('\n')),10)-1];
        if(!from)return; const gifts=carriedGifts(from); const gift=gifts[Number.parseInt(prompt(gifts.map((g,i)=>`${i+1}. ${g.name}`).join('\n')),10)-1]; if(!gift)return;
        const targets=localUnits.filter(u=>u!==from&&u.row===from.row&&u.col===from.col); if(!targets.length){alert('No co-located friendly unit can receive it.');return;}
        const to=targets[Number.parseInt(prompt(targets.map((u,i)=>`${i+1}. ${unitName(u)}`).join('\n')),10)-1]; if(!to)return;
        gifts.splice(gifts.indexOf(gift),1); carriedGifts(to).push(gift); alert(`${gift.name} transferred to ${unitName(to)}.`);
      } else if (choice === 3 && carriers.length) {
        const from=carriers[Number.parseInt(prompt(carriers.map((u,i)=>`${i+1}. ${unitName(u)}: ${carriedGifts(u).map(g=>g.name).join(', ')}`).join('\n')),10)-1];
        if(!from)return; const gifts=carriedGifts(from); const gift=gifts[Number.parseInt(prompt(gifts.map((g,i)=>`${i+1}. ${g.name}`).join('\n')),10)-1]; if(gift&&dropGift(from,gift.name))alert(`${gift.name} left at (${from.row},${from.col}).`);
      }
      drawMap();
    });
    hud.appendChild(btn);
  }

  // Spinning Wheel: +1 mercenary whenever mercenaries are recruited by Random Event.
  const baseReserveDeploy = typeof handleReserveDeployment === 'function' ? handleReserveDeployment : null;
  if (baseReserveDeploy) handleReserveDeployment = function (numUnits, allowRegulars, allowMercenaries, onComplete) {
    const faction = turnOrder[currentTurnIndex];
    const extra = enabled() && currentPhase === 'event' && allowMercenaries && !allowRegulars && factionOwnsWanderingGift(faction,'Spinning Wheel') ? 1 : 0;
    if (extra) alert('Spinning Wheel: recruit one additional mercenary.');
    return baseReserveDeploy(numUnits + extra, allowRegulars, allowMercenaries, onComplete);
  };

  // ---------------------------------------------------------------------------
  // Flying movement. In flight: 1 MP/hex, ignore surface stacks/terrain; enemy
  // flying combat units block passage. Order/Carpet must land at move end.
  // ---------------------------------------------------------------------------
  function isPerpetualFlyer(u) { return !!(u?.isHamahara || u?.isGhostRiders || u?.airboatActive); }
  function isFlyingMover(u) { return !!u && (u.isFlying || u.flyingCarpetActive || u.airboatActive); }
  function enemyFlyerAt(r,c,faction) { return units.some(u=>u.row===r&&u.col===c&&u.faction!==faction&&isFlyingMover(u)&&u.airborne!==false&&(u.combatStrength||0)>0); }
  function friendlyFleetAt(r,c,faction) { return units.some(u=>u.row===r&&u.col===c&&u.faction===faction&&u.isFleet); }
  function isSeaTile(t){ return Array.isArray(t?.lakes) && t.lakes.length>=6; }
  function flyingDestAllowed(unit,r,c){
    const t=tileData[`${r},${c}`]; if(!t)return false;
    if(unit.isGhostRiders && (t.isFortress || units.some(u=>u!==unit&&u.row===r&&u.col===c)))return false;
    const mustLand=!!(unit.mustLand || unit.flyingCarpetActive);
    if(mustLand){
      if(isSeaTile(t) && !friendlyFleetAt(r,c,unit.faction))return false;
      if(units.some(u=>u.row===r&&u.col===c&&u.faction!==unit.faction&&(u.combatStrength||0)>0))return false;
    }
    return !enemyFlyerAt(r,c,unit.faction);
  }
  function flyingMoves(unit){
    const allowance=Math.max(0,Number(unit.moveSpeed||0));
    const start=`${unit.row},${unit.col}`; const q=[[unit.row,unit.col,0]]; const seen=new Set([start]); const out=[];
    while(q.length){const [r,c,d]=q.shift(); if(d>=allowance)continue;
      for(const [rr,cc] of getAdjacentCoords(r,c)){
        const key=`${rr},${cc}`; if(seen.has(key)||!tileData[key]||enemyFlyerAt(rr,cc,unit.faction))continue;
        seen.add(key); q.push([rr,cc,d+1]); if(flyingDestAllowed(unit,rr,cc))out.push([rr,cc]);
      }
    }
    return out;
  }
  const baseValidMoves = typeof validMoves === 'function' ? validMoves : null;
  if (baseValidMoves) validMoves = function(unit){
    if(!enabled()||!unit)return baseValidMoves(unit);
    if(unit.isLeader && unitHasDevice(unit,'Guiding Light')){
      const old=unit.forestWalk; unit.forestWalk=true; try{return baseValidMoves(unit);} finally{unit.forestWalk=old;}
    }
    if(isFlyingMover(unit)) return flyingMoves(unit);
    return baseValidMoves(unit);
  };

  function refreshFlyingStates(faction){
    for(const u of units){
      if(u.faction!==faction)continue;
      if(u.isHamahara||u.isGhostRiders||u.airboatActive)u.airborne=true;
      if(u.mustLand)u.airborne=false;
      if(u.isUrmoff)u.submerged=true;
    }
  }

  // Surface units cannot select an otherwise-empty airborne enemy as a target;
  // surface fleets cannot attack submerged Urmoff.
  const baseAdjacentEnemies = typeof getAdjacentEnemies === 'function' ? getAdjacentEnemies : null;
  if(baseAdjacentEnemies) getAdjacentEnemies=function(unit){
    return baseAdjacentEnemies(unit).filter(([r,c])=>{
      const enemies=units.filter(u=>u.row===r&&u.col===c&&u.faction!==unit.faction);
      if(!enemies.length)return false;
      if(unit.isFleet&&!unit.isFlying && enemies.every(u=>u.isUrmoff&&u.submerged))return false;
      if(!isFlyingMover(unit) && enemies.every(u=>isFlyingMover(u)&&u.airborne!==false))return false;
      return true;
    });
  };

  // Urmoff dives instead of making an adjacent retreat when possible.
  const baseRetreat = typeof attemptRetreatBeforeCombat === 'function' ? attemptRetreatBeforeCombat : null;
  if(baseRetreat) attemptRetreatBeforeCombat=function(defenders,targetHex){
    if(enabled()&&defenders?.length===1&&defenders[0].isUrmoff&&!defenders[0].submerged){
      const roll=d6(); if(roll>=3){defenders[0].submerged=true;alert(`Urmoff dives beneath the surface (roll ${roll}, needed 3+).`);return true;}
      alert(`Urmoff fails to dive (roll ${roll}, needed 3+).`); return false;
    }
    const flyers=(defenders||[]).filter(isFlyingMover);
    if(enabled()&&flyers.length===defenders.length&&flyers.length){
      const attackingAir=window.currentCombat?.attackers?.some(isFlyingMover) || false;
      if(!attackingAir){
        const threshold=Math.max(...flyers.map(u=>typeof getRetreatThreshold==='function'?getRetreatThreshold(u):3));
        const roll=d6();
        if(roll>=threshold){for(const u of flyers)u.airborne=true;alert(`Flying defenders retreat into the air (roll ${roll}, needed ${threshold}+).`);return true;}
        alert(`Flying defenders fail to retreat (roll ${roll}, needed ${threshold}+).`);return false;
      }
    }
    return baseRetreat(defenders,targetHex);
  };

  // ---------------------------------------------------------------------------
  // Temple gift effects represented by the current magicGift field.
  // ---------------------------------------------------------------------------
  const baseLeaderBonus=window.getDivineRightCombatLeaderBonus;
  if(typeof baseLeaderBonus==='function') window.getDivineRightCombatLeaderBonus=function(side,target){
    let bonus=baseLeaderBonus(side,target);
    if((side||[]).some(u=>u.isLeader&&!u.isPrisoner&&u.magicGift==='Helm of Wisdom')) bonus=Math.max(bonus,1);
    return bonus;
  };
  const baseRetreatThreshold=typeof getRetreatThreshold==='function'?getRetreatThreshold:null;
  if(baseRetreatThreshold) getRetreatThreshold=function(unit){
    if(enabled()&&unit?.isLeader&&!unit.isPrisoner&&unit.magicGift==='Sword of Wizardry')return 2;
    return baseRetreatThreshold(unit);
  };
  function stackHasHealingWand(side){return (side||[]).some(u=>u.isLeader&&!u.isPrisoner&&u.magicGift==='Wand of Healing');}
  function activeTalismanAt(row,col){return units.some(u=>u.row===row&&u.col===col&&u.isLeader&&!u.isPrisoner&&u.magicGift==='Talisman of Dispel');}

  // ---------------------------------------------------------------------------
  // Usurper full entry: confused kingdom only, half regulars, inherits dynasty
  // leader traits, receives an unused Personality card, #13 ends entry at once.
  // ---------------------------------------------------------------------------
  function confusedKingdoms(){
    const out=[];
    for(const [key,t] of Object.entries(tileData)) if(t?.isCapital&&t.monarchDead&&(!t.confusionUntilTurn||turnNumber<t.confusionUntilTurn)) out.push({kingdom:t.originalFaction||t.faction,key,tile:t});
    return out;
  }
  function randomUnusedPersonality(){
    const used=new Set(Object.values(personalityCards).map(Number));
    const ids=Object.keys(PERSONALITY_CARDS).map(Number).filter(id=>!used.has(id));
    return ids.length?ids[Math.floor(Math.random()*ids.length)]:null;
  }
  function deployUsurperRegulars(faction,kingdom){
    const dormant=units.filter(u=>u.originalFaction===kingdom&&!u.isLeader&&!u.isMercenary&&!u.isSpecialMerc&&(u.neutralDormant||u.row==null));
    for(let i=dormant.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[dormant[i],dormant[j]]=[dormant[j],dormant[i]];}
    const chosen=dormant.slice(0,Math.ceil(dormant.length/2));
    for(const u of chosen){u.faction=faction;u.neutralDormant=false;u.usurperFollower=true;u.usurpedKingdom=kingdom;u.hasMoved=false;
      const [r,c]=u.startCoords||[]; if(r!=null&&!units.some(x=>x.row===r&&x.col===c&&x.faction!==faction&&(x.combatStrength||0)>0)){u.row=r;u.col=c;} else {
        const alt=(r!=null?getAdjacentCoords(r,c):[]).find(([rr,cc])=>{const t=tileData[`${rr},${cc}`];return t&&(t.originalFaction||t.faction)===kingdom&&!units.some(x=>x.row===rr&&x.col===cc&&x.faction!==faction&&(x.combatStrength||0)>0);});
        if(alt){u.row=alt[0];u.col=alt[1];}else{u.row=null;u.col=null;u.activationDeferred=true;}
      }
    }
    return chosen;
  }
  function enterUsurper(faction,card,onComplete){
    const pool=specialMercPool.usurper||[]; const usurper=pool.find(u=>u.faction==null);
    if(!usurper){alert('The Usurper is already in play.');onComplete();return;}
    const targets=confusedKingdoms(); if(!targets.length){alert('No kingdom is currently in confusion.');onComplete();return;}
    const n=Number.parseInt(prompt(`Install the Usurper in which confused kingdom?\n${targets.map((x,i)=>`${i+1}. ${x.kingdom}`).join('\n')}`),10)-1; const target=targets[n]; if(!target){onComplete();return;}
    const [r,c]=target.key.split(',').map(Number); if(units.some(u=>u.row===r&&u.col===c&&u.faction!==faction&&(u.combatStrength||0)>0)){alert('The Royal Castle is enemy-occupied.');onComplete();return;}
    usurper.faction=faction;usurper.row=r;usurper.col=c;usurper.hasMoved=false;usurper.usurpedKingdom=target.kingdom;usurper.originalFaction=target.kingdom;usurper.isMonarch=false;
    const traits=target.tile.lastMonarchTraits||{}; for(const k of ['moveSpeed','forestWalk','mountainWalk','riverWalk','waterWalk']) if(traits[k]!=null)usurper[k]=traits[k];
    const pid=randomUnusedPersonality();usurper.usurperPersonalityId=pid;
    if(pid!=null){const p=PERSONALITY_CARDS[pid]||{};if(p.combatDieBonus)usurper.combatDieBonus=p.combatDieBonus;if(p.monarchCantLeave)usurper.monarchCantLeave=true;}
    units.push(usurper); const followers=deployUsurperRegulars(faction,target.kingdom);
    target.tile.usurperController=faction;target.tile.usurperActive=true;
    if(pid===13){alert('The Usurper draws Personality #13 and deactivates immediately.');deactivateUsurper(target.kingdom);onComplete();return;}
    alert(`The Usurper takes ${target.kingdom.toUpperCase()} with ${followers.length} regular unit(s) and Personality #${pid ?? '?'}.`);drawMap();onComplete();
  }
  function deactivateUsurper(kingdom){
    for(const u of [...units]) if(u.isUsurper&&u.usurpedKingdom===kingdom || u.usurperFollower&&u.usurpedKingdom===kingdom){const i=units.indexOf(u);if(i>=0)units.splice(i,1); if(u.isUsurper){u.faction=null;u.row=null;u.col=null;u.usurpedKingdom=null;}}
    const rc=Object.entries(tileData).find(([,t])=>t?.isCapital&&(t.originalFaction||t.faction)===kingdom); if(rc){delete rc[1].usurperActive;delete rc[1].usurperController;rc[1].monarchDead=false;delete rc[1].confusionUntilTurn;}
    neutralFactions.add(kingdom);
  }
  const baseSpecial=typeof handleSpecialMercCard==='function'?handleSpecialMercCard:null;
  if(baseSpecial) handleSpecialMercCard=function(faction,card,onComplete){
    if(enabled()&&card?.mercType==='usurper')return enterUsurper(faction,card,onComplete);
    return baseSpecial(faction,card,()=>{normalizeGiftRecords();if(card?.mercType==='wanderingPeople')for(const t of Object.values(tileData))if(t.wanderingGiftRecords)for(const g of t.wanderingGiftRecords)if(!g.ownerFaction)g.ownerFaction=faction;
      for(const u of units.filter(u=>u.faction===faction)){if(u.isUrmoff)u.submerged=true;if(u.isHamahara||u.isGhostRiders)u.airborne=true;if(u.isOrderHippogriff)u.airborne=false;}onComplete();});
  };

  // Preserve monarch traits before the death resolver removes the counter.
  const baseDeath=window.resolveMonarchDeath;
  if(typeof baseDeath==='function') window.resolveMonarchDeath=function(unit,scorer,opts){
    const k=kingdomOf(unit); const rc=Object.entries(tileData).find(([,t])=>t?.isCapital&&(t.originalFaction||t.faction)===k);
    if(rc&&unit)rc[1].lastMonarchTraits={moveSpeed:unit.moveSpeed,forestWalk:!!unit.forestWalk,mountainWalk:!!unit.mountainWalk,riverWalk:!!unit.riverWalk,waterWalk:!!unit.waterWalk};
    const hex={row:unit?.row,col:unit?.col}; transferCarrierGiftsOnDefeat(unit,scorer,hex); return baseDeath(unit,scorer,opts);
  };
  const baseCapture=window.resolveMonarchCapture;
  if(typeof baseCapture==='function') window.resolveMonarchCapture=function(unit,scorer){const hex={row:unit?.row,col:unit?.col};transferCarrierGiftsOnDefeat(unit,scorer,hex);return baseCapture(unit,scorer);};

  // Start-of-turn refresh for submerged/perpetual-flight states.
  const baseEvent=typeof handleEventPhase==='function'?handleEventPhase:null;
  if(baseEvent) handleEventPhase=function(faction){if(enabled())refreshFlyingStates(faction);return baseEvent.apply(this,arguments);};

  // Post-move capture of loose devices and landing state.
  if(typeof svg!=='undefined'&&svg?.addEventListener&&svg.dataset.magicSpecialMove!=='1'){
    svg.dataset.magicSpecialMove='1';
    svg.addEventListener('click',event=>{
      if(!enabled()||currentPhase!=='movement'||!selectedUnit)return; const mover=selectedUnit; const text=event.target?.dataset?.hex;if(!text)return; const [r,c]=text.split(',').map(Number);
      if(!validMoves(mover).some(([rr,cc])=>rr===r&&cc===c))return;
      setTimeout(()=>{if(mover.row===r&&mover.col===c){captureLooseGifts(mover);if(mover.mustLand||mover.flyingCarpetActive)mover.airborne=false;else if(isPerpetualFlyer(mover))mover.airborne=true;}},0);
    },true);
  }

  normalizeGiftRecords(); installDeviceButton();

  window.unitHasMagicDevice=unitHasDevice;
  window.factionOwnsWanderingGift=factionOwnsWanderingGift;
  window.stackHasHealingWand=stackHasHealingWand;
  window.hexHasActiveTalisman=activeTalismanAt;
  window.captureLooseMagicGifts=captureLooseGifts;
  window.deactivateUsurper=deactivateUsurper;
  window.isDivineRightFlyingUnit=isFlyingMover;
})();
