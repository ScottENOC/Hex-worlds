// Final Divine Right edge fidelity: Mask of Influence, Talisman of Dispel,
// Special Mercenary Leader imprisonment/deactivation, and Black Knight immortality.
(function(){
  function enabled(){return window.scenarioMeta?.id==='board-game';}
  function d6(){return Math.floor(Math.random()*6)+1;}
  function kingdomOf(u){return u?.originalFaction||u?.usurpedKingdom||u?.faction||null;}
  function isMagicalUnit(u){return !!(u&&(u.isMagical||u.isEatersOfWisdom||u.isBlackHand||u.isGhostRiders||u.isGuardian||u.isTheDead||u.isUndead||u.isColossus||(u.isLeader&&!u.isPrisoner&&u.magicGift==='Sword of Wizardry')));}
  function activeTalismanAt(row,col){return units.some(u=>u?.isLeader&&!u.isPrisoner&&u.row===row&&u.col===col&&u.magicGift==='Talisman of Dispel');}
  window.hexHasActiveTalisman=activeTalismanAt;

  // -------------------------------------------------------------------------
  // Talisman of Dispel
  // -------------------------------------------------------------------------
  // No magical leader/combat unit or magic device has an effect in its hex.
  const priorStrength=window.divineRightEffectiveCombatStrength;
  if(typeof priorStrength==='function') window.divineRightEffectiveCombatStrength=function(side,targetHex){
    if(!enabled()||!activeTalismanAt(targetHex.row,targetHex.col))return priorStrength(side,targetHex);
    let total=0;
    for(const u of (side||[])) if(!isMagicalUnit(u)) total+=Number(u.combatStrength||0);
    // All device-derived combat effects, including the Airboat's CS 1, are inert here.
    return total;
  };

  const priorLeaderBonus=window.getDivineRightCombatLeaderBonus;
  if(typeof priorLeaderBonus==='function') window.getDivineRightCombatLeaderBonus=function(side,targetHex){
    if(!enabled()||!activeTalismanAt(targetHex?.row,targetHex?.col))return priorLeaderBonus(side,targetHex);
    const nonmag=(side||[]).filter(u=>!isMagicalUnit(u)&&u?.magicGift!=='Helm of Wisdom');
    return priorLeaderBonus(nonmag,targetHex);
  };

  // Guard Greystaff's six targeted boons. Greystaff has no effect on a Talisman hex.
  const originalResolveBoon=typeof _resolveBoon==='function'?_resolveBoon:null;
  if(originalResolveBoon) _resolveBoon=function(faction,idx,onDone){
    if(!enabled())return originalResolveBoon(faction,idx,onDone);
    const realPrompt=window.prompt;
    let first=true;
    window.prompt=function(message){
      const answer=realPrompt(message);
      if(answer==null)return answer;
      let protectedHex=null;
      if((idx===0||idx===3)&&first){
        const p=String(answer).trim().split(',').map(Number); if(p.length===2&&!p.some(Number.isNaN))protectedHex={row:p[0],col:p[1]};
      } else if(idx===1&&first){
        const flyers=units.filter(u=>u.isFlying); const n=Number.parseInt(answer,10)-1; const u=flyers[n]; if(u)protectedHex={row:u.row,col:u.col};
      } else if(idx===2&&first){
        const holders=units.filter(u=>u.isLeader&&u.magicGift); const n=Number.parseInt(answer,10)-1; const u=holders[n]; if(u)protectedHex={row:u.row,col:u.col};
      } else if(idx===4&&first){
        const neutral=factionList.filter(f=>controlTypes[f]==='neutral'&&units.some(u=>u.isLeader&&u.faction===f)&&personalityCards[f]!=null); const n=Number.parseInt(answer,10)-1; const f=neutral[n]; const u=units.find(x=>x.isLeader&&x.faction===f); if(u)protectedHex={row:u.row,col:u.col};
      } else if(idx===5&&first){
        const sea=units.filter(u=>{if(!u.isFleet)return false;const t=tileData[`${u.row},${u.col}`];return !!t&&Array.isArray(t.lakes)&&t.lakes.length===6;});
        const keys=[...new Set(sea.map(u=>`${u.row},${u.col}`))]; const n=Number.parseInt(answer,10)-1; if(keys[n]){const [r,c]=keys[n].split(',').map(Number);protectedHex={row:r,col:c};}
      }
      first=false;
      if(protectedHex&&activeTalismanAt(protectedHex.row,protectedHex.col)){
        alert('The Talisman of Dispel protects this hex. Greystaff has no effect there.');
        return null;
      }
      return answer;
    };
    try{return originalResolveBoon(faction,idx,onDone);}finally{window.prompt=realPrompt;}
  };

  // Talisman gives +1 when attacking the Eaters' Enchanted Castle.
  // SiegeResolution reads this hook when calculating the final die modifier.
  window.getTalismanEnchantedCastleSiegeBonus=function(besiegers,row,col){
    if(!enabled())return 0;
    const eaters=units.find(u=>u.isEatersOfWisdom&&u.enchantedCastleActive&&u.row===row&&u.col===col);
    if(!eaters)return 0;
    return (besiegers||[]).some(u=>u?.isLeader&&!u.isPrisoner&&u.magicGift==='Talisman of Dispel')?1:0;
  };

  // -------------------------------------------------------------------------
  // Mask of Influence — the holder can replace the real ambassador for one
  // diplomacy phase, gets +1, and must physically travel to the diplomatic hex.
  // No assassination or ambassador duels are offered through the Mask.
  // -------------------------------------------------------------------------
  function maskHolders(faction){return units.filter(u=>u.isLeader&&!u.isPrisoner&&u.faction===faction&&u.magicGift==='Mask of Influence'&&u.row!=null&&u.col!=null);}
  function castleKingdomAt(row,col){const t=tileData[`${row},${col}`];return t?.isCapital?(t.originalFaction||t.faction):null;}
  function controllerOf(kingdom){
    const t=Object.values(tileData).find(x=>x?.isCapital&&(x.originalFaction||x.faction)===kingdom);
    return t?.allyOf||(t?.faction!==kingdom?t?.faction:null)||null;
  }
  function chooseDiploCard(faction){
    const hand=diplomacyHands[faction]||[]; const cards=hand.filter(c=>c.type!=='specialMerc');
    if(!cards.length)return null;
    const n=Number.parseInt(prompt(`Optional Diplomacy card:\n0. none\n${cards.map((c,i)=>`${i+1}. ${c.label||`+${c.value||0}`}`).join('\n')}`),10);
    if(!(n>0&&n<=cards.length))return null; const card=cards[n-1]; hand.splice(hand.indexOf(card),1); return card;
  }
  function personalityModifier(kingdom,card){
    const p=typeof getPersonalityCard==='function'?getPersonalityCard(kingdom):null;
    let mod=Number(p?.diplomacyBonus||0); if(p?.bribeBonus&&card?.isBribe)mod+=Number(p.bribeBonus||0); return mod;
  }
  function maskDiplomaticRoll(faction,holder,kingdom,need,mode){
    const card=chooseDiploCard(faction); const cardValue=Number(card?.value||0);
    const penalty=typeof getDiplomaticPenaltyModifier==='function'?getDiplomaticPenaltyModifier(faction,kingdom):0;
    const roll=d6(); const total=roll+1+cardValue+personalityModifier(kingdom,card)+penalty;
    alert(`${holder.name||kingdomOf(holder)} uses the Mask of Influence: ${roll} +1 Mask${cardValue?` +${cardValue} card`:''}${penalty?` ${penalty} penalty`:''} = ${total} (need ${need}+).`);
    if(total<need)return false;
    if(mode==='activate'&&typeof formAlliance==='function')formAlliance(faction,kingdom);
    else if(mode==='deactivate'&&typeof deactivateKingdom==='function')deactivateKingdom(kingdom,'Mask of Influence diplomacy');
    return true;
  }
  function maskSpecialMerc(faction,holder,onComplete){
    const hand=diplomacyHands[faction]||[]; const tile=tileData[`${holder.row},${holder.col}`];
    const cards=hand.filter(c=>c.type==='specialMerc').filter(c=>{
      if(c.entryType==='fixed')return c.entryHex===`${holder.row},${holder.col}`;
      if(c.entryType==='friendlyCastle')return !!tile?.isFortress&&(tile.faction===faction||tile.allyOf===faction);
      if(c.entryType==='friendlyPort')return !!tile?.isPort&&(tile.faction===faction||tile.allyOf===faction);
      if(c.entryType==='friendlyNonCastle')return !!tile&&!tile.isFortress&&(tile.faction===faction||tile.allyOf===faction);
      if(c.entryType==='confusedKingdom')return !!tile?.isCapital&&!!tile?.monarchDead;
      return false;
    });
    if(!cards.length){alert('No Special Mercenary in hand can be contacted from the Mask holder’s current hex.');onComplete();return;}
    const n=Number.parseInt(prompt(cards.map((c,i)=>`${i+1}. ${c.label}`).join('\n')),10)-1; const card=cards[n]; if(!card){onComplete();return;}
    hand.splice(hand.indexOf(card),1);
    const realPrompt=window.prompt;
    window.prompt=function(msg){if(/Enter .*hex|Choose a friendly|royal castle hex/i.test(msg))return `${holder.row},${holder.col}`;return realPrompt(msg);};
    try{return handleSpecialMercCard(faction,card,onComplete);}finally{window.prompt=realPrompt;}
  }
  function maskBarbarians(faction,holder,onComplete){
    const realPrompt=window.prompt; let used=false;
    window.prompt=function(msg){if(!used&&/BARBARIAN RECRUITING/i.test(msg)){used=true;return `${holder.row},${holder.col}`;}return realPrompt(msg);};
    try{return handleBarbarianRecruiting(faction,onComplete);}finally{window.prompt=realPrompt;}
  }
  function useMaskDiplomacy(faction,holder,onComplete){
    const kingdom=castleKingdomAt(holder.row,holder.col); const controller=kingdom?controllerOf(kingdom):null;
    const options=[];
    if(kingdom&&neutralFactions.has(kingdom))options.push({id:'activate',label:`Activate ${kingdom} (6+)`});
    if(kingdom&&controller&&controller!==faction)options.push({id:'deactivate',label:`Deactivate ${kingdom} (7+)`});
    options.push({id:'merc',label:'Bring in Special Mercenary at this hex'});
    options.push({id:'barb',label:'Raise Barbarians at this hex'});
    options.push({id:'none',label:'Do nothing'});
    const n=Number.parseInt(prompt(`MASK OF INFLUENCE — ${holder.name||kingdomOf(holder)}\n${options.map((o,i)=>`${i+1}. ${o.label}`).join('\n')}`),10)-1;
    const action=options[n]; if(!action||action.id==='none'){onComplete();return;}
    if(action.id==='activate'){maskDiplomaticRoll(faction,holder,kingdom,6,'activate');onComplete();return;}
    if(action.id==='deactivate'){maskDiplomaticRoll(faction,holder,kingdom,7,'deactivate');onComplete();return;}
    if(action.id==='merc')return maskSpecialMerc(faction,holder,onComplete);
    if(action.id==='barb')return maskBarbarians(faction,holder,onComplete);
  }

  // -------------------------------------------------------------------------
  // Special Mercenary Leader prisoner/death rules.
  // -------------------------------------------------------------------------
  window.diplomacyDiscardPile=window.diplomacyDiscardPile||[];
  window.setAsideDiplomacyCards=window.setAsideDiplomacyCards||[];
  function mercTypeOf(unit){
    for(const [type,list] of Object.entries(specialMercPool||{}))if((list||[]).includes(unit)||(list||[]).some(x=>x.id&&x.id===unit.id))return type;
    return null;
  }
  function cardForMerc(unit){const type=mercTypeOf(unit);return (typeof DIPLO_CARD_TEMPLATES!=='undefined'?DIPLO_CARD_TEMPLATES:[]).find(c=>c.type==='specialMerc'&&c.mercType===type)||null;}
  function removeLeaderFromMap(unit){const i=units.indexOf(unit);if(i>=0)units.splice(i,1);unit.row=null;unit.col=null;unit.isPrisoner=false;delete unit.capturedBy;delete unit.prisonCastleKey;}
  function retireMercLeader(unit,mode){
    const card=cardForMerc(unit); removeLeaderFromMap(unit);
    if(mode==='deactivate'){
      unit.faction=null; unit.specialMercDeactivated=true; if(card)window.diplomacyDiscardPile.push({...card});
    }else{
      unit.specialMercEliminated=true; if(card)window.setAsideDiplomacyCards.push({...card});
    }
  }
  function prisonMercLeader(unit,captor){
    // Reuse the existing prison placement, then undo monarch VP/state side effects by doing our own placement.
    const castles=Object.entries(tileData).filter(([,t])=>t?.isFortress&&(t.faction===captor||t.allyOf===captor)&&!t.siegeState&&!t.plundered&&(t.fortressStrength||0)>0);
    const prison=castles[0]||null; unit.isPrisoner=true;unit.capturedBy=captor;unit.capturedOriginalController=unit.faction;unit.specialMercForcedPeaceUsed=false;unit.hasMoved=true;
    if(prison){unit.prisonCastleKey=prison[0];const [r,c]=prison[0].split(',').map(Number);unit.row=r;unit.col=c;}else{unit.prisonCastleKey=null;unit.row=null;unit.col=null;}
  }

  const baseFate=typeof fateDieRoll==='function'?fateDieRoll:null;
  if(baseFate) fateDieRoll=function(unit){
    if(!enabled()||!unit?.isLeader||!unit.isSpecialMerc||unit.isPrisoner)return baseFate.apply(this,arguments);
    if(unit.hasTakenAFateDieRoll)return; unit.hasTakenAFateDieRoll=true;
    const roll=d6(); const captor=turnOrder[currentTurnIndex]&&turnOrder[currentTurnIndex]!==unit.faction?turnOrder[currentTurnIndex]:null;
    alert(`Leader fate die roll for ${unit.name||'Special Mercenary Leader'}: ${roll}`);
    if(roll===1){
      if(unit.isBlackKnight){unit.blackKnightDisabled=true;unit.combatDieBonus=0;unit.canLeadWhileDisabled=false;alert('The Black Knight is struck down but cannot die. He loses leadership and combat bonus until restored at Stubstaff Keep.');}
      else if(unit.isUsurper){if(typeof deactivateUsurper==='function')deactivateUsurper(unit.usurpedKingdom);else retireMercLeader(unit,'killed');}
      else retireMercLeader(unit,'killed');
    }else if(roll===6){
      if(unit.isUsurper){alert('The captured Usurper is automatically executed.');if(typeof deactivateUsurper==='function')deactivateUsurper(unit.usurpedKingdom);else retireMercLeader(unit,'killed');}
      else prisonMercLeader(unit,captor);
    }
    drawMap();
  };

  function restoreBlackKnightIfEligible(faction){
    const knight=units.find(u=>u.isBlackKnight&&u.faction===faction&&u.blackKnightDisabled); if(!knight)return;
    const t=tileData[`${knight.row},${knight.col}`]; if(!t?.isStubstaffKeep||t.plundered)return;
    knight.blackKnightDisabled=false;knight.combatDieBonus=1;delete knight.canLeadWhileDisabled;alert('The Black Knight returns to Stubstaff Keep and the Stubstaff restores his powers.');
  }

  function specialPrisonerAction(faction,onComplete){
    const prisoners=units.filter(u=>u.isLeader&&u.isSpecialMerc&&!u.isUsurper&&u.isPrisoner&&u.capturedBy===faction);
    if(!prisoners.length)return false;
    const n=Number.parseInt(prompt(`Captured Special Mercenary Leader:\n${prisoners.map((u,i)=>`${i+1}. ${u.name}`).join('\n')}\n0. continue normal diplomacy`),10)-1;
    const p=prisoners[n]; if(!p)return false;
    const action=Number.parseInt(prompt('1. Forced Peace roll (one attempt only)\n2. Execute prisoner\n3. Release prisoner\n0. none'),10);
    if(action===1){
      if(p.specialMercForcedPeaceUsed){alert('The one permitted Forced Peace roll has already been attempted for this prisoner.');onComplete();return true;}
      p.specialMercForcedPeaceUsed=true; const roll=d6();
      if(roll<=4){alert(`${p.name} deactivates on ${roll}; the counter leaves play and its Diplomacy card returns to the discard pile.`);retireMercLeader(p,'deactivate');}
      else{const key=p.prisonCastleKey;p.isPrisoner=false;p.faction=faction;p.capturedBy=null;p.specialMercForcedPeaceUsed=false;if(key){const [r,c]=key.split(',').map(Number);p.row=r;p.col=c;}alert(`${p.name} joins ${faction.toUpperCase()} on ${roll}.`);}
      onComplete();return true;
    }
    if(action===2){alert(`${p.name} is executed. No VP and no diplomatic penalty.`);retireMercLeader(p,'killed');onComplete();return true;}
    if(action===3){p.isPrisoner=false;p.capturedBy=null;const old=p.capturedOriginalController||p.faction;p.faction=old;delete p.capturedOriginalController;alert(`${p.name} is released.`);onComplete();return true;}
    return false;
  }

  // Apply Mask and special-prisoner actions before the legacy/advanced diplomacy menu.
  const baseDiplo=typeof handleDiploPlayPhase==='function'?handleDiploPlayPhase:null;
  if(baseDiplo) handleDiploPlayPhase=function(faction,onComplete){
    if(!enabled())return baseDiplo(faction,onComplete);
    if(specialPrisonerAction(faction,onComplete))return;
    const holders=maskHolders(faction);
    if(holders.length&&controlTypes[faction]!=='cpu'){
      const use=confirm(`Use ${holders[0].name||kingdomOf(holders[0])}'s Mask of Influence instead of the real ambassador this diplomacy phase?`);
      if(use)return useMaskDiplomacy(faction,holders[0],onComplete);
    }
    return baseDiplo(faction,onComplete);
  };

  // Black Knight rejuvenation occurs after he ends his own side's turn at the Keep.
  const baseEnd=typeof endTurn==='function'?endTurn:null;
  if(baseEnd) endTurn=function(){const f=turnOrder[currentTurnIndex];restoreBlackKnightIfEligible(f);return baseEnd.apply(this,arguments);};

  window.isTalismanProtectedHex=activeTalismanAt;
  window.maskHolders=maskHolders;
  window.retireSpecialMercLeader=retireMercLeader;
})();
