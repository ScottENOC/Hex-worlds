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
  _applyScenarioLocations(scenarioData);
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
      gold[id] = data.rules?.economy?.startingGold ?? 5;
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

function isFullWaterTile(tile) {
  return !!tile && Array.isArray(tile.lakes) && new Set(tile.lakes).size >= 6;
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
    if (isFullWaterTile(tileData[key])) tileData[key].faction = "none";
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

function _nearestScenarioLand(row, col, usedKeys) {
  let best = null;
  for (const [key, tile] of Object.entries(tileData)) {
    if (!tile || isFullWaterTile(tile) || usedKeys.has(key)) continue;
    const distance = Math.abs(tile.row - row) + Math.abs(tile.col - col);
    if (!best || distance < best.distance || (distance === best.distance && key < best.key)) {
      best = { key, tile, distance };
    }
  }
  return best;
}

function _applyScenarioLocations(data) {
  const locations = Array.isArray(data.locations) ? data.locations : [];
  if (!locations.length) return;

  const capitalByFaction = {};
  for (const [key, tile] of Object.entries(tileData)) {
    if (tile?.isCapital && tile.faction && tile.faction !== "none") capitalByFaction[tile.faction] = { key, tile };
  }

  const usedKeys = new Set();
  for (const location of locations) {
    const capital = capitalByFaction[location.faction];
    let row = location.row;
    let col = location.col;
    if (capital && Array.isArray(location.relativeToCapital)) {
      row = capital.tile.row + Number(location.relativeToCapital[0] || 0);
      col = capital.tile.col + Number(location.relativeToCapital[1] || 0);
    }
    if (row == null || col == null) continue;

    let key = `${row},${col}`;
    let tile = tileData[key];
    if (!tile || isFullWaterTile(tile) || usedKeys.has(key)) {
      const nearest = _nearestScenarioLand(row, col, usedKeys);
      if (!nearest) continue;
      key = nearest.key;
      tile = nearest.tile;
    }
    usedKeys.add(key);

    if (location.faction) tile.faction = location.faction;
    if (location.name) tile.name = location.name;
    if (location.isCapital) tile.isCapital = true;
    if (location.isCity !== false) tile.isCity = true;
    if (location.isFortress !== false) tile.isFortress = true;
    if (location.strength != null) {
      tile.fortressStrength = Number(location.strength);
      tile.cityStrength = Number(location.strength);
    }

    // Give established starting locations a small hinterland so the scenario
    // begins with recognisable territorial blobs rather than isolated dots.
    if (location.claimRadius === 1 && location.faction && location.faction !== "none" && typeof getAdjacentCoords === "function") {
      for (const [adjRow, adjCol] of getAdjacentCoords(tile.row, tile.col)) {
        const adj = tileData[`${adjRow},${adjCol}`];
        if (adj && !isFullWaterTile(adj) && adj.faction === "none") adj.faction = location.faction;
      }
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
  if (!faction || faction === "none" || !tileData[key] || isFullWaterTile(tileData[key]) || !(amount > 0)) return;
  if (!pressureByTile[key]) pressureByTile[key] = {};
  pressureByTile[key][faction] = (pressureByTile[key][faction] || 0) + amount;
}

function updateTerritorialPressure() {
  if (!window.scenarioRules?.canSeizeTerrain) return [];

  const rules = territorialPressureRules();
  const pressureByTile = {};

  for (const [key, tile] of Object.entries(tileData)) {
    if (isFullWaterTile(tile)) {
      tile.faction = "none";
      delete tile.controlContest;
      continue;
    }
    if (tile.faction && tile.faction !== "none") {
      addTerritorialPressure(pressureByTile, key, tile.faction, rules.defenderBase);
    }
  }

  for (const unit of units) {
    if (!unit || unit.isFleet || unit.isNomadic || unit.row == null || unit.col == null) continue;
    const key = `${unit.row},${unit.col}`;
    if (isFullWaterTile(tileData[key])) continue;
    const strength = Math.max(1, Number(unit.combatStrength) || 0);
    addTerritorialPressure(pressureByTile, key, unit.faction, strength);
  }

  for (const [key, tile] of Object.entries(tileData)) {
    if (isFullWaterTile(tile)) continue;
    const faction = tile.faction;
    if (!faction || faction === "none") continue;

    const fortPressure = tile.isFortress && (tile.fortressStrength || 0) > 0
      ? (tile.fortressStrength || 0) * rules.fortMultiplier
      : 0;
    const settlementPressure = tile.isCapital
      ? rules.capitalPressure
      : tile.isCity
        ? (tile.cityStrength ?? tile.fortressStrength ?? rules.cityPressure)
        : 0;

    addTerritorialPressure(pressureByTile, key, faction, fortPressure + settlementPressure);

    if (fortPressure <= 0 && settlementPressure <= 0) continue;
    if (typeof getAdjacentCoords !== "function") continue;

    const [row, col] = key.split(",").map(Number);
    for (const [adjRow, adjCol] of getAdjacentCoords(row, col)) {
      const adjKey = `${adjRow},${adjCol}`;
      if (!tileData[adjKey] || isFullWaterTile(tileData[adjKey])) continue;
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
    if (isFullWaterTile(tile)) continue;
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

// ---------------------------------------------------------------------------
// OPTIONAL SIMPLE BOARD-GAME ECONOMY
// ---------------------------------------------------------------------------

function simpleEconomyRules() {
  const configured = window.scenarioRules?.economy || {};
  return {
    enabled: configured.enabled === true,
    tileIncome: configured.tileIncome ?? 1,
    upkeepPerTroop: configured.upkeepPerTroop ?? 1,
    recruitCost: configured.recruitCost ?? 5,
    recruitMoveSpeed: configured.recruitMoveSpeed ?? 5,
  };
}

function cityDefenceValue(tile) {
  if (!tile || !(tile.isCity || tile.isFortress || tile.isCapital)) return 0;
  return Math.max(0, Number(tile.fortressStrength ?? tile.cityStrength ?? 0) || 0);
}

function calculateFactionEconomy(faction) {
  const rules = simpleEconomyRules();
  if (!rules.enabled) return { income: 0, upkeep: 0, net: 0, tiles: 0, cityBonus: 0, troops: 0 };

  let tiles = 0;
  let cityBonus = 0;
  for (const tile of Object.values(tileData)) {
    if (!tile || isFullWaterTile(tile) || tile.faction !== faction) continue;
    tiles += 1;
    cityBonus += cityDefenceValue(tile);
  }
  const troops = units.filter(unit => unit && unit.faction === faction && !unit.isLeader).length;
  const income = tiles * rules.tileIncome + cityBonus;
  const upkeep = troops * rules.upkeepPerTroop;
  return { income, upkeep, net: income - upkeep, tiles, cityBonus, troops };
}

function runSimpleEconomyRound() {
  const rules = simpleEconomyRules();
  if (!rules.enabled) return {};
  const results = {};
  for (const faction of Object.keys(gold)) {
    const result = calculateFactionEconomy(faction);
    gold[faction] = (Number(gold[faction]) || 0) + result.net;
    results[faction] = { ...result, treasury: gold[faction] };
  }
  return results;
}

function canRecruitSimpleTroop(faction, tile) {
  const rules = simpleEconomyRules();
  if (!rules.enabled || !faction || !tile || isFullWaterTile(tile)) return false;
  if (tile.faction !== faction) return false;
  if (!(tile.isCity || tile.isFortress || tile.isCapital)) return false;
  return (Number(gold[faction]) || 0) >= rules.recruitCost;
}

function recruitSimpleTroop(faction, row, col) {
  const rules = simpleEconomyRules();
  const tile = tileData[`${row},${col}`];
  if (!canRecruitSimpleTroop(faction, tile)) return null;
  gold[faction] -= rules.recruitCost;
  const unit = {
    faction,
    row,
    col,
    startCoords: [row, col],
    moveSpeed: rules.recruitMoveSpeed,
    hasMoved: true,
    isFleet: false,
    isMercenary: false,
    isLeader: false,
    combatStrength: 1,
    siegeStrength: 1,
    isRecruited: true,
  };
  units.push(unit);
  return unit;
}

function _appendSimpleEconomyHexInfo(row, col) {
  const rules = simpleEconomyRules();
  if (!rules.enabled || typeof document === "undefined") return;
  const tile = tileData[`${row},${col}`];
  if (!tile || isFullWaterTile(tile)) return;
  const panel = document.getElementById("info");
  if (!panel) return;

  const owner = tile.faction || "none";
  const cityBonus = cityDefenceValue(tile);
  const income = owner === "none" ? 0 : rules.tileIncome + cityBonus;
  const summary = document.createElement("div");
  summary.className = "simple-economy-info";
  summary.textContent = owner === "none" ? "Uncontrolled land" : `Income: ${income} gold (${rules.tileIncome} land${cityBonus ? ` + ${cityBonus} city` : ""})`;
  panel.appendChild(summary);

  const activeFaction = Array.isArray(turnOrder) ? turnOrder[currentTurnIndex] : null;
  if (!activeFaction || tile.faction !== activeFaction || !(tile.isCity || tile.isFortress || tile.isCapital)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `Recruit troop (${rules.recruitCost}g)`;
  button.disabled = !canRecruitSimpleTroop(activeFaction, tile);
  button.addEventListener("click", () => {
    if (!recruitSimpleTroop(activeFaction, row, col)) return;
    if (typeof drawMap === "function") drawMap();
    if (typeof updateTurnInfo === "function") updateTurnInfo();
    if (typeof showHexInfo === "function") showHexInfo(row, col);
  });
  panel.appendChild(button);
}

// Hook generic UI/round transitions. All wrappers are inert unless a scenario
// explicitly opts into the corresponding custom rules.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("load", () => {
    if (typeof window.advanceTurn === "function" && !window.advanceTurn._customRoundWrapped) {
      const baseAdvanceTurn = window.advanceTurn;
      const wrappedAdvanceTurn = function(...args) {
        const completingRound = Array.isArray(turnOrder) && turnOrder.length > 0 && currentTurnIndex === turnOrder.length - 1;
        if (completingRound) {
          if (window.scenarioRules?.canSeizeTerrain) updateTerritorialPressure();
          if (simpleEconomyRules().enabled) runSimpleEconomyRound();
        }
        return baseAdvanceTurn.apply(this, args);
      };
      wrappedAdvanceTurn._customRoundWrapped = true;
      window.advanceTurn = wrappedAdvanceTurn;
    }

    if (typeof window.updateTurnInfo === "function" && !window.updateTurnInfo._simpleEconomyWrapped) {
      const baseUpdateTurnInfo = window.updateTurnInfo;
      const wrappedUpdateTurnInfo = function(...args) {
        const result = baseUpdateTurnInfo.apply(this, args);
        if (simpleEconomyRules().enabled && typeof document !== "undefined") {
          const el = document.getElementById("turnInfo");
          const faction = Array.isArray(turnOrder) ? turnOrder[currentTurnIndex] : null;
          if (el && faction) el.textContent += ` | Gold: ${Number(gold[faction]) || 0}`;
        }
        return result;
      };
      wrappedUpdateTurnInfo._simpleEconomyWrapped = true;
      window.updateTurnInfo = wrappedUpdateTurnInfo;
    }

    if (typeof window.showHexInfo === "function" && !window.showHexInfo._simpleEconomyWrapped) {
      const baseShowHexInfo = window.showHexInfo;
      const wrappedShowHexInfo = function(row, col, ...args) {
        const result = baseShowHexInfo.call(this, row, col, ...args);
        _appendSimpleEconomyHexInfo(row, col);
        return result;
      };
      wrappedShowHexInfo._simpleEconomyWrapped = true;
      window.showHexInfo = wrappedShowHexInfo;
    }
  });
}
