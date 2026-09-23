// scenarioLoader.js
// Loads a scenario from JSON and populates the engine globals.
// Call loadScenario(id) before initGame().

async function loadScenario(id) {
  const base = `scenarios/${id}`;
  const [scenarioData, mapTiles, startingUnits] = await Promise.all([
    fetch(`${base}/scenario.json`).then(r => r.json()),
    fetch(`${base}/map.json`).then(r => r.json()),
    fetch(`${base}/units.json`).then(r => r.json()),
  ]);

  _applyScenario(scenarioData);
  _applyMap(mapTiles);
  _applyUnits(startingUnits);

  return scenarioData;
}

function _applyScenario(data) {
  // Clear and rebuild faction color maps
  for (const key of Object.keys(kingdomColors)) delete kingdomColors[key];
  kingdomColors["none"] = data.neutralColor || "#d2b48c";

  for (const [id, f] of Object.entries(data.factions)) {
    kingdomColors[id] = f.color;
    if (f.playable) factions[id] = f.color;
  }

  // Rebuild reserves and VP tracking for playable factions
  for (const key of Object.keys(reserves)) delete reserves[key];
  for (const key of Object.keys(victoryPoints)) delete victoryPoints[key];
  for (const key of Object.keys(gold)) delete gold[key];

  for (const [id, f] of Object.entries(data.factions)) {
    if (f.playable) {
      reserves[id] = [];
      victoryPoints[id] = 0;
      gold[id] = 5;
    }
  }

  // Rebuild factionList and diplomacyHands
  factionList.length = 0;
  factionList.push(...Object.keys(data.factions).filter(f => f !== "none"));
  for (const key of Object.keys(diplomacyHands)) delete diplomacyHands[key];
  for (const f of factionList) diplomacyHands[f] = [];

  // Store rules on a global so other code can read them
  window.scenarioRules = data.rules || {};
  window.scenarioMeta  = data;

  // Update max turns if specified
  if (data.rules && data.rules.maxTurns != null) {
    window.maxTurns = data.rules.maxTurns;
  }
}

function _applyMap(tiles) {
  // Clear existing tile data
  for (const key of Object.keys(tileData)) delete tileData[key];

  for (const t of tiles) {
    const key = `${t.row},${t.col}`;
    tileData[key] = {
      row:     t.row,
      col:     t.col,
      faction: t.faction || "none",
      terrain: t.terrain,
      rivers:  t.rivers  || [],
      lakes:   t.lakes   || [],
    };
    if (t.name)                tileData[key].name = t.name;
    if (t.isFortress)          { tileData[key].isFortress = true; tileData[key].fortressStrength = t.fortressStrength; }
    if (t.isCapital)           tileData[key].isCapital = true;
    if (t.isCity)              tileData[key].isCity = true;
    if (t.cityStrength != null) tileData[key].cityStrength = t.cityStrength;
    if (t.isPort)              tileData[key].isPort = true;
    if (t.isEntryHex)          tileData[key].isEntryHex = t.isEntryHex;
    if (t.isTempleOfKings)     tileData[key].isTempleOfKings = true;
    if (t.isSacredStones)      tileData[key].isSacredStones = true;
    if (t.isAncientBattlefield) tileData[key].isAncientBattlefield = true;
    if (t.isIsleOfFright)      tileData[key].isIsleOfFright = true;
    if (t.isLepersHaunt)       tileData[key].isLepersHaunt = true;
    if (t.requiresMagicalSieger) tileData[key].requiresMagicalSieger = true;
    if (t.isStubstaffKeep) {
      tileData[key].isStubstaffKeep = true;
      tileData[key].isFortress = false;
      tileData[key].fortressStrength = t.fortressStrength;
      tileData[key].stubstaffVP = t.stubstaffVP;
    }
  }
}

