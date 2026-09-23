// Smaller Divine Right rules-fidelity elements: diplomatic penalties/banishment,
// exact random events, leader fate/capture, confusion, and prisoners.
(function () {
  function enabled() { return window.scenarioMeta?.id === 'board-game'; }
  function d6() { return Math.floor(Math.random() * 6) + 1; }
  function kingdomOfUnit(unit) { return unit?.originalFaction || unit?.faction || null; }

  function kingdomTiles(kingdom) {
    return Object.entries(tileData).filter(([, t]) =>
      (t?.originalFaction || t?.faction) === kingdom
    );
  }
  function kingdomStateTile(kingdom) {
    const entries = kingdomTiles(kingdom);
    return entries.find(([, t]) => t.isCapital)?.[1] ||
      entries.find(([, t]) => t.isFortress)?.[1] ||
      entries[0]?.[1] || null;
  }
  function kingdomStateEntry(kingdom) {
    const entries = kingdomTiles(kingdom);
    return entries.find(([, t]) => t.isCapital) ||
      entries.find(([, t]) => t.isFortress) ||
      entries[0] || null;
  }

  // -------------------------------------------------------------------------
  // Diplomatic penalty for violating neutral territory.
  // One border violation is -1 forever for that player/kingdom; repeated border
  // crossings do not stack. Executing a captured monarch adds a separate
  // permanent -1, as required by the prisoner rules.
  // -------------------------------------------------------------------------
  function diplomacyLedger(kingdom) {
    const tile = kingdomStateTile(kingdom);
    if (!tile) return null;
    if (!tile.diplomacyLedger) tile.diplomacyLedger = {};
    return tile.diplomacyLedger;
  }
  function ledgerFor(faction, kingdom) {
    const ledger = diplomacyLedger(kingdom);
    if (!ledger) return null;
    if (!ledger[faction]) ledger[faction] = { borderViolation: false, permanentExtra: 0 };
    return ledger[faction];
  }
  function diplomaticPenaltyMagnitude(faction, kingdom) {
    const rec = diplomacyLedger(kingdom)?.[faction];
    if (!rec) return 0;
    return (rec.borderViolation ? 1 : 0) + Number(rec.permanentExtra || 0);
  }
  function diplomaticModifier(faction, kingdom) {
    return -diplomaticPenaltyMagnitude(faction, kingdom);
  }
  function recordBorderViolation(faction, kingdom) {
    const rec = ledgerFor(faction, kingdom);
    if (!rec || rec.borderViolation) return false;
    rec.borderViolation = true;
    return true;
  }
  function recordPermanentDiplomaticPenalty(faction, kingdom) {
    const rec = ledgerFor(faction, kingdom);
    if (!rec) return 0;
    rec.permanentExtra = Number(rec.permanentExtra || 0) + 1;
    return rec.permanentExtra;
  }
  function isNeutralKingdom(kingdom) {
    if (!kingdom || kingdom === 'none') return false;
    const tiles = kingdomTiles(kingdom);
    if (tiles.some(([, t]) => t.allyOf)) return false;
    return neutralFactions.has(kingdom) || controlTypes[kingdom] === 'neutral';
  }
  function kingdomAt(row, col) {
    const tile = tileData[`${row},${col}`];
    if (!tile) return null;
    const kingdom = tile.originalFaction || tile.faction;
    return kingdom && kingdom !== 'none' ? kingdom : null;
  }
  function recordNeutralEntry(unit, row, col) {
    if (!enabled() || !unit || unit.isAmbassador) return false;
    const kingdom = kingdomAt(row, col);
    if (!isNeutralKingdom(kingdom)) return false;
    const playerFaction = unit.faction;
    if (!playerFaction || playerFaction === kingdom) return false;
    const fresh = recordBorderViolation(playerFaction, kingdom);
    if (fresh) alert(`${playerFaction.toUpperCase()} violates neutral ${kingdom.toUpperCase()} territory. Future diplomacy there suffers -1.`);

    // Violating a kingdom during Forced Peace immediately ends that peace.
    const state = kingdomStateTile(kingdom);
    if (state?.forcedPeaceUntil && turnNumber < state.forcedPeaceUntil) {
      delete state.forcedPeaceUntil;
      if (typeof neutralFactions !== 'undefined') neutralFactions.add(kingdom);
      alert(`${kingdom.toUpperCase()}'s Forced Peace ends immediately because its border was violated.`);
    }
    return fresh;
  }

  function installNeutralEntryHook() {
    if (typeof svg === 'undefined' || !svg?.addEventListener || svg.dataset.neutralPenaltyHook === '1') return;
    svg.dataset.neutralPenaltyHook = '1';
    svg.addEventListener('click', event => {
      if (!enabled() || currentPhase !== 'movement' || !selectedUnit || selectedUnit.hasMoved) return;
      const hexText = event.target?.dataset?.hex;
      if (!hexText) return;
      const [row, col] = hexText.split(',').map(Number);
      const legal = validMoves(selectedUnit).some(([r, c]) => r === row && c === col);
      if (legal) recordNeutralEntry(selectedUnit, row, col);
    }, true);
  }

  // -------------------------------------------------------------------------
  // Banishment duration and exact activation rolls.
  // -------------------------------------------------------------------------
  function playerMonarch(faction) {
    return units.find(u => u.isLeader && u.faction === faction && (!u.originalFaction || u.originalFaction === faction)) ||
      units.find(u => u.isLeader && u.faction === faction) || null;
  }
  function diploMeta(faction) {
    const monarch = playerMonarch(faction);
    if (!monarch) return null;
    if (!monarch.diplomacyMeta) monarch.diplomacyMeta = {};
    return monarch.diplomacyMeta;
  }
  function timedBanishments(faction) {
    const meta = diploMeta(faction);
    if (!meta) return null;
    if (!meta.banishments) meta.banishments = {};
    return meta.banishments;
  }

  isAmbassadorBanned = function (faction, kingdom) {
    if (ambassadorBanned[faction]?.has(kingdom)) return true; // permanent legacy/assassination ban
    const until = timedBanishments(faction)?.[kingdom];
    return Number.isFinite(until) && turnNumber < until;
  };

  banAmbassador = function (faction, kingdom, durationTurns = null) {
    if (Number.isFinite(durationTurns)) {
      const bans = timedBanishments(faction);
      if (!bans) return;
      // N full game turns: if incurred on turn T, unavailable through T+N,
      // returning on T+N+1. Multiple timed banishments add together.
      const currentUntil = Math.max(Number(bans[kingdom] || 0), turnNumber + 1);
      bans[kingdom] = currentUntil + Math.max(0, durationTurns);
      alert(`${faction.toUpperCase()}'s ambassador is banished from ${kingdom.toUpperCase()} for ${durationTurns} full game turn(s).`);
      return;
    }
    if (!ambassadorBanned[faction]) ambassadorBanned[faction] = new Set();
    ambassadorBanned[faction].add(kingdom);
    alert(`${faction.toUpperCase()}'s ambassador is permanently banished from ${kingdom.toUpperCase()}.`);
  };

  function personalityModifier(pCard, card) {
    let value = Number(pCard?.diplomacyBonus || 0);
    if (pCard?.bribeBonus && card?.isBribe) value += Number(pCard.bribeBonus || 0);
    return value;
  }

  rollBareAmbassador = function (faction, kingdom, onComplete) {
    const pCard = getPersonalityCard(kingdom);
    const roll = d6();
    const mod = Number(pCard?.diplomacyBonus || 0) + diplomaticModifier(faction, kingdom);
    const total = roll + mod;
    const note = mod ? ` ${mod > 0 ? '+' : ''}${mod} = ${total}` : '';
    alert(`${faction.toUpperCase()} → ${kingdom.replace(/_/g, ' ').toUpperCase()}\nRoll: ${roll}${note} (need 6+)\n${total >= 6 ? '✓ Joins your alliance!' : '✗ No effect.'}`);
    if (total >= 6) formAlliance(faction, kingdom);
    onComplete();
  };

  playDiplomaticCard = function (faction, card, kingdom, onComplete) {
    // Magicians ignore cards and use an unmodified 6 as before.
    if (kingdom === 'eaters' || kingdom === 'black_hand') {
      const roll = d6();
      if (roll === 6) formAlliance(faction, kingdom);
      alert(`${faction.toUpperCase()} → ${kingdom.replace(/_/g, ' ').toUpperCase()}\nCard discarded; magicians ignore Diplomacy cards. Roll ${roll}${roll === 6 ? ' — success.' : ' — no effect.'}`);
      onComplete();
      return;
    }
    const pCard = getPersonalityCard(kingdom);
    const cardValue = Number(card?.value || 0);
    const pMod = personalityModifier(pCard, card);
    const penalty = diplomaticModifier(faction, kingdom);
    const roll = d6();
    const total = roll + cardValue + pMod + penalty;
    const success = total >= 6;
    alert(`${faction.toUpperCase()} plays "${card.label}" on ${kingdom.toUpperCase()}\nRoll ${roll} + card ${cardValue}${pMod ? ` ${pMod > 0 ? '+' : ''}${pMod} personality` : ''}${penalty ? ` ${penalty} penalty` : ''} = ${total} (need 6+)\n${success ? '✓ Success.' : '✗ Failed.'}`);
    if (success) {
      formAlliance(faction, kingdom);
    } else if (card?.canBanish) {
      const immune = card.type === 'crassBribe' && pCard?.crassBribeImmunity;
      if (!immune) banAmbassador(faction, kingdom, cardValue + 1);
    }
    onComplete();
  };

  // Fix the currently over-full Diplomacy deck: the rulebook has two Bribe +2
  // cards, not three, for 45 total cards including 13 Special Mercenaries.
  function correctDiplomacyDeckTemplate() {
    if (typeof DIPLO_CARD_TEMPLATES === 'undefined') return;
    const indexes = [];
    DIPLO_CARD_TEMPLATES.forEach((c, i) => { if (c.type === 'bribe' && Number(c.value) === 2) indexes.push(i); });
    while (indexes.length > 2) {
      const idx = indexes.pop();
      DIPLO_CARD_TEMPLATES.splice(idx, 1);
      for (let i = 0; i < indexes.length; i++) if (indexes[i] > idx) indexes[i]--;
    }
  }

  // -------------------------------------------------------------------------
  // Exact Random Events table.
  // -------------------------------------------------------------------------
  function unitKingdom(unit) { return unit?.originalFaction || unit?.faction; }
  function friendlyNonPlayerMonarchs(faction) {
    return units.filter(u => u.isLeader && u.faction === faction && u.originalFaction && u.originalFaction !== faction && !u.isPrisoner);
  }
  function controlledRegularKingdoms(faction) {
    return [...new Set(units.filter(u => u.faction === faction && !u.isLeader && !u.isMercenary && !u.isSpecialMerc)
      .map(unitKingdom).filter(Boolean))];
  }
  function applyBadOmens(faction, randomFn = Math.random) {
    const kingdoms = controlledRegularKingdoms(faction);
    if (!kingdoms.length) return null;
    const kingdom = kingdoms[Math.floor(randomFn() * kingdoms.length)];
    for (const u of units) {
      if (u.faction !== faction || unitKingdom(u) !== kingdom || u.isLeader || u.isMercenary || u.isSpecialMerc) continue;
      if (u.badOmensTurn === turnNumber) continue;
      u.badOmensTurn = turnNumber;
      u.badOmensCombatStrength = u.combatStrength;
      u.badOmensSiegeStrength = u.siegeStrength;
      u.combatStrength = 0;
      u.siegeStrength = 0;
    }
    return kingdom;
  }
  function restoreBadOmens(faction) {
    for (const u of units) {
      if (u.faction !== faction || u.badOmensTurn == null) continue;
      if (u.badOmensCombatStrength != null) u.combatStrength = u.badOmensCombatStrength;
      if (u.badOmensSiegeStrength != null) u.siegeStrength = u.badOmensSiegeStrength;
      delete u.badOmensTurn; delete u.badOmensCombatStrength; delete u.badOmensSiegeStrength;
    }
  }
  function stormVulnerableFleets(faction) {
    const fleets = units.filter(u => u.faction === faction && u.isFleet && !u.isLeader);
    const byHex = new Map();
    for (const fleet of fleets) {
      const key = `${fleet.row},${fleet.col}`;
      if (!byHex.has(key)) byHex.set(key, []);
      byHex.get(key).push(fleet);
    }
    const vulnerable = [];
    for (const [key, stack] of byHex) {
      const tile = tileData[key];
      if (tile?.isPort && tile?.isFortress) continue; // castle-port shelters unlimited fleets
      if (tile?.isPort && !tile?.isFortress) {
        vulnerable.push(...stack.slice(1)); // one fleet sheltered in a non-castle port
        continue;
      }
      vulnerable.push(...stack);
    }
    return vulnerable;
  }

  function promptFromList(list, text, onSelect, onNone) {
    if (!list.length) { if (onNone) onNone(); return; }
    const labels = list.map((u, i) => `${i + 1}. ${u.name || unitKingdom(u) || u.faction} (${u.row},${u.col})`).join('\n');
    const n = Number.parseInt(prompt(`${text}\n${labels}`), 10) - 1;
    const chosen = list[n];
    if (chosen) onSelect(chosen); else if (onNone) onNone();
  }

  continueEventPhase = function (currentFaction) {
    const die1 = d6(), die2 = d6(), total = die1 + die2;
    const advance = () => {
      currentPhase = 'diplo-draw';
      updateTurnInfo();
      if (typeof dispatchCPUIfNeeded === 'function') dispatchCPUIfNeeded();
    };
    switch (total) {
      case 2: {
        const monarchs = friendlyNonPlayerMonarchs(currentFaction);
        if (!monarchs.length) { alert('Event 2 — Untimely Death: no friendly non-player monarch; no event.'); break; }
        const victim = monarchs[Math.floor(Math.random() * monarchs.length)];
        alert(`Event 2 — Untimely Death: ${unitKingdom(victim)}'s monarch dies.`);
        resolveMonarchDeath(victim, null, { noVictoryPoints: true, cause: 'event' });
        break;
      }
      case 3: {
        const vulnerable = stormVulnerableFleets(currentFaction);
        if (!vulnerable.length) { alert('Event 3 — Storms: no vulnerable fleet; no event.'); break; }
        promptFromList(vulnerable, 'Event 3 — Storms. Choose one vulnerable fleet to eliminate:', u => { removeUnit(u); advance(); }, advance);
        return;
      }
      case 4: {
        const eligible = units.filter(u => u.faction === currentFaction && !u.isLeader && !u.isSpecialMerc);
        promptFromList(eligible, 'Event 4 — Mutiny. Choose one regular or mercenary unit to eliminate:', u => { removeUnit(u); advance(); }, advance);
        return;
      }
      case 5: {
        const kingdom = applyBadOmens(currentFaction);
        alert(kingdom ? `Event 5 — Bad Omens: ${kingdom}'s regulars may move but may not fight or siege this player turn.` : 'Event 5 — Bad Omens: no eligible regular kingdom; no event.');
        break;
      }
      case 6:
        alert('Event 6 — Replacements: return up to 2 eliminated regular units.');
        handleReserveDeployment(2, true, false, advance); return;
      case 7:
        alert('Event 7 — No Event.'); break;
      case 8:
        alert('Event 8 — Reinforcements: bring 2 mercenary units into play.');
        handleReserveDeployment(2, false, true, advance); return;
      case 9: {
        const eligible = units.filter(u => u.faction === currentFaction && !u.isLeader && !u.isSpecialMerc);
        promptFromList(eligible, 'Event 9 — Plague. Choose one regular or mercenary unit to eliminate:', u => { removeUnit(u); advance(); }, advance);
        return;
      }
      case 10:
        alert('Event 10 — Replacement: return 1 regular or mercenary unit.');
        handleReserveDeployment(1, true, true, advance); return;
      case 11: {
        const eligible = units.filter(u => u.faction === currentFaction && u.isMercenary && !u.isLeader && !u.isSpecialMerc);
        promptFromList(eligible, 'Event 11 — Desertion. Choose one mercenary unit to eliminate:', u => { removeUnit(u); advance(); }, advance);
        return;
      }
      case 12: {
        const neutral = typeof getNeutralKingdoms === 'function' ? getNeutralKingdoms() : [];
        if (!neutral.length) { alert('Event 12 — Help From Afar: no neutral non-player kingdom is available; no event.'); break; }
        const kingdom = neutral[Math.floor(Math.random() * neutral.length)];
        alert(`Event 12 — Help From Afar: ${kingdom.toUpperCase()} immediately joins your alliance.`);
        formAlliance(currentFaction, kingdom);
        break;
      }
    }
    advance();
  };

  // -------------------------------------------------------------------------
  // Leader fate, monarch death/capture, confusion and imprisonment.
  // -------------------------------------------------------------------------
  function isPlayerMonarch(unit) {
    if (!unit?.isLeader) return false;
    if (unit.originalFaction && unit.originalFaction !== unit.faction) return false;
    return controlTypes[unit.faction] === 'human' || controlTypes[unit.faction] === 'cpu';
  }
  function isNonPlayerMonarch(unit) {
    return !!unit?.isLeader && !!unit.originalFaction && unit.originalFaction !== unit.faction;
  }
  function responsibleFaction(unit, row, col) {
    const active = turnOrder[currentTurnIndex];
    if (active && active !== unit.faction) return active;
    const enemy = units.find(u => u.row === row && u.col === col && u.faction !== unit.faction && (u.combatStrength || 0) > 0);
    return enemy?.faction || null;
  }
  function distance(aRow, aCol, bRow, bCol) {
    if (typeof hexBFSDistance === 'function') return hexBFSDistance(aRow, aCol, bRow, bCol);
    return Math.abs(aRow - bRow) + Math.abs(aCol - bCol);
  }
  function nearestPrisonCastle(captor, row, col) {
    return Object.entries(tileData)
      .filter(([, t]) => t?.isFortress && (t.faction === captor || t.allyOf === captor) && !t.siegeState && !t.plundered && (t.fortressStrength || 0) > 0)
      .map(([key, tile]) => {
        const [r, c] = key.split(',').map(Number);
        return { key, tile, row: r, col: c, d: distance(row, col, r, c) };
      })
      .sort((a, b) => a.d - b.d)[0] || null;
  }
  function captureLeader(unit, captor, row, col) {
    const prison = nearestPrisonCastle(captor, row, col);
    unit.isPrisoner = true;
    unit.capturedBy = captor;
    unit.capturedOriginalController = unit.faction;
    unit.prisonCastleKey = prison?.key || null;
    unit.hasMoved = true;
    if (prison) { unit.row = prison.row; unit.col = prison.col; }
    else { unit.row = null; unit.col = null; }
    return prison;
  }
  function kingdomForMonarch(unit) { return unit.originalFaction || unit.faction; }
  function markKingdomConfused(kingdom, turns = d6()) {
    const until = turnNumber + turns + 1;
    const tile = kingdomStateTile(kingdom);
    if (tile) {
      tile.monarchDead = true;
      tile.confusionUntilTurn = until;
      tile.confusionStartedTurn = turnNumber;
    }
    if (typeof deactivateKingdom === 'function') deactivateKingdom(kingdom, 'monarch death/confusion');
    return until;
  }
  function resolveMonarchDeath(unit, scorer = null, options = {}) {
    const kingdom = kingdomForMonarch(unit);
    const player = isPlayerMonarch(unit);
    const npc = isNonPlayerMonarch(unit);
    if (!options.noVictoryPoints && scorer) {
      if (player) addVictoryPoints(scorer, 70);
      else if (npc) addVictoryPoints(scorer, 40);
    }
    if (player) {
      eliminatedFactions.add(unit.faction);
      if (typeof deactivateKingdom === 'function') {
        const allies = [...new Set(units.filter(u => u.originalFaction && u.faction === unit.faction && u.originalFaction !== unit.faction).map(u => u.originalFaction))];
        for (const ally of allies) deactivateKingdom(ally, 'player monarch eliminated');
      }
      markKingdomConfused(kingdom);
    } else if (npc) {
      markKingdomConfused(kingdom);
    }
    const idx = units.indexOf(unit); if (idx >= 0) units.splice(idx, 1);
    return { kingdom, player, npc };
  }
  function resolveMonarchCapture(unit, captor) {
    const row = unit.row, col = unit.col;
    const player = isPlayerMonarch(unit), npc = isNonPlayerMonarch(unit);
    if (captor) addVictoryPoints(captor, player ? 70 : npc ? 30 : 0);
    const prison = captureLeader(unit, captor, row, col);
    if (player) {
      eliminatedFactions.add(unit.faction);
      if (typeof deactivateKingdom === 'function') {
        const allies = [...new Set(units.filter(u => u.originalFaction && u.faction === unit.faction && u.originalFaction !== unit.faction).map(u => u.originalFaction))];
        for (const ally of allies) deactivateKingdom(ally, 'player monarch captured');
      }
      markKingdomConfused(kingdomForMonarch(unit));
    }
    return prison;
  }

  fateDieRoll = function (unit) {
    if (!unit?.isLeader || unit.hasTakenAFateDieRoll || unit.isPrisoner) return;
    unit.hasTakenAFateDieRoll = true;
    const row = unit.row, col = unit.col;
    const scorer = responsibleFaction(unit, row, col);
    const roll = d6();
    alert(`Leader fate die roll for ${unit.name || kingdomForMonarch(unit)}: ${roll}`);
    if (roll === 1) {
      resolveMonarchDeath(unit, scorer);
      alert(`${unit.name || kingdomForMonarch(unit)} is killed.`);
    } else if (roll === 6) {
      const prison = resolveMonarchCapture(unit, scorer);
      alert(`${unit.name || kingdomForMonarch(unit)} is captured${prison ? ` and imprisoned at ${prison.tile.name || prison.key}` : ''}.`);
    }
    updateVPInfo(); drawMap();
  };

  function refreshConfusedKingdoms() {
    for (const [kingdom] of Object.entries(personalityCards)) {
      const state = kingdomStateTile(kingdom);
      if (!state?.monarchDead || !state.confusionUntilTurn || turnNumber < state.confusionUntilTurn) continue;
      state.monarchDead = false;
      delete state.confusionUntilTurn;
      // Draw a fresh available personality definition. Full 20-card data remains
      // a separate fidelity task; never knowingly reuse the old personality.
      const ids = Object.keys(PERSONALITY_CARDS).map(Number).filter(id => id !== Number(personalityCards[kingdom]));
      if (ids.length) personalityCards[kingdom] = ids[Math.floor(Math.random() * ids.length)];
      neutralFactions.add(kingdom);
      alert(`${kingdom.toUpperCase()} crowns a new monarch and is available for diplomacy again.`);
    }
  }

  // Prisoner options are in addition to the ambassador's normal diplomatic task.
  function prisonersHeldBy(faction) { return units.filter(u => u.isLeader && u.isPrisoner && u.capturedBy === faction); }
  function releasePrisoner(unit) {
    const kingdom = kingdomForMonarch(unit);
    const castles = Object.entries(tileData).filter(([, t]) => (t.originalFaction || t.faction) === kingdom && t.isFortress && !t.plundered && !t.siegeState);
    let dest = null;
    if (castles.length) {
      const [key] = castles[0]; const [r, c] = key.split(',').map(Number); dest = { r, c };
    }
    if (!dest) {
      const friend = units.find(u => !u.isPrisoner && (u.originalFaction === kingdom || u.faction === kingdom));
      if (friend) dest = { r: friend.row, c: friend.col };
    }
    unit.isPrisoner = false; delete unit.capturedBy; delete unit.prisonCastleKey;
    if (dest) { unit.row = dest.r; unit.col = dest.c; }
    return dest;
  }
  function executePrisoner(unit, captor) {
    const kingdom = kingdomForMonarch(unit);
    recordPermanentDiplomaticPenalty(captor, kingdom);
    const i = units.indexOf(unit); if (i >= 0) units.splice(i, 1);
    markKingdomConfused(kingdom);
    alert(`${captor.toUpperCase()} executes the captured monarch of ${kingdom.toUpperCase()}. No additional VP; permanent -1 diplomacy there.`);
  }
  function forcePeaceOnPrisoner(unit) {
    const key = unit.prisonCastleKey;
    const prisonTile = key ? tileData[key] : null;
    const threatened = !!prisonTile?.siegeState;
    const roll = d6(); const need = threatened ? 6 : 5;
    const kingdom = kingdomForMonarch(unit);
    if (roll >= need) {
      const duration = d6();
      if (typeof deactivateKingdom === 'function') deactivateKingdom(kingdom, 'prisoner forced peace');
      const state = kingdomStateTile(kingdom); if (state) state.forcedPeaceUntil = turnNumber + duration + 1;
      alert(`${kingdom.toUpperCase()} accepts Forced Peace for ${duration} full game turn(s). Roll ${roll}, needed ${need}+.`);
    } else alert(`Forced Peace on ${kingdom.toUpperCase()} fails: roll ${roll}, needed ${need}+.`);
  }

  const baseDiploPlay = typeof handleDiploPlayPhase === 'function' ? handleDiploPlayPhase : null;
  if (baseDiploPlay) handleDiploPlayPhase = function (faction, onComplete) {
    if (!enabled()) return baseDiploPlay(faction, onComplete);
    const prisoners = prisonersHeldBy(faction);
    if (!prisoners.length) return baseDiploPlay(faction, onComplete);
    const menu = prisoners.map((u, i) => `${i + 1}. ${u.name || kingdomForMonarch(u)}`).join('\n');
    const p = Number.parseInt(prompt(`You hold captured monarch(s):\n${menu}\n\nChoose a prisoner for an optional jailer action, or 0 for normal diplomacy:`), 10) - 1;
    const prisoner = prisoners[p];
    if (!prisoner) return baseDiploPlay(faction, onComplete);
    const action = Number.parseInt(prompt('Prisoner action (does not consume ambassador):\n1. Forced Peace roll\n2. Execute\n3. Release\n0. None'), 10);
    if (action === 1) forcePeaceOnPrisoner(prisoner);
    else if (action === 2) executePrisoner(prisoner, faction);
    else if (action === 3) releasePrisoner(prisoner);
    return baseDiploPlay(faction, onComplete);
  };

  const baseEndTurn = typeof endTurn === 'function' ? endTurn : null;
  if (baseEndTurn) endTurn = function () {
    const endingFaction = turnOrder[currentTurnIndex];
    restoreBadOmens(endingFaction);
    const result = baseEndTurn.apply(this, arguments);
    refreshConfusedKingdoms();
    return result;
  };

  correctDiplomacyDeckTemplate();
  setTimeout(installNeutralEntryHook, 0);

  window.getDiplomaticPenaltyModifier = diplomaticModifier;
  window.recordDiplomaticViolation = recordBorderViolation;
  window.recordPermanentDiplomaticPenalty = recordPermanentDiplomaticPenalty;
  window.diplomaticPenaltyMagnitude = diplomaticPenaltyMagnitude;
  window.applyBadOmens = applyBadOmens;
  window.stormVulnerableFleets = stormVulnerableFleets;
  window.resolveMonarchDeath = resolveMonarchDeath;
  window.resolveMonarchCapture = resolveMonarchCapture;
  window.markKingdomConfused = markKingdomConfused;
})();
