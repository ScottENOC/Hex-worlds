// Divine Right siege fidelity layer.
//
// The original prototype treated any fortress with an adjacent enemy siege unit
// as besieged and immediately rolled against it.  The board game is stricter:
// a castle must be encircled by combat units / Zones of Siege, the besieger must
// field at least as many combat units as the castle's intrinsic defence plus the
// combat units inside, and the first siege attack occurs only on a subsequent
// siege-resolution phase.
//
// This file overrides getBesiegedFortresses() only for the board-game scenario.
// Other scenarios retain the engine's simpler legacy behaviour.

(function () {
  const legacyGetBesiegedFortresses = typeof getBesiegedFortresses === "function"
    ? getBesiegedFortresses
    : null;

  function useDivineRightSieges() {
    return window.scenarioMeta?.id === "board-game";
  }

  function tileKind(tile) {
    const lakes = Array.isArray(tile?.lakes) ? tile.lakes : [];
    if (lakes.length >= 6) return "sea";
    if (lakes.length > 0) return "coastal";
    return "land";
  }

  function isCombatUnit(unit) {
    return !!unit && (unit.combatStrength || 0) > 0 && !unit.isLeader;
  }

  // Eaters of Wisdom are both a leader and a combat unit.
  function countsAsCombatUnit(unit) {
    return isCombatUnit(unit) || !!unit?.isEatersOfWisdom;
  }

  function canProjectZoneInto(unit, targetTile) {
    const kind = tileKind(targetTile);
    if (unit.isFleet) return kind === "sea" || kind === "coastal";
    return kind === "land" || kind === "coastal";
  }

  function unitCoversHex(unit, row, col) {
    if (!countsAsCombatUnit(unit)) return false;
    const targetTile = tileData[`${row},${col}`];
    if (!targetTile || !canProjectZoneInto(unit, targetTile)) return false;

    // A combat unit covers its own hex and each adjacent legal terrain type with
    // its Zone of Siege.
    if (unit.row === row && unit.col === col) return true;
    return getAdjacentCoords(unit.row, unit.col)
      .some(([r, c]) => r === row && c === col);
  }

  function castleDefenders(row, col, castleFaction) {
    return units.filter(u =>
      u.row === row && u.col === col &&
      u.faction === castleFaction &&
      countsAsCombatUnit(u)
    );
  }

  function candidateBesiegers(attackerFaction, row, col) {
    const ring = getAdjacentCoords(row, col);
    const ringSet = new Set(ring.map(([r, c]) => `${r},${c}`));

    return units.filter(u => {
      if (u.faction !== attackerFaction || !countsAsCombatUnit(u)) return false;
      if (u.row == null || u.col == null) return false;
      if (u.row === row && u.col === col) return false;

      // A unit belongs to the besieging force if it occupies or projects a Zone
      // of Siege into at least one of the six surrounding hexes.
      for (const key of ringSet) {
        const [rr, cc] = key.split(",").map(Number);
        if (unitCoversHex(u, rr, cc)) return true;
      }
      return false;
    });
  }

  function coverageFor(attackerFaction, row, col) {
    const ring = getAdjacentCoords(row, col);
    const besiegers = candidateBesiegers(attackerFaction, row, col);

    const covered = ring.map(([r, c]) => {
      const covering = besiegers.filter(u => unitCoversHex(u, r, c));
      return { row: r, col: c, covering };
    });

    return {
      ring,
      besiegers,
      covered,
      fullyEncircled: covered.length === 6 && covered.every(h => h.covering.length > 0),
    };
  }

  function intrinsicDefence(tile) {
    if (tile.siegeIntrinsicDefence != null) return tile.siegeIntrinsicDefence;
    return Math.max(0, tile.fortressStrength || 0);
  }

  function siegeConditions(attackerFaction, key, tile) {
    const [row, col] = key.split(",").map(Number);
    const defence = intrinsicDefence(tile);
    const defenders = castleDefenders(row, col, tile.faction);
    const coverage = coverageFor(attackerFaction, row, col);
    const requiredCombatUnits = defence + defenders.length;
    const enoughCombatUnits = coverage.besiegers.length >= requiredCombatUnits;

    // Invisible School: at least one magical besieger is required.
    const magicalRequirementMet = !tile.requiresMagicalSieger ||
      coverage.besiegers.some(u => u.isMagical || u.isEatersOfWisdom || u.isBlackHand);

    return {
      ...coverage,
      defenders,
      intrinsicDefence: defence,
      requiredCombatUnits,
      enoughCombatUnits,
      magicalRequirementMet,
      legal: defence > 0 && coverage.fullyEncircled && enoughCombatUnits && magicalRequirementMet,
    };
  }

  function breakSiege(tile, key, reason) {
    if (!tile.siegeState) return;
    const attacker = tile.siegeState.attackerFaction;
    delete tile.siegeState;
    if (reason) {
      console.log(`[siege] ${key}: ${attacker} siege broken — ${reason}`);
    }
  }

  function declareSiege(tile, key, attackerFaction, conditions) {
    tile.siegeIntrinsicDefence = conditions.intrinsicDefence;
    tile.siegeState = {
      attackerFaction,
      declaredTurn: turnNumber,
      declaredTurnIndex: currentTurnIndex,
    };

    // Existing siege resolver uses stubstaffVP as an explicit VP override.
    // Use that hook for correct royal-castle scoring without changing custom maps.
    if (tile.stubstaffVP == null) {
      tile.stubstaffVP = conditions.intrinsicDefence * (tile.isCapital ? 10 : 5);
    }

    alert(
      `${attackerFaction.toUpperCase()} places ${tile.name || `castle ${key}`} under siege.\n` +
      `${conditions.besiegers.length} combat unit(s) encircle it; ` +
      `${conditions.requiredCombatUnits} required.\n` +
      `The first siege attack may be made on a subsequent ${attackerFaction} siege phase.`
    );
  }

  function isSubsequentSiegePhase(state) {
    if (!state) return false;
    if (turnNumber > state.declaredTurn) return true;
    // Defensive fallback for variants where the turn counter advances by player
    // rather than by full round.
    return turnNumber === state.declaredTurn && currentTurnIndex !== state.declaredTurnIndex;
  }

  function markSiegeAttackersSpent(conditions) {
    for (const unit of conditions.besiegers) {
      unit.hasMoved = true;
      unit.madeSiegeAttackTurn = turnNumber;
    }
  }

  // Expose status helpers for UI / future tests.
  window.getDivineRightSiegeConditions = siegeConditions;
  window.getCastleSiegeState = function (row, col) {
    return tileData[`${row},${col}`]?.siegeState || null;
  };

  getBesiegedFortresses = function () {
    if (!useDivineRightSieges()) {
      return legacyGetBesiegedFortresses ? legacyGetBesiegedFortresses() : new Set();
    }

    const attackerFaction = turnOrder[currentTurnIndex];
    const attackable = new Set();

    for (const [key, tile] of Object.entries(tileData)) {
      if (!tile?.isFortress) continue;

      // A plundered castle is no longer a castle for siege/combat purposes.
      if ((tile.fortressStrength || 0) <= 0) {
        if (tile.siegeIntrinsicDefence > 0) tile.plundered = true;
        breakSiege(tile, key, "castle is plundered");
        continue;
      }

      if (!tile.faction || tile.faction === "none" || tile.faction === attackerFaction) {
        // If ownership changes to the besieger, the siege ends immediately.
        if (tile.siegeState?.attackerFaction === attackerFaction) {
          breakSiege(tile, key, "castle is now friendly");
        }
        continue;
      }

      // A siege belonging to some other player is persistent but cannot be rolled
      // during the current player's siege phase.
      if (tile.siegeState && tile.siegeState.attackerFaction !== attackerFaction) {
        const existing = siegeConditions(tile.siegeState.attackerFaction, key, tile);
        if (!existing.legal) breakSiege(tile, key, "encirclement/strength no longer sufficient");
        continue;
      }

      const conditions = siegeConditions(attackerFaction, key, tile);

      if (tile.siegeState?.attackerFaction === attackerFaction) {
        if (!conditions.legal) {
          breakSiege(tile, key, "encirclement/strength no longer sufficient");
          continue;
        }

        if (isSubsequentSiegePhase(tile.siegeState)) {
          // The existing index.js resolver performs the actual siege die roll.
          // Mark every unit maintaining the siege as spent for movement, and expose
          // the fortress to that resolver only now.
          markSiegeAttackersSpent(conditions);
          attackable.add(key);
        }
        continue;
      }

      // Streamlined digital declaration: when all legal conditions are satisfied,
      // declaration is automatic. This avoids an unnecessary asynchronous prompt.
      if (conditions.legal) {
        declareSiege(tile, key, attackerFaction, conditions);
      }
    }

    return attackable;
  };
})();