function _applyUnits(startingUnits) {
  // Clear the live units array
  units.length = 0;

  for (const u of startingUnits) {
    const unit = {
      faction:        u.faction,
      row:            u.row,
      col:            u.col,
      startCoords:    [u.row, u.col],
      moveSpeed:      u.moveSpeed,
      hasMoved:       false,
      isFleet:        u.isFleet        || false,
      isMercenary:    false,
      forestWalk:     u.forestWalk     || false,
      mountainWalk:   u.mountainWalk   || false,
      isLeader:       u.isLeader       || false,
      combatStrength: u.combatStrength != null ? u.combatStrength : 1,
      siegeStrength:  u.siegeStrength  != null ? u.siegeStrength  : 1,
    };

    // Eaters of Wisdom special props
    if (u.isMagical)         unit.isMagical = true;
    if (u.isEatersOfWisdom)  {
      unit.isEatersOfWisdom = true;
      unit.baseCombatStrength = u.baseCombatStrength;
      unit.hasTakenAFateDieRoll = false;
      unit.spellUsedThisTurn = null;
      unit.spells = u.spells ? { ...u.spells } : { whirlingVortex:0, reflector:0, mistOfGroping:0, theBridge:0, enchantedCastle:0 };
      unit.mistActive = false;
      unit.mistActiveTurn = null;
      unit.enchantedCastleActive = false;
      unit.bridgeActive = false;
    }

    // Black Hand special props
    if (u.isBlackHand) {
      unit.isBlackHand = true;
      unit.wraithsUsedTurn = 0;
      unit.wingsUsedTurn = 0;
    }
    if (u.isGuardian) {
      unit.isGuardian = true;
      unit.guardianActive = true;
      unit.isImmovable = true;
    }
    if (u.isTheDead) unit.isTheDead = true;
    if (u.isUndead)  unit.isUndead = true;
    if (u.isColossus) unit.isColossus = true;

    // Nomadic units (not placed on map at start)
    if (u.isNomadic) {
      unit.isNomadic = true;
      unit.row = null;
      unit.col = null;
      unit.startCoords = null;
    }

    // Lepers
    if (u.isLeper) unit.isLeper = true;

    if (unit.isLeader && !unit.isEatersOfWisdom) {
      unit.hasTakenAFateDieRoll = false;
    }

    units.push(unit);
  }
}

// ---------------------------------------------------------------------------
// OPTIONAL TERRITORIAL PRESSURE / MAP PAINTING
// ---------------------------------------------------------------------------
// This is intentionally a visual-control layer only. Changing tile.faction
// recolours the map but does not currently grant income, recruitment, supply,
// victory points, movement rights, or any other gameplay benefit.
//
// Enabled per scenario with rules.canSeizeTerrain. Pressure is sampled once at
// the end of each full round so territory cannot flicker between owners during
// individual faction turns.

function territorialPressureRules() {
  const configured = window.scenarioRules?.territorialPressure || {};
  return {
    requiredRounds: configured.requiredRounds ?? 3,
    requiredLead: configured.requiredLead ?? 2,
    defenderBase: configured.defenderBase ?? 2,
    fortMultiplier: configured.fortMultiplier ?? 3,
    capitalPressure: configured.capitalPressure ?? 3,
    cityPressure: configured.cityPressure ?? 2,
    adjacentFortFactor: configured.adjacentFortFactor ?? 0.5,
    adjacentCityFactor: configured.adjacentCityFactor ?? 0.5,
  };
}

function addTerritorialPressure(pressureByTile, key, faction, amount) {
  if (!faction || faction === "none" || !tileData[key] || !(amount > 0)) return;
  if (!pressureByTile[key]) pressureByTile[key] = {};
  pressureByTile[key][faction] = (pressureByTile[key][faction] || 0) + amount;
}

