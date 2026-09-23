// Divine Right leader, personality, activation and selected special-unit fidelity.
(function () {
  function enabled() { return window.scenarioMeta?.id === 'board-game'; }
  function d6() { return Math.floor(Math.random() * 6) + 1; }
  function kingdomOf(u) { return u?.originalFaction || u?.faction || null; }

  // -----------------------------------------------------------------------
  // Personality deck
  // -----------------------------------------------------------------------
  // Keep all twenty numbered cards unique in the draw pool. We encode only
  // effects confirmed by the rules/card references rather than inventing text
  // for cards whose printed effect is not represented elsewhere in the engine.
  const KNOWN_PERSONALITIES = {
    2:  { name:'Cowardly' },
    9:  { name:'Hot-Tempered' },
    11: { name:'Avaricious', bribeBonus:1, crassBribeImmunity:true,
          desc:'Bribes and Crass Bribes receive +1; a failed Crass Bribe does not banish the ambassador.' },
    13: { name:'Cursed Monarch', cursedMonarch:true,
          desc:'If this personality is newly assigned through the relevant special rules, the kingdom deactivates immediately.' },
    14: { name:'Personality #14', originDiplomacy:true,
          desc:'Diplomacy receives +1 if the card’s kingdom of origin is in the acting alliance, or -1 if it is in another alliance.' },
    15: { name:'Loyal', immuneToDiplomaticDeactivation:true,
          desc:'Once activated, only death can deactivate this monarch.' },
    16: { name:'Personality #16', combatDieBonus:1,
          desc:'May lead eligible regulars and grant +1 to one land Combat Roll.' },
    17: { name:'Castle-Bound Monarch', monarchCantLeave:true,
          desc:'The monarch cannot leave the royal castle.' }
  };

  function completePersonalityDeck() {
    if (typeof PERSONALITY_CARDS === 'undefined') return;
    for (let id = 1; id <= 20; id++) {
      const known = KNOWN_PERSONALITIES[id] || {};
      const existing = PERSONALITY_CARDS[id] || {};
      PERSONALITY_CARDS[id] = {
        id,
        name: known.name || existing.name || `Personality #${id}`,
        desc: known.desc || existing.desc || 'No additional engine-side modifier is encoded for this card.',
        ...existing,
        ...known,
      };
    }
  }

  function personalityForLeader(leader) {
    const kingdom = kingdomOf(leader);
    return kingdom && typeof getPersonalityCard === 'function' ? getPersonalityCard(kingdom) : null;
  }

  // -----------------------------------------------------------------------
  // Leader movement and combat bonuses
  // -----------------------------------------------------------------------
  function leaderMayLeadUnit(leader, unit) {
    if (!leader || !unit || unit === leader || unit.hasMoved || unit.isFleet) return false;
    if (unit.faction !== leader.faction) return false;
    if (leader.isJuulute && unit.isBarbarian) return true;
    if (leader.isSpecialMerc) return !!unit.isMercenary || !!unit.isSpecialMerc || !!unit.isBarbarian;
    const leaderKingdom = kingdomOf(leader);
    return !!unit.isMercenary || kingdomOf(unit) === leaderKingdom;
  }

  function leaderCombatBonus(side, targetHex) {
    const candidates = (side || []).filter(u => u?.isLeader && !u.isPrisoner);
    let best = 0;
    const hasFleet = (side || []).some(u => u?.isFleet);
    for (const leader of candidates) {
      let bonus = Number(leader.combatDieBonus || 0);
      if (leader.navalCombatDieBonus && hasFleet) bonus = Math.max(bonus, Number(leader.navalCombatDieBonus || 0));
      const p = personalityForLeader(leader);
      bonus = Math.max(bonus, Number(p?.combatDieBonus || 0));
      if (!bonus) continue;
      const eligibleRegular = (side || []).some(u => !u.isLeader && leaderMayLeadUnit({ ...leader, faction: leader.faction }, { ...u, hasMoved:false }));
      if (eligibleRegular || leader.isSpecialMerc) best = Math.max(best, bonus);
    }
    return best; // Basic rules: only one hero per side supplies a bonus.
  }

  function chooseFollowers(leader) {
    const local = units.filter(u => u.row === leader.row && u.col === leader.col && leaderMayLeadUnit(leader, u));
    if (!local.length) return [];
    if (controlTypes[leader.faction] === 'cpu') return local;
    const menu = local.map((u,i)=>`${i+1}. ${u.name || kingdomOf(u) || 'unit'} (move ${u.moveSpeed || 0})`).join('\n');
    const raw = prompt(`Move units with ${leader.name || kingdomOf(leader) || 'leader'} at the leader’s movement rate?\n${menu}\n\nEnter all, none, or numbers:`);
    if (raw === null || /^\s*(none|0)\s*$/i.test(raw)) return [];
    if (!raw.trim() || /^\s*(all|a)\s*$/i.test(raw)) return local;
    const indexes = new Set(raw.split(/[\s,]+/).map(x=>Number.parseInt(x,10)-1).filter(i=>i>=0&&i<local.length));
    return [...indexes].map(i=>local[i]);
  }

  function installLeaderMoveHandler() {
    if (typeof svg === 'undefined' || !svg?.addEventListener || svg.dataset.leaderMoveFidelity === '1') return;
    svg.dataset.leaderMoveFidelity = '1';
    svg.addEventListener('click', event => {
      if (!enabled() || currentPhase !== 'movement' || !selectedUnit?.isLeader || selectedUnit.hasMoved) return;
      const text = event.target?.dataset?.hex;
      if (!text) return;
      const [row,col] = text.split(',').map(Number);
      if (!validMoves(selectedUnit).some(([r,c])=>r===row&&c===col)) return;

      const p = personalityForLeader(selectedUnit);
      const startTile = tileData[`${selectedUnit.row},${selectedUnit.col}`];
      if (p?.monarchCantLeave && startTile?.isCapital && (startTile.originalFaction || startTile.faction) === kingdomOf(selectedUnit)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        alert(`${selectedUnit.name || kingdomOf(selectedUnit)} is castle-bound and cannot leave the royal castle.`);
        return;
      }

      // Let lone leaders use the legacy handler. Intercept only when a stack is
      // actually moving at the leader's rate.
      const followers = chooseFollowers(selectedUnit);
      if (!followers.length) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
      const leader = selectedUnit;
      for (const u of [leader, ...followers]) { u.row=row; u.col=col; u.hasMoved=true; u.movedWithLeaderTurn=turnNumber; }
      selectedUnit = null;
      highlightedTilesByType.movement = [];
      drawMap();
      showHexInfo(row,col);
    }, true);
  }

  // -----------------------------------------------------------------------
  // Inactive kingdoms and violated activation placement
  // -----------------------------------------------------------------------
  function royalCastle(kingdom) {
    return Object.entries(tileData).find(([,t]) => t?.isCapital && (t.originalFaction || t.faction) === kingdom) || null;
  }
  function tileBelongsToKingdom(row,col,kingdom) {
    const t=tileData[`${row},${col}`];
    return !!t && (t.originalFaction || t.faction) === kingdom;
  }
  function enemyCombatAt(row,col,controller) {
    return units.some(u=>u.row===row&&u.col===col&&u.faction!==controller&&!u.isLeader&&(u.combatStrength||0)>0);
  }
  function legalActivationHexes(unit, controller, kingdom) {
    if (!Array.isArray(unit.startCoords)) return [];
    const [r,c]=unit.startCoords;
    if (!enemyCombatAt(r,c,controller)) return [[r,c]];
    return getAdjacentCoords(r,c).filter(([rr,cc]) => tileBelongsToKingdom(rr,cc,kingdom) && !enemyCombatAt(rr,cc,controller));
  }
  function deployActivatedKingdom(controller, kingdom) {
    const dormant = units.filter(u => u.neutralDormant && u.originalFaction === kingdom);
    for (const u of dormant) {
      u.faction = controller;
      let choices;
      if (u.isLeader) {
        const rc=royalCastle(kingdom);
        choices=rc ? [rc[0].split(',').map(Number)] : legalActivationHexes(u,controller,kingdom);
        if (choices[0] && enemyCombatAt(choices[0][0],choices[0][1],controller)) choices=legalActivationHexes(u,controller,kingdom);
      } else choices=legalActivationHexes(u,controller,kingdom);
      if (choices.length) {
        [u.row,u.col]=choices[0];
        u.activationDeferred=false;
      } else {
        u.row=null; u.col=null; u.activationDeferred=true;
      }
      u.neutralDormant=false;
      u.hasMoved=true;
      u.activatedTurn=turnNumber;
      u.cannotAttackUntilTurn=turnNumber+1;
    }
  }
  function prepareInactiveKingdoms() {
    if (!enabled()) return;
    for (const u of units) {
      const k=u.faction;
      if (!neutralFactions.has(k) || u.isMercenary || u.isSpecialMerc || u.isBarbarian || u.isEatersOfWisdom || u.isBlackHand) continue;
      u.originalFaction=u.originalFaction||k;
      u.neutralDormant=true;
      u.row=null; u.col=null; u.hasMoved=true;
    }
    for (const t of Object.values(tileData)) {
      if (t?.faction && neutralFactions.has(t.faction)) t.originalFaction=t.originalFaction||t.faction;
    }
  }
  function retryDeferredDeployments(faction) {
    for (const u of units.filter(u=>u.faction===faction&&u.activationDeferred)) {
      const choices=legalActivationHexes(u,faction,u.originalFaction);
      if (!choices.length) continue;
      [u.row,u.col]=choices[0]; u.activationDeferred=false; u.hasMoved=true;
    }
  }

  const baseInitGame = typeof initGame === 'function' ? initGame : null;
  if (baseInitGame) initGame = function(opts){ prepareInactiveKingdoms(); const out=baseInitGame(opts); return out; };

  const baseFormAlliance = typeof formAlliance === 'function' ? formAlliance : null;
  if (baseFormAlliance) formAlliance = function(faction, kingdom) {
    const result=baseFormAlliance(faction,kingdom);
    const p=typeof getPersonalityCard==='function'?getPersonalityCard(kingdom):null;
    if (p?.cursedMonarch && typeof window.deactivateKingdom==='function') {
      window.deactivateKingdom(kingdom,'cursed personality');
      return result;
    }
    deployActivatedKingdom(faction,kingdom);
    neutralFactions.delete(kingdom);
    return result;
  };

  // Units of a kingdom just activated may not attack until the next game turn.
  const baseAdjacentEnemies = typeof getAdjacentEnemies === 'function' ? getAdjacentEnemies : null;
  if (baseAdjacentEnemies) getAdjacentEnemies = function(unit) {
    if (unit?.cannotAttackUntilTurn != null && turnNumber < unit.cannotAttackUntilTurn) return [];
    return baseAdjacentEnemies(unit);
  };

  // -----------------------------------------------------------------------
  // Withdrawal grace after a realm becomes neutral.
  // -----------------------------------------------------------------------
  function markNeutralWithdrawalGrace(kingdom) {
    for (const u of units) {
      if (u.row==null || u.col==null || u.faction===kingdom || neutralFactions.has(u.faction)) continue;
      if (!tileBelongsToKingdom(u.row,u.col,kingdom)) continue;
      u.withdrawNeutralKingdom=kingdom;
      u.withdrawGraceFaction=u.faction;
      u.withdrawGraceUntilOwnTurn=true;
    }
  }
  function enforceWithdrawalGrace(faction) {
    for (const u of units.filter(u=>u.withdrawGraceFaction===faction&&u.withdrawGraceUntilOwnTurn)) {
      const kingdom=u.withdrawNeutralKingdom;
      if (!tileBelongsToKingdom(u.row,u.col,kingdom)) { delete u.withdrawNeutralKingdom; delete u.withdrawGraceFaction; delete u.withdrawGraceUntilOwnTurn; continue; }
      // The unit now has this friendly Movement Phase to leave. Mark it so the
      // movement click hook can distinguish this grace from a fresh violation.
      u.withdrawGraceActiveTurn=turnNumber;
    }
  }
  function finishWithdrawalGrace(faction) {
    for (const u of units.filter(u=>u.withdrawGraceFaction===faction&&u.withdrawGraceActiveTurn===turnNumber)) {
      const kingdom=u.withdrawNeutralKingdom;
      if (tileBelongsToKingdom(u.row,u.col,kingdom) && typeof recordBorderViolation==='function') recordBorderViolation(faction,kingdom);
      delete u.withdrawNeutralKingdom; delete u.withdrawGraceFaction; delete u.withdrawGraceUntilOwnTurn; delete u.withdrawGraceActiveTurn;
    }
  }

  // -----------------------------------------------------------------------
  // Ghost Riders / Wandering People / curses
  // -----------------------------------------------------------------------
  function canAttackGhostRiders(attackerUnits, defenders) {
    if (!defenders?.some(u=>u.isGhostRiders)) return true;
    return (attackerUnits||[]).some(u=>u.isMagical || u.isEatersOfWisdom || u.isBlackHand);
  }
  function wanderingMusicBlocksAttack(defenders, randomFn=Math.random) {
    if (!defenders?.some(u=>u.isWanderingTroop || u.entrancinMusic || u.entrancingMusic)) return false;
    return Math.floor(randomFn()*6)+1 >= 5;
  }
  function rollCursedFate(randomFn=Math.random) {
    const first=Math.floor(randomFn()*6)+1;
    const second=Math.floor(randomFn()*6)+1;
    if (first===1||first===6) return first;
    return second;
  }

  function installEndTurnHooks() {
    if (typeof endTurn !== 'function' || endTurn._leadershipFidelity) return;
    const base=endTurn;
    endTurn=function(){
      const faction=turnOrder[currentTurnIndex];
      finishWithdrawalGrace(faction);
      return base.apply(this,arguments);
    };
    endTurn._leadershipFidelity=true;
  }

  function installPhaseHooks() {
    if (typeof handleEventPhase === 'function' && !handleEventPhase._leadershipFidelity) {
      const base=handleEventPhase;
      handleEventPhase=function(faction){ retryDeferredDeployments(faction); enforceWithdrawalGrace(faction); return base.apply(this,arguments); };
      handleEventPhase._leadershipFidelity=true;
    }
  }

  completePersonalityDeck();
  installLeaderMoveHandler();
  installEndTurnHooks();
  installPhaseHooks();

  window.getDivineRightCombatLeaderBonus=leaderCombatBonus;
  window.prepareInactiveKingdoms=prepareInactiveKingdoms;
  window.deployActivatedKingdom=deployActivatedKingdom;
  window.markNeutralWithdrawalGrace=markNeutralWithdrawalGrace;
  window.canAttackGhostRiders=canAttackGhostRiders;
  window.wanderingMusicBlocksAttack=wanderingMusicBlocksAttack;
  window.rollCursedFate=rollCursedFate;
})();
