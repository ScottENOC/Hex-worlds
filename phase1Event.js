// Rules-fidelity overrides shared by the Divine Right scenario.
// This file was originally an empty phase placeholder; it now hosts opt-in
// rules that correct core engine behaviour without hard-wiring them into every
// scenario. Scenario flags live in scenarios/<id>/scenario.json.

(function () {
  function ruleEnabled(name, fallback = false) {
    const rules = window.scenarioRules || {};
    return rules[name] != null ? !!rules[name] : fallback;
  }

  function gameOption(name, fallback) {
    const opts = window.gameOptions || {};
    if (opts[name] != null) return opts[name];
    const rules = window.scenarioRules || {};
    return rules[name] != null ? rules[name] : fallback;
  }

  // ---------------------------------------------------------------------------
  // Casualty selection
  // ---------------------------------------------------------------------------
  // Board-game rules let the owning player choose casualties. For asynchronous
  // multiplayer, the optional priority mode resolves them deterministically:
  // Scum -> Barbarians -> standard mercenaries -> allied-kingdom troops ->
  // regular player-kingdom troops -> special mercenaries.
  function casualtyTier(unit, controllingFaction) {
    if (unit?.isScum) return 0;
    if (unit?.isBarbarian) return 1;
    if (unit?.isMercenary && !unit?.isSpecialMerc) return 2;

    const originalFaction = unit?.originalFaction;
    const isAlliedKingdomTroop = !!originalFaction &&
      !!controllingFaction &&
      originalFaction !== controllingFaction &&
      !unit?.isMercenary &&
      !unit?.isSpecialMerc;
    if (isAlliedKingdomTroop) return 3;

    if (!unit?.isSpecialMerc) return 4;
    return 5;
  }

  function unitLabel(unit) {
    if (!unit) return "Unknown unit";
    if (unit.name) return unit.name;
    if (unit.isScum) return "Scum";
    if (unit.isBarbarian) return "Barbarian";
    if (unit.isSpecialMerc) return "Special mercenary";
    if (unit.isMercenary) return "Mercenary";
    if (unit.originalFaction && unit.originalFaction !== unit.faction) {
      return `${unit.originalFaction} allied troop`;
    }
    return `${unit.originalFaction || unit.faction || "Unknown"} troop`;
  }

  function chooseCasualty(candidates, controllingFaction, sideLabel) {
    const eligible = (candidates || []).filter(u => u && !u.isLeader && units.includes(u));
    if (!eligible.length) return null;

    const mode = gameOption("casualtySelectionMode", "manual");
    const control = controllingFaction ? controlTypes[controllingFaction] : null;
    const automatic = mode === "priority" || control === "cpu";

    if (automatic) {
      return [...eligible].sort((a, b) => {
        const tierDiff = casualtyTier(a, controllingFaction) - casualtyTier(b, controllingFaction);
        if (tierDiff) return tierDiff;
        // Within a tier, sacrifice the least valuable combat counter first.
        const strengthA = (a.combatStrength || 0) + (a.siegeStrength || 0);
        const strengthB = (b.combatStrength || 0) + (b.siegeStrength || 0);
        return strengthA - strengthB;
      })[0];
    }

    const menu = eligible.map((u, i) =>
      `${i + 1}. ${unitLabel(u)} — combat ${u.combatStrength || 0}, siege ${u.siegeStrength || 0}`
    ).join("\n");
    const answer = prompt(
      `${sideLabel || "Player"}: choose a casualty.\n\n${menu}\n\nEnter 1-${eligible.length}:`
    );
    const index = Number.parseInt(answer, 10) - 1;
    if (Number.isInteger(index) && index >= 0 && index < eligible.length) return eligible[index];

    // Cancelling or entering an invalid value should not stall a hotseat game.
    return eligible[0];
  }

  window.chooseCombatCasualty = chooseCasualty;
  window.casualtyTier = casualtyTier;

  // Override combat resolution so casualty ownership is respected and the
  // async-friendly deterministic policy can be used without changing results.
  if (typeof resolveCurrentCombat === "function") {
    resolveCurrentCombat = function () {
      const { attackers, defenders, fromHex, targetHex } = window.currentCombat;
      const tile = tileData[`${targetHex.row},${targetHex.col}`];
      const terrain = tile?.terrain;

      const eaterInDefenders = defenders.find(u => u.isEatersOfWisdom);
      if (eaterInDefenders) {
        const enemiesInHex = units.some(u =>
          u.row === targetHex.row && u.col === targetHex.col &&
          u.faction !== eaterInDefenders.faction && (u.combatStrength || 0) > 0
        );
        if (enemiesInHex) eaterInDefenders.combatStrength = 0;
      }

      let attackerStrength = attackers.reduce((s, u) => s + (u.combatStrength || 0), 0);
      let defenderStrength = defenders.reduce((s, u) => s + (u.combatStrength || 0), 0);

      const terrainList = Array.isArray(terrain) ? terrain : [terrain];
      if (terrainList.includes("mountain_pass")) defenderStrength *= 2;

      if (typeof getEnchantedCastleBonus === "function") {
        defenderStrength *= getEnchantedCastleBonus(targetHex.row, targetHex.col);
      }

      let attackerBonus = 0;
      let defenderBonus = 0;
      if (attackerStrength > defenderStrength && defenderStrength > 0) {
        attackerBonus = Math.floor(attackerStrength / defenderStrength) - 1;
      } else if (defenderStrength > attackerStrength && attackerStrength > 0) {
        defenderBonus = Math.floor(defenderStrength / attackerStrength) - 1;
        if (defenderBonus === 0) defenderBonus = 1;
      }
      if (terrainList.includes("mountain")) defenderBonus += 1;

      const attackerFaction = attackers[0]?.faction;
      const defenderFaction = defenders[0]?.faction;
      const attackerSleepPenalty = units.some(u => u.isLeader && u.faction === attackerFaction && u.templeSleep) ? -1 : 0;
      const defenderSleepPenalty = units.some(u => u.isLeader && u.faction === defenderFaction && u.templeSleep) ? -1 : 0;
      const attackerIsleOfFrightPenalty = typeof getIsleOfFrightPenalty === "function" ? getIsleOfFrightPenalty(attackerFaction) : 0;
      const defenderIsleOfFrightPenalty = typeof getIsleOfFrightPenalty === "function" ? getIsleOfFrightPenalty(defenderFaction) : 0;

      const attackerRoll = Math.floor(Math.random() * 6) + 1;
      const defenderRoll = Math.floor(Math.random() * 6) + 1;
      const attackerTotal = attackerRoll + attackerBonus + attackerSleepPenalty + attackerIsleOfFrightPenalty;
      const defenderTotal = defenderRoll + defenderBonus + defenderSleepPenalty + defenderIsleOfFrightPenalty;

      let attackerLosses = 0;
      let defenderLosses = 0;
      let resultLine;
      if (attackerTotal > defenderTotal) {
        defenderLosses = attackerTotal - defenderTotal;
        resultLine = `<p>Attackers win! Defenders lose ${defenderLosses} unit(s).</p>`;
      } else if (defenderTotal > attackerTotal) {
        attackerLosses = defenderTotal - attackerTotal;
        resultLine = `<p>Defenders win! Attackers lose ${attackerLosses} unit(s).</p>`;
      } else {
        attackerLosses = defenderLosses = attackerTotal;
        resultLine = `<p>Tie! Both sides lose ${attackerLosses} unit(s).</p>`;
      }

      const hexesWithLosses = new Set();

      for (let i = 0; i < defenderLosses; i++) {
        const u = chooseCasualty(defenders, defenderFaction, `${defenderFaction || "Defender"} defence`);
        if (!u) break;
        hexesWithLosses.add(`${u.row},${u.col}`);
        removeUnit(u);
        const idx = defenders.indexOf(u);
        if (idx !== -1) defenders.splice(idx, 1);
      }

      for (let i = 0; i < attackerLosses; i++) {
        const u = chooseCasualty(attackers, attackerFaction, `${attackerFaction || "Attacker"} attack`);
        if (!u) break;
        hexesWithLosses.add(`${u.row},${u.col}`);
        removeUnit(u);
        const idx = attackers.indexOf(u);
        if (idx !== -1) attackers.splice(idx, 1);
      }

      for (const hexKey of hexesWithLosses) {
        const [r, c] = hexKey.split(',').map(Number);
        for (const leader of units.filter(u => u.isLeader && u.row === r && u.col === c)) {
          fateDieRoll(leader);
        }
      }

      if (eaterInDefenders && eaterInDefenders.combatStrength === 0) {
        eaterInDefenders.combatStrength = eaterInDefenders.baseCombatStrength || 2;
      }

      const nonLeaderDefenders = defenders.filter(u => !u.isLeader || u.isEatersOfWisdom);
      if (nonLeaderDefenders.length === 0 && attackers.length > 0) {
        for (const u of attackers) {
          if (units.includes(u)) { u.row = targetHex.row; u.col = targetHex.col; }
        }
        for (const leader of defenders.filter(u => u.isLeader && !u.isEatersOfWisdom)) fateDieRoll(leader);
      } else {
        for (const u of attackers) {
          if (units.includes(u)) { u.row = fromHex.row; u.col = fromHex.col; }
        }
      }

      document.getElementById("combat-info").innerHTML = `
        <p><strong>Combat Result</strong></p>
        <p>Attacker: ${attackerRoll}${attackerBonus ? ` +${attackerBonus}` : ''} = ${attackerTotal}</p>
        <p>Defender: ${defenderRoll}${defenderBonus ? ` +${defenderBonus}` : ''} = ${defenderTotal}</p>
        ${resultLine}
      `;

      document.getElementById("resolve-button").style.display = "none";
      document.getElementById("continue-button").style.display = "inline";
    };
  }

  // ---------------------------------------------------------------------------
  // Preserve original kingdom ownership when diplomacy transfers control.
  // This matters for casualty priority and later deactivation mechanics.
  // ---------------------------------------------------------------------------
  if (typeof formAlliance === "function") {
    formAlliance = function (faction, kingdom) {
      alert(`${kingdom.toUpperCase()} joins forces with ${faction.toUpperCase()}!`);

      for (const key in tileData) {
        const tile = tileData[key];
        if (tile.faction === kingdom && tile.isFortress) {
          tile.originalFaction = tile.originalFaction || kingdom;
          tile.allyOf = faction;
          tile.faction = faction;
        }
      }

      for (const u of units) {
        if (u.faction === kingdom) {
          u.originalFaction = u.originalFaction || kingdom;
          u.faction = faction;
        }
      }

      let vpGain = 0;
      for (const key in tileData) {
        const t = tileData[key];
        if (t.allyOf === faction && t.isFortress) vpGain += (t.fortressStrength || 1) * 5;
      }
      if (vpGain > 0) addVictoryPoints(faction, vpGain);

      delete diplomaticInfluence[kingdom];
      drawMap();
      updateVPInfo();
    };
  }

  // ---------------------------------------------------------------------------
  // Movement fidelity
  // ---------------------------------------------------------------------------
  // These wrappers consult scenarioRules at call time. Scenario JSON is loaded
  // only after the page scripts have executed, so checking once at script load
  // would silently skip the Divine Right movement rules.
  if (typeof getTileCost === "function") {
    const baseGetTileCost = getTileCost;
    getTileCost = function (row, col, unit) {
      if (!ruleEnabled("cumulativeTerrainCosts", false)) {
        return baseGetTileCost(row, col, unit);
      }

      const data = tileData[`${row},${col}`];
      if (!data) return Infinity;

      if (unit?.isBarbarian && data.isFortress) return Infinity;
      if (data.isTempleOfKings && !unit?.isLeader && !unit?.isEatersOfWisdom) return Infinity;
      if (unit?.isEatersOfWisdom && unit?.bridgeActive) return 1;
      if (unit?.isFleet) return 1;

      const terrainList = Array.isArray(data.terrain) ? data.terrain : [data.terrain];
      const isFriendly = unit && !unit.isMercenary && unit.faction === data.faction;
      let cost = 0;

      for (const terrain of terrainList) {
        if (!terrain || terrain === "plains" || terrain === "clear") {
          cost += 1;
        } else if (terrain === "mountain") {
          cost += 3;
        } else if (terrain === "forest") {
          cost += (unit?.forestWalk || isFriendly) ? 1 : 2;
        } else if (terrain === "hills") {
          cost += (unit?.mountainWalk || isFriendly) ? 1 : 2;
        } else if (terrain === "marsh" || terrain === "mountain_pass") {
          cost += 2;
        } else {
          cost += 1;
        }
      }

      if (cost <= 0) cost = 1;
      // Existing map data records rivers on the hex rather than as a distinct
      // major/minor river class. Preserve the previous minimum river cost here;
      // edge-specific major-river movement is a later fidelity tranche.
      const rivers = Array.isArray(data.rivers) ? data.rivers : [];
      if (rivers.length) cost = Math.max(cost, 2);
      return cost;
    };
  }

  if (typeof validMoves === "function") {
    const baseValidMoves = validMoves;
    validMoves = function (unit) {
      if (!ruleEnabled("minimumOneHexMovement", false)) {
        return baseValidMoves(unit);
      }

      if (unit.isLeader && !unit.isEatersOfWisdom) {
        const cardId = typeof personalityCards !== "undefined" && personalityCards[unit.faction];
        const pCard = cardId != null && typeof PERSONALITY_CARDS !== "undefined" ? PERSONALITY_CARDS[cardId] : null;
        if (pCard?.monarchCantLeave) return [];
      }

      const visited = {};
      const result = [];
      const resultKeys = new Set();
      const moveSpeed = unit.moveSpeed;
      const isFleet = unit.isFleet;

      function hasLakeOnSide(row, col, side) {
        const tile = tileData[`${row},${col}`];
        return !!tile?.lakes?.includes(side);
      }

      function isPassableBetween(r1, c1, r2, c2) {
        const dirs = (r1 % 2 === 0) ? sideOffsetsEven : sideOffsetsOdd;
        const side = dirs.findIndex(([dr, dc]) => r1 + dr === r2 && c1 + dc === c2);
        if (side === -1) return false;
        const reverseSide = (side + 3) % 6;
        const hasLake1 = hasLakeOnSide(r1, c1, side);
        const hasLake2 = hasLakeOnSide(r2, c2, reverseSide);
        return isFleet ? (hasLake1 && hasLake2) : (!hasLake1 && !hasLake2);
      }

      function canStackAt(r, c) {
        if (unit.isBarbarian) {
          return !units.some(u => u.row === r && u.col === c && u.faction === unit.faction && !u.isBarbarian && (u.combatStrength || 0) > 0);
        }
        return !units.some(u => u.row === r && u.col === c && u.isBarbarian && u.faction === unit.faction);
      }

      function addResult(r, c) {
        const key = `${r},${c}`;
        if (!resultKeys.has(key) && !enemyAt(r, c, unit.faction) && canStackAt(r, c)) {
          resultKeys.add(key);
          result.push([r, c]);
        }
      }

      function dfs(r, c, mp, movedHexes = 0) {
        const key = `${r},${c}`;
        if (!tileData[key] || mp < 0) return;
        if (visited[key] !== undefined && visited[key] >= mp) return;
        visited[key] = mp;

        if (movedHexes > 0) addResult(r, c);

        const currentTerrain = Array.isArray(tileData[key].terrain) ? tileData[key].terrain : [tileData[key].terrain];
        if (movedHexes > 0 && currentTerrain.includes("mountain")) return;

        const directions = (r % 2 === 0) ? sideOffsetsEven : sideOffsetsOdd;
        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;
          const nextKey = `${nr},${nc}`;
          if (!tileData[nextKey]) continue;
          if (enemyAt(nr, nc, unit.faction)) continue;
          if (!isPassableBetween(r, c, nr, nc)) continue;

          const cost = getTileCost(nr, nc, unit);
          if (!Number.isFinite(cost)) continue;

          if (mp >= cost) {
            dfs(nr, nc, mp - cost, movedHexes + 1);
          } else if (movedHexes === 0 && moveSpeed > 0) {
            // Rulebook minimum move: one legal hex even when terrain costs more
            // than the unit's entire movement allowance.
            addResult(nr, nc);
          }
        }
      }

      dfs(unit.row, unit.col, moveSpeed, 0);
      return result;
    };
  }
})();