function updateTerritorialPressure() {
  if (!window.scenarioRules?.canSeizeTerrain) return [];

  const rules = territorialPressureRules();
  const pressureByTile = {};

  // Existing control has inertia: a challenger needs a sustained, meaningful
  // advantage rather than momentarily matching the defender.
  for (const [key, tile] of Object.entries(tileData)) {
    if (tile.faction && tile.faction !== "none") {
      addTerritorialPressure(pressureByTile, key, tile.faction, rules.defenderBase);
    }
  }

  // Land armies exert pressure on the hex they physically occupy. Every real
  // land counter contributes at least 1; stronger armies contribute more.
  for (const unit of units) {
    if (!unit || unit.isFleet || unit.isNomadic || unit.row == null || unit.col == null) continue;
    const key = `${unit.row},${unit.col}`;
    const strength = Math.max(1, Number(unit.combatStrength) || 0);
    addTerritorialPressure(pressureByTile, key, unit.faction, strength);
  }

  // Forts and settlements anchor control locally and exert weaker pressure on
  // adjoining countryside. Capitals count as settlements even before a more
  // detailed city system exists.
  for (const [key, tile] of Object.entries(tileData)) {
    const faction = tile.faction;
    if (!faction || faction === "none") continue;

    const fortPressure = tile.isFortress && (tile.fortressStrength || 0) > 0
      ? (tile.fortressStrength || 0) * rules.fortMultiplier
      : 0;
    const settlementPressure = tile.isCapital
      ? rules.capitalPressure
      : tile.isCity
        ? (tile.cityStrength ?? rules.cityPressure)
        : 0;

    addTerritorialPressure(pressureByTile, key, faction, fortPressure + settlementPressure);

    if (fortPressure <= 0 && settlementPressure <= 0) continue;
    if (typeof getAdjacentCoords !== "function") continue;

    const [row, col] = key.split(",").map(Number);
    for (const [adjRow, adjCol] of getAdjacentCoords(row, col)) {
      const adjKey = `${adjRow},${adjCol}`;
      if (!tileData[adjKey]) continue;
      addTerritorialPressure(
        pressureByTile,
        adjKey,
        faction,
        fortPressure * rules.adjacentFortFactor + settlementPressure * rules.adjacentCityFactor
      );
    }
  }

  const changed = [];

  for (const [key, tile] of Object.entries(tileData)) {
    const pressures = pressureByTile[key] || {};
    const currentOwner = tile.faction || "none";
    const defenderPressure = currentOwner === "none" ? 0 : (pressures[currentOwner] || 0);

    const challengers = Object.entries(pressures)
      .filter(([faction]) => faction !== currentOwner)
      .sort((a, b) => b[1] - a[1]);

    const [challenger, challengerPressure] = challengers[0] || [];
    const hasClearLead = challenger && challengerPressure >= defenderPressure + rules.requiredLead;

    if (!hasClearLead) {
      delete tile.controlContest;
      continue;
    }

    if (!tile.controlContest || tile.controlContest.faction !== challenger) {
      tile.controlContest = { faction: challenger, rounds: 1 };
    } else {
      tile.controlContest.rounds += 1;
    }
    tile.controlContest.attackerPressure = challengerPressure;
    tile.controlContest.defenderPressure = defenderPressure;

    if (tile.controlContest.rounds >= rules.requiredRounds) {
      const previousFaction = currentOwner;
      tile.faction = challenger;
      delete tile.controlContest;
      changed.push({ key, from: previousFaction, to: challenger });
    }
  }

  return changed;
}

// Hook the generic round transition without changing Divine Right behaviour.
// The wrapper is inert unless the loaded scenario explicitly opts into terrain
// seizure. Installing after window load ensures index.js has defined advanceTurn.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("load", () => {
    if (typeof window.advanceTurn !== "function" || window.advanceTurn._territorialPressureWrapped) return;
    const baseAdvanceTurn = window.advanceTurn;
    const wrappedAdvanceTurn = function(...args) {
      const completingRound = Array.isArray(turnOrder) && turnOrder.length > 0 && currentTurnIndex === turnOrder.length - 1;
      if (completingRound && window.scenarioRules?.canSeizeTerrain) {
        updateTerritorialPressure();
      }
      return baseAdvanceTurn.apply(this, args);
    };
    wrappedAdvanceTurn._territorialPressureWrapped = true;
    window.advanceTurn = wrappedAdvanceTurn;
  });
}
