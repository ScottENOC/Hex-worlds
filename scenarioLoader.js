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
    if (t.isPort)              tileData[key].isPort = true;
    if (t.isEntryHex)          tileData[key].isEntryHex = t.isEntryHex;
    if (t.isTempleOfKings)     tileData[key].isTempleOfKings = true;
    if (t.isSacredStones)      tileData[key].isSacredStones = true;
    if (t.isAncientBattlefield) tileData[key].isAncientBattlefield = true;
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
