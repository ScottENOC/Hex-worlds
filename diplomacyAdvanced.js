// Advanced Divine Right diplomacy actions: deactivation, assassination, duels and forced peace.
(function () {
  function enabled() { return window.scenarioMeta?.id === 'board-game'; }
  function d6() { return Math.floor(Math.random() * 6) + 1; }
  function kingdomOf(unit) { return unit?.originalFaction || unit?.faction || null; }

  function playerMonarch(faction) {
    return units.find(u => u.faction === faction && u.isLeader && (!u.originalFaction || u.originalFaction === faction)) ||
      units.find(u => u.faction === faction && u.isLeader) || null;
  }
  function metaForFaction(faction) {
    const monarch = playerMonarch(faction);
    if (!monarch) return null;
    if (!monarch.diplomacyMeta) monarch.diplomacyMeta = {};
    return monarch.diplomacyMeta;
  }
  function ambassadorUnavailable(faction) {
    const meta = metaForFaction(faction);
    return !!meta && meta.deadUntilTurn != null && turnNumber < meta.deadUntilTurn;
  }
  function killAmbassador(faction) {
    const meta = metaForFaction(faction);
    if (meta) meta.deadUntilTurn = turnNumber + 3;
    if (!ambassadorStatus[faction]) ambassadorStatus[faction] = {};
    ambassadorStatus[faction].deadUntilTurn = turnNumber + 3;
  }

  function kingdomCastleTiles(kingdom) {
    return Object.entries(tileData).filter(([,t]) => (t.originalFaction || t.faction) === kingdom && t.isFortress);
  }
  function kingdomController(kingdom) {
    for (const [,t] of kingdomCastleTiles(kingdom)) if (t.allyOf) return t.allyOf;
    const unit = units.find(u => u.originalFaction === kingdom && u.faction && u.faction !== kingdom);
    return unit?.faction || null;
  }
  function enemyAlliedKingdoms(faction) {
    const result = new Set();
    for (const [key,t] of Object.entries(tileData)) {
      if (!t?.isFortress) continue;
      const kingdom = t.originalFaction;
      if (kingdom && t.allyOf && t.allyOf !== faction) result.add(kingdom);
    }
    return [...result];
  }
  function findKingdomMonarch(kingdom) {
    return units.find(u => u.isLeader && (u.originalFaction === kingdom || (u.faction === kingdom && !u.originalFaction))) || null;
  }

  function deactivateKingdom(kingdom, reason = 'diplomacy') {
    const oldController = kingdomController(kingdom);
    if (!oldController) return false;
    for (const unit of units) {
      if ((unit.originalFaction || unit.faction) !== kingdom || unit.isMercenary || unit.isSpecialMerc) continue;
      unit.originalFaction = unit.originalFaction || kingdom;
      unit.faction = kingdom;
      unit.deactivated = true;
      unit.deactivatedReason = reason;
      unit.row = null; unit.col = null; unit.hasMoved = true;
    }
    for (const [,tile] of kingdomCastleTiles(kingdom)) {
      tile.originalFaction = tile.originalFaction || kingdom;
      tile.faction = kingdom;
      delete tile.allyOf;
    }
    neutralFactions.add(kingdom);
    return true;
  }

  const baseFormAlliance = typeof formAlliance === 'function' ? formAlliance : null;
  if (baseFormAlliance) {
    formAlliance = function (faction, kingdom) {
      const castle = kingdomCastleTiles(kingdom)[0]?.[1];
      if (castle?.forcedPeaceUntil && turnNumber < castle.forcedPeaceUntil) {
        alert(`${kingdom.toUpperCase()} is under Forced Peace until turn ${castle.forcedPeaceUntil}.`);
        return;
      }
      if (castle?.monarchDead) {
        alert(`${kingdom.toUpperCase()} is in confusion after the monarch's death and cannot be normally activated.`);
        return;
      }
      baseFormAlliance(faction, kingdom);
      for (const unit of units) {
        if (!unit.deactivated || unit.originalFaction !== kingdom) continue;
        unit.faction = faction;
        unit.deactivated = false;
        if (Array.isArray(unit.startCoords)) {
          unit.row = unit.startCoords[0]; unit.col = unit.startCoords[1];
        }
        unit.hasMoved = true;
      }
      neutralFactions.delete(kingdom);
    };
  }

  function chooseCard(faction) {
    const hand = diplomacyHands[faction] || [];
    const cards = hand.filter(c => c.type !== 'specialMerc');
    if (!cards.length) return null;
    const menu = cards.map((c,i)=>`${i+1}. ${c.label || `+${c.value || 0}`}`).join('\n');
    const n = Number.parseInt(prompt(`Play one Diplomacy card? 0 = none\n${menu}`),10);
    if (!(n > 0 && n <= cards.length)) return null;
    const card = cards[n-1]; hand.splice(hand.indexOf(card),1); return card;
  }
  function cardModifier(card, kingdom) {
    if (!card) return 0;
    let mod = Number(card.value || 0);
    const p = typeof getPersonalityCard === 'function' ? getPersonalityCard(kingdom) : null;
    mod += Number(p?.diplomacyBonus || 0);
    if (p?.bribeBonus && /bribe/i.test(card.label || card.type || '')) mod += Number(p.bribeBonus || 0);
    return mod;
  }

  function attemptDeactivation(faction, onComplete) {
    const targets = enemyAlliedKingdoms(faction).filter(k => !isAmbassadorBanned(faction,k));
    if (!targets.length) { alert('No enemy-allied non-player kingdom is available for deactivation.'); onComplete(); return; }
    const raw = prompt(`Deactivate which enemy ally?\n${targets.join(', ')}`);
    const kingdom = targets.find(k => k.toLowerCase() === String(raw||'').trim().toLowerCase());
    if (!kingdom) { onComplete(); return; }
    const card = chooseCard(faction);
    const roll = d6(); const total = roll + cardModifier(card, kingdom);
    if (total >= 7) {
      deactivateKingdom(kingdom, 'diplomatic deactivation');
      alert(`${kingdom.toUpperCase()} deactivates! Roll ${roll}${total!==roll?` → ${total}`:''} (need 7+). Its surviving regular forces leave the map after this turn.`);
    } else {
      alert(`${kingdom.toUpperCase()} stays allied. Roll ${roll}${total!==roll?` → ${total}`:''} (need 7+).`);
    }
    onComplete();
  }

  function attemptAssassination(faction, onComplete) {
    const meta = metaForFaction(faction);
    if (meta?.assassinationUsed) { alert('Your ambassador has already made the once-per-game assassination attempt.'); onComplete(); return; }
    const targets = enemyAlliedKingdoms(faction).filter(k => !isAmbassadorBanned(faction,k));
    if (!targets.length) { alert('No enemy-allied monarch is available to assassinate.'); onComplete(); return; }
    const raw = prompt(`Assassinate which enemy-allied monarch?\n${targets.join(', ')}`);
    const kingdom = targets.find(k => k.toLowerCase() === String(raw||'').trim().toLowerCase());
    if (!kingdom) { onComplete(); return; }
    meta.assassinationUsed = true;
    const a = d6(), m = d6();
    if (a > m) {
      const monarch = findKingdomMonarch(kingdom);
      if (monarch) { const i=units.indexOf(monarch); if(i>=0) units.splice(i,1); }
      for (const [,t] of kingdomCastleTiles(kingdom)) t.monarchDead = true;
      deactivateKingdom(kingdom, 'assassination');
      alert(`Assassination succeeds: ambassador ${a}, monarch ${m}. ${kingdom.toUpperCase()} deactivates; no victory points are scored.`);
    } else {
      if (a < m) killAmbassador(faction);
      banAmbassador(faction, kingdom);
      alert(a < m ? `Assassination fails: ${a} vs ${m}. Your ambassador is killed and successors are permanently banished from ${kingdom}.` : `Assassination ties ${a}-${m}. Nobody dies, but your ambassador is permanently banished from ${kingdom}.`);
    }
    onComplete();
  }

  function duelAmbassador(faction, onComplete) {
    const meta = metaForFaction(faction);
    const duelled = new Set(meta?.duelledWith || []);
    const targets = Object.keys(controlTypes).filter(f => f !== faction && controlTypes[f] !== 'neutral' && !duelled.has(f) && !ambassadorUnavailable(f));
    if (!targets.length) { alert('No eligible enemy ambassador remains to duel.'); onComplete(); return; }
    const raw = prompt(`Duel which ambassador?\n${targets.join(', ')}`);
    const target = targets.find(f => f.toLowerCase() === String(raw||'').trim().toLowerCase());
    if (!target) { onComplete(); return; }
    meta.duelledWith = [...duelled, target];
    const other = metaForFaction(target); if (other) other.duelledWith = [...new Set([...(other.duelledWith||[]), faction])];
    const a=d6(), b=d6();
    if (a < b) killAmbassador(faction); else if (b < a) killAmbassador(target); else { killAmbassador(faction); killAmbassador(target); }
    alert(a===b ? `Ambassador duel ties ${a}-${b}: both ambassadors are killed.` : `${a>b?faction:target} wins the ambassador duel ${Math.max(a,b)}-${Math.min(a,b)}; ${a>b?target:faction}'s ambassador is killed.`);
    onComplete();
  }

  function forcedPeaceTargets(faction) {
    const out=[];
    for (const [key,t] of Object.entries(tileData)) {
      if (!t?.isCapital || !t.plundered || !t.originalFaction) continue;
      const kingdom=t.originalFaction, controller=kingdomController(kingdom);
      if (!controller || controller===faction) continue;
      const [row,col]=key.split(',').map(Number);
      const occupied=units.some(u=>u.faction===faction && !u.isLeader && (u.combatStrength||0)>0 && u.row===row && u.col===col);
      if (occupied) out.push({key,tile:t,kingdom});
    }
    return out;
  }
  function attemptForcedPeace(faction, onComplete) {
    const targets=forcedPeaceTargets(faction);
    if (!targets.length) { alert('You occupy no plundered enemy-allied royal castle eligible for Forced Peace.'); onComplete(); return; }
    const raw=prompt(`Forced Peace against which kingdom?\n${targets.map(x=>x.kingdom).join(', ')}`);
    const target=targets.find(x=>x.kingdom.toLowerCase()===String(raw||'').trim().toLowerCase());
    if(!target){onComplete();return;}
    const roll=d6(); const need=target.tile.contestedLastTurn ? 6 : 5;
    if(roll>=need){
      const duration=d6(); deactivateKingdom(target.kingdom,'forced peace');
      for(const [,t] of kingdomCastleTiles(target.kingdom)) t.forcedPeaceUntil=turnNumber+duration;
      alert(`${target.kingdom.toUpperCase()} enters Forced Peace for ${duration} full game turn(s). Roll ${roll} (needed ${need}+).`);
    } else alert(`Forced Peace fails: roll ${roll}, needed ${need}+.`);
    onComplete();
  }

  const baseGetNeutralKingdoms = typeof getNeutralKingdoms === 'function' ? getNeutralKingdoms : null;
  if (baseGetNeutralKingdoms) getNeutralKingdoms = function(){
    return baseGetNeutralKingdoms().filter(k => {
      const castle=kingdomCastleTiles(k)[0]?.[1];
      return !(castle?.forcedPeaceUntil && turnNumber < castle.forcedPeaceUntil) && !castle?.monarchDead;
    });
  };

  const baseHandle = typeof handleDiploPlayPhase === 'function' ? handleDiploPlayPhase : null;
  if (baseHandle) handleDiploPlayPhase = function(faction,onComplete){
    if(!enabled()) return baseHandle(faction,onComplete);
    if(ambassadorUnavailable(faction)) { alert(`${faction.toUpperCase()}'s ambassador is dead; no diplomacy may be conducted this turn.`); onComplete(); return; }
    const advancedAvailable = enemyAlliedKingdoms(faction).length || Object.keys(controlTypes).some(f=>f!==faction&&controlTypes[f]!=='neutral') || forcedPeaceTargets(faction).length;
    if(!advancedAvailable) return baseHandle(faction,onComplete);
    const choice=Number.parseInt(prompt(
      `${faction.toUpperCase()} — DIPLOMACY ACTION\n1. Standard diplomacy / mercenaries / barbarians\n2. Deactivate enemy-allied monarch (7+)\n3. Assassinate enemy-allied monarch (once per game)\n4. Duel enemy ambassador\n5. Forced Peace\n\nEnter number:`
    ),10);
    if(choice===2) return attemptDeactivation(faction,onComplete);
    if(choice===3) return attemptAssassination(faction,onComplete);
    if(choice===4) return duelAmbassador(faction,onComplete);
    if(choice===5) return attemptForcedPeace(faction,onComplete);
    return baseHandle(faction,onComplete);
  };

  window.deactivateKingdom = deactivateKingdom;
  window.enemyAlliedKingdoms = enemyAlliedKingdoms;
  window.attemptForcedPeace = attemptForcedPeace;
})();
