function saveGameToLocalStorage() {
  const gameState = {
    units,
    tileData,
    turnOrder,
    currentTurnIndex,
    turnNumber,
    mercenaryReserve,
    reserves,
    victoryPoints,
  };

  localStorage.setItem('myGameSave', JSON.stringify(gameState));
  alert("Game saved to local storage.");
}

function loadGameFromLocalStorage() {
  const saved = localStorage.getItem('myGameSave');
  if (!saved) {
    alert("No save found.");
    return;
  }

  const state = JSON.parse(saved);

  // Restore state
  units = state.units;
  tileData = state.tileData;
  turnOrder = state.turnOrder;
  currentTurnIndex = state.currentTurnIndex;
  turnNumber = state.turnNumber;
  mercenaryReserve = state.mercenaryReserve;
  reserves = state.reserves;
  victoryPoints = state.victoryPoints;

  drawMap(); // or your full redraw/refresh function
  updateTurnInfo(); // if needed
  alert("Game loaded from local storage.");
}
function fateDieRoll(unit) {
  if (!unit.isLeader || unit.hasTakenAFateDieRoll) return;

  unit.hasTakenAFateDieRoll = true;

  const roll = Math.ceil(Math.random() * 6);
  alert(`Leader fate die roll for ${unit.faction}: ${roll}`);

  if (roll !== 1 && roll !== 6) return;

  // Leader dies
  alert(`${unit.faction}'s leader has perished!`);

  // Mark faction as eliminated
  eliminatedFactions.add(unit.faction);

  // Remove leader from board
  removeUnitFromMap(unit);

  // Move all faction mercenaries to reserve
  for (let u of units.filter(u => u.faction === unit.faction && u.isMercenary)) {
    addToReserve(u);
  }

  // Move all non-mercenaries to home or reserve
  for (let u of units.filter(u => u.faction === unit.faction && !u.isMercenary && !u.isLeader)) {
    const [homeRow, homeCol] = u.startCoords;
    const tileKey = `${homeRow},${homeCol}`;
    const tile = tileData[tileKey];

    const occupiedByEnemy = units.some(
      other => other.row === homeRow && other.col === homeCol && other.faction !== u.faction
    );

    const underSiege = isTileThreatened(homeRow, homeCol, u.faction);

    if (occupiedByEnemy || underSiege) {
      addToReserve(u);
    } else {
      u.row = homeRow;
      u.col = homeCol;
    }
  }

  // Award 70 VP
  let responsibleFactions = [];
  if (currentFaction !== unit.faction) {
    responsibleFactions = [currentFaction];
  } else {
    responsibleFactions = units
      .filter(u => u.row === unit.row && u.col === unit.col && u.faction !== unit.faction)
      .map(u => u.faction);
  }

  for (let faction of new Set(responsibleFactions)) {
    addVictoryPoints(faction, 70);
    alert(`${faction} gains 70 VP for killing ${unit.faction}'s leader!`);
  }

  // If it's the dead leader's faction turn, skip it
  if (currentFaction === unit.faction) {
    alert(`${unit.faction}'s turn ends early due to their leader’s death.`);
    endTurn(); // or whatever your turn advance function is
  }

  updateVPInfo();
  drawMap();
}
function handleEventPhase(currentFaction) {
  if (currentFaction === "trolls") {
    handleTrollRegeneration(() => {
      continueEventPhase(currentFaction);
    });
  } else {
    continueEventPhase(currentFaction);
  }
}

function handleTrollRegeneration(callback) {
  const trollReserves = reserves["trolls"] || [];
  const regeneratable = trollReserves.find(u => !u.isMercenary && u.type !== "fleet");

  if (regeneratable) {
    alert("Troll Regeneration: Attempting to regenerate 1 unit from reserve.");
    handleReserveDeployment(1, true, false, () => {
      callback(); // Proceed to event dice roll
    });
  } else {
    alert("Troll Regeneration: No units available to regenerate.");
    callback(); // Proceed immediately
  }
}

function continueEventPhase(currentFaction) {
  const die1 = Math.ceil(Math.random() * 6);
  const die2 = Math.ceil(Math.random() * 6);
  const total = die1 + die2;

  switch (total) {
    case 2:
      alert("Event: Omen - Nothing happens (placeholder).");
      break;

    case 3:
  alert("Event: Storms! Select one of your fleets to eliminate.");
  promptUnitSelection({
    filterFn: u => u.faction === currentFaction && u.type === "fleet" && !u.isLeader,
    onSelect: unit => {
      alert(`Eliminating fleet at (${unit.row}, ${unit.col})`);
      removeUnit(unit);
      currentPhase = "siege";
      updateTurnInfo();
    },
    highlightClass: "selectable-fleet"
  });
  return;

    case 4:
  alert("Event: Mutiny! Select one of your units to eliminate.");
  promptUnitSelection({
    filterFn: u => u.faction === currentFaction && !u.isLeader,
    onSelect: unit => {
      alert(`Eliminating unit at (${unit.row}, ${unit.col})`);
      removeUnit(unit);
      currentPhase = "siege";
      updateTurnInfo();
    },
    highlightClass: "selectable-mutiny"
  });
  return;

    case 5:
      alert("Event: Festival - Nothing happens.");
      break;

    case 6:
      alert("Event: Supply Drop! Deploy up to 2 reserve units to their original positions.");
      handleReserveDeployment(2, true, false, () => {
        currentPhase = "siege";
        updateTurnInfo();
      });
      return;

    case 7:
      alert("Event: Calm settles over the land.");
      break;

    case 8:
      alert("Event: Mercenary Surge! Deploy up to 2 mercenaries to their original positions.");
      handleReserveDeployment(2, false, true, () => {
        currentPhase = "siege";
        updateTurnInfo();
      });
      return;

    case 9:
  alert("Event: Plague! Select one of your units to eliminate.");
  promptUnitSelection({
    filterFn: u => u.faction === currentFaction && !u.isLeader,
    onSelect: unit => {
      alert(`Eliminating unit at (${unit.row}, ${unit.col})`);
      removeUnit(unit);
      currentPhase = "siege";
      updateTurnInfo();
    },
    highlightClass: "selectable-mutiny"
  });
  return;

    case 10:
      alert("Event: Tactical Opportunity! Deploy 1 unit (regular or mercenary) to its original position.");
      handleReserveDeployment(1, true, true, () => {
        currentPhase = "siege";
        updateTurnInfo();
      });
      return;

    case 11:
  alert("Event: Mercenary desertion! Select one of your mercenaries to eliminate.");
  promptUnitSelection({
    filterFn: u => u.faction === currentFaction && u.isMercenary && !u.isLeader,
    onSelect: unit => {
      alert(`Eliminating mercenary at (${unit.row}, ${unit.col})`);
      removeUnit(unit);
      currentPhase = "siege";
      updateTurnInfo();
    },
    highlightClass: "selectable-merc"
  });
  return;

    case 12:
      alert("Event: Heroic Surge - Nothing happens.");
      break;
  }

  // Only reached for instant events (not requiring async handling)
  currentPhase = "siege";
  updateTurnInfo();
}

function highlightHex(hexId, className) {
    const el = document.getElementById(`hex-${hexId}`);
    if (el) el.classList.add(className);
}
 
function clearHighlights(className) {
    document.querySelectorAll(`.${className}`).forEach(el => el.classList.remove(className));
}

function promptUnitSelection({ filterFn, onSelect, highlightClass = "selectable" }) {
  let found = false;

  document.querySelectorAll("circle.unit").forEach(el => {
    const idx = +el.dataset.unitIndex;
    const unit = units[idx];

    if (unit && filterFn(unit)) {
      found = true;
      el.classList.add(highlightClass);

      el.addEventListener("click", function handleClick(e) {
        e.stopPropagation();
        onSelect(unit);

        // Cleanup: remove highlight and listeners
        document.querySelectorAll(`.${highlightClass}`).forEach(el => {
          el.classList.remove(highlightClass);
          el.replaceWith(el.cloneNode(true)); // removes all event listeners
        });
      });
    }
  });

  if (!found) {
    alert("No valid units to select.");
currentPhase = "siege";
  updateTurnInfo();
  }
}

function addToReserve(unit) {
  if (!unit) return;

  if (unit.isMercenary) {
    unit.faction = null;
  }

  if (!reserves[unit.faction]) reserves[unit.faction] = [];
  reserves[unit.faction].push({ ...unit });

  const index = units.indexOf(unit);
  if (index !== -1) {
    units.splice(index, 1);
  }
}

function removeRandomUnits(unitsArray, count) {
  const removed = [];
  for (let i = 0; i < count && unitsArray.length > 0; i++) {
    const idx = Math.floor(Math.random() * unitsArray.length);
    const unit = unitsArray[idx];
    addToReserve(unit);
    unitsArray.splice(idx, 1); // keep defenders array synced
    removed.push(unit);
  }
  return removed;
}

function removeUnitsAtLocation(row, col) {
  const removed = [];
  const survivors = [];
  for (let unit of units) {
    if (unit.row === row && unit.col === col) {
      addToReserve(unit);
      removed.push(unit);
    } else {
      survivors.push(unit);
    }
  }
  units.splice(0, units.length, ...survivors);
  return removed;
}

let currentDeploymentHandler = null; // Track the active deployment listener

function handleReserveDeployment(numUnits, allowRegulars, allowMercenaries) {
  alert(`Deploy up to ${numUnits} unit(s) from reserve.`);

  // Remove any existing click handler to avoid stacking
  if (currentDeploymentHandler) {
    svg.removeEventListener("click", currentDeploymentHandler);
    currentDeploymentHandler = null;
  }

  let eligibleUnits = [];
  if (allowRegulars) {
    eligibleUnits = eligibleUnits.concat(
      (reserves[turnOrder[currentTurnIndex]] || []).filter(u => !u.isMercenary)
    );
  }
  if (allowMercenaries) {
    eligibleUnits = eligibleUnits.concat(
      (mercenaryReserves.land || []),
      (mercenaryReserves.fleet || [])
    );
  }
  if (eligibleUnits.length === 0) {
  alert("No eligible units in reserve.");
  highlightedTiles = [];
  drawMap();
  if (typeof onComplete === "function") onComplete();
  return;
}

  const hasRegulars = allowRegulars && eligibleUnits.some(u => !u.isMercenary);
  const hasMercenaries = allowMercenaries && eligibleUnits.some(u => u.isMercenary);

  let highlightedTilesForSpawn = [];
  if (hasRegulars && !hasMercenaries) {
    highlightedTilesForSpawn = eligibleUnits.map(u => u.startCoords);
  } else if (!hasRegulars && hasMercenaries) {
    highlightedTilesForSpawn = getValidMercenarySpawnTiles(turnOrder[currentTurnIndex]);
  } else {
    const regularStarts = eligibleUnits.filter(u => !u.isMercenary).map(u => u.startCoords);
    const mercenaryStarts = getValidMercenarySpawnTiles(turnOrder[currentTurnIndex]);
    highlightedTilesForSpawn = [...regularStarts, ...mercenaryStarts];
  }

  highlightedTiles = highlightedTilesForSpawn;
  drawMap();

  let deployedCount = 0;

  function handleClick(e) {
    const hexId = e.target.dataset.hex;
    if (!hexId) return;

    const [row, col] = hexId.split(",").map(Number);

const unitsHere = units.filter(u => u.row === row && u.col === col && u.isMercenary);

    let unitIndex = eligibleUnits.findIndex(u =>
      !u.isMercenary &&
      u.startCoords &&
      u.startCoords[0] === row &&
      u.startCoords[1] === col
    );

    if (unitIndex === -1) {
      const isValidMercTile = getValidMercenarySpawnTiles(turnOrder[currentTurnIndex])
        .some(([r, c]) => r === row && c === col);

      if (!isValidMercTile) {
        alert("Invalid placement.");
        return;
      }

      unitIndex = eligibleUnits.findIndex(u => u.isMercenary);
      if (unitIndex === -1) {
        alert("No available mercenaries.");
        return;
      }
    }

    const unit = eligibleUnits.splice(unitIndex, 1)[0];

    unit.row = row;
    unit.col = col;
    unit.faction = turnOrder[currentTurnIndex];

    if (unit.isMercenary) {
removeFromMercenaryReserve(unit);
    } else {
      reserves[turnOrder[currentTurnIndex]] = eligibleUnits.filter(u => !u.isMercenary);
    }

    units.push(unit);
deployedCount++;

const updatedUnitsHere = units.filter(u => u.row === row && u.col === col && u.isMercenary);

    alert(`Deployed ${unit.isMercenary ? "mercenary" : "regular"} to (${row}, ${col})`);

    if (deployedCount >= numUnits || eligibleUnits.length === 0) {
      svg.removeEventListener("click", handleClick);
      currentDeploymentHandler = null;
      highlightedTiles = [];
      currentPhase = "siege";
      updateTurnInfo();
      drawMap();
    } else {
      const remainingRegulars = eligibleUnits.filter(u => !u.isMercenary);
      const remainingMercs = eligibleUnits.filter(u => u.isMercenary);
      highlightedTiles = [
        ...remainingRegulars.map(u => u.startCoords),
        ...(remainingMercs.length ? getValidMercenarySpawnTiles(turnOrder[currentTurnIndex]) : [])
      ];
      drawMap();
    }
  }

  currentDeploymentHandler = handleClick;
  svg.addEventListener("click", handleClick);
}

function removeFromMercenaryReserve(unit) {
  const list = unit.isFleet ? mercenaryReserves.fleet : mercenaryReserves.land;

  const index = list.indexOf(unit);
  if (index !== -1) {
    list.splice(index, 1);
  }
}

function describeUnit(unit) {
  if (!unit) return "None";
  return `isFleet: ${unit.isFleet}, Faction: ${unit.faction || "none"}, ` +
         `Row: ${unit.row ?? "?"}, Col: ${unit.col ?? "?"}`;
}

function getValidMercenarySpawnTiles(faction) {
  const validTiles = [];

  for (const key in tileData) {
    const tile = tileData[key];
    if (tile.isFortress && tile.faction === faction) {
      const [row, col] = key.split(",").map(Number);
      const adjacentEnemies = getAdjacentEnemies(row, col, faction);

      if (adjacentEnemies.length === 0) {
        validTiles.push([row, col]);
      }
    }
  }
  return validTiles;
}

function removeUnit(unit) {
  const idx = units.indexOf(unit);
  if (idx !== -1) {
    units.splice(idx, 1);
    if (unit.faction && !reserves[unit.faction]) {
      reserves[unit.faction] = [];
    }
    if (unit.faction) {
      reserves[unit.faction].push({ ...unit, faction: unit.isMercenary ? undefined : unit.faction });
    }
    drawMap(); // Refresh the map after removing the unit
  }
}

function spawnUnitFromReserve(unit, row, col) {
  unit.row = row;
  unit.col = col;
  units.push(unit);
}

function promptUnitElimination(faction, message, callback) {
  document.querySelectorAll("circle.unit").forEach(el => {
    const idx = +el.dataset.unitIndex;
    if (units[idx]?.faction === faction) {
      el.classList.add("selectable-mutiny");

      el.addEventListener("click", function handleEliminationClick(e) {
        e.stopPropagation();
        const unit = units[idx];
        if (!unit) return;

        alert(`${message} at (${unit.row}, ${unit.col})`);
        removeUnit(unit);

        // Clean up all handlers
        document.querySelectorAll(".selectable-mutiny").forEach(el => {
          el.classList.remove("selectable-mutiny");
          el.replaceWith(el.cloneNode(true));
        });

        callback();  // move to next phase or whatever
      });
    }
  });
}

function getAdjacentHexes(row, col) {
  const directionsEven = [
    [-1,  0], [0,  1], [1,  0],
    [1, -1], [0, -1], [-1, -1]
  ];

  const directionsOdd = [
    [-1,  1], [0,  1], [1,  1],
    [1,  0], [0, -1], [-1,  0]
  ];

  const isOdd = col % 2 === 1;
  const directions = isOdd ? directionsOdd : directionsEven;

  return directions.map(([dr, dc]) => [row + dr, col + dc]);
}

const side = 30;
    const horizSpacing = side * 1.5 * 1.12;
    const vertSpacing = side * Math.sqrt(3) * 1.82;
 
    const rows = 31;
    const columns = row => row % 2 === 0 ? 34 : 35;
 
const evenRowDirs = [
  [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, 0], [1, 1]
];
 
const oddRowDirs = [
  [-1, -1], [-1, 0], [0, -1],
  [0, 1], [1, -1], [1, 0]
];

// Pointy-topped, odd-q offset layout
const sideOffsetsEven = [
  [0, 1],    // 0: right
  [1, 1],    // 1: bottom-right
  [1, 0],   // 2: bottom-left
  [0, -1],   // 3: left
  [-1, 0],  // 4: top-left
  [-1, 1]    // 5: top-right
];

const sideOffsetsOdd = [
  [0, 1],    // 0: right
  [1, 0],    // 1: bottom-right
  [1, -1],    // 2: bottom-left
  [0, -1],   // 3: left
  [-1, -1],   // 4: top-left
  [-1, 0]    // 5: top-right
];

function getAdjacentCoords(row, col) {
  const isOdd = col % 2 === 1;

  const directions = isOdd
    ? [
        [-1, 0],  // top-left
        [-1, 1],  // top-right
        [0, -1],  // left
        [0, 1],   // right
        [1, 0],   // bottom-left
        [1, 1],   // bottom-right
      ]
    : [
        [-1, -1], // top-left
        [-1, 0],  // top-right
        [0, -1],  // left
        [0, 1],   // right
        [1, -1],  // bottom-left
        [1, 0],   // bottom-right
      ];

  return directions.map(([dr, dc]) => [row + dr, col + dc]);
}

function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

function hexCorner(cx, cy, size, i) {
      const angle_deg = 60 * i - 30;
      const angle_rad = Math.PI / 180 * angle_deg;
      return [
        cx + size * Math.cos(angle_rad),
        cy + size * Math.sin(angle_rad)
      ];
    }
 
function neighbor(row, col, dir) {
  const directions = (row % 2 === 0) ? evenRowDirs : oddRowDirs;
  const [dr, dc] = directions[dir];
  return [row + dr, col + dc];
}
 
function getAdjacentEnemies(unit) {
  const adjacent = [];
  const directions = (unit.row % 2 === 0) ? evenRowDirs : oddRowDirs;
 
  for (let [dr, dc] of directions) {
    const nr = unit.row + dr;
    const nc = unit.col + dc;
    const key = `${nr},${nc}`;
 
    if (tileData[key] && enemyAt(nr, nc, unit.faction)) {
      adjacent.push([nr, nc]);
    }
  }
 
  return adjacent;
}

function areAdjacent(row1, col1, row2, col2) {
  const directionsEven = [
    [-1, 0], [-1, +1],
    [0, -1], [0, +1],
    [+1, 0], [+1, +1],
  ];

  const directionsOdd = [
    [-1, -1], [-1, 0],
    [0, -1], [0, +1],
    [+1, -1], [+1, 0],
  ];

  const directions = row1 % 2 === 0 ? directionsEven : directionsOdd;

  for (const [dr, dc] of directions) {
    if (row1 + dr === row2 && col1 + dc === col2) {
      return true;
    }
  }

  return false;
}

function getBesiegedFortresses() {
  const besieged = new Set();

  for (const key in tileData) {
    const tile = tileData[key];
    if (!tile?.isFortress) continue;

    const [row, col] = key.split(',').map(Number);
    const adjacents = getAdjacentHexes(row, col);
    const defenderFaction = tile.faction;
    const fortressStrength = tile.fortressStrength || 0;

    // Track which tiles are threatened
    const threatenedTiles = new Set();

    for (const unit of units) {
      if (unit.faction === defenderFaction) continue;
      if (unit.siegeStrength <= 0) continue; // Only threatening units

      // Only project threat if adjacent to the fortress
      const dr = Math.abs(unit.row - row);
      const dc = Math.abs(unit.col - col);
      if (dr <= 1 && dc <= 1) {
        threatenedTiles.add(`${unit.row},${unit.col}`);

        const neighbors = getAdjacentHexes(unit.row, unit.col);
        for (const [r, c] of neighbors) {
          if (areAdjacent(r, c, row, col)) {
            threatenedTiles.add(`${r},${c}`);
          }
        }
      }
    }

    // Check if all fortress-adjacent tiles are threatened
    const allAdjThreatened = adjacents.every(([r, c]) => {
      const k = `${r},${c}`;
      return !tileData[k] || threatenedTiles.has(k); // undefined = threatened
    });

    if (!allAdjThreatened) continue;

    // Count attacker strength: enemy units with siegeStrength > 0 adjacent to fortress
    const attackerStrength = units.filter(u =>
      u.faction !== defenderFaction &&
      u.siegeStrength > 0 &&
      areAdjacent(u.row, u.col, row, col)
    ).length;

    // Count defenders inside fortress
    const defendersInFort = units.filter(u =>
      u.faction === defenderFaction &&
      u.row === row && u.col === col
    ).length;

    const defenderTotal = defendersInFort + fortressStrength;

    if (attackerStrength > defenderTotal) {
      besieged.add(`${row},${col}`);
    }
  }

  return besieged;
}

function getTileCost(row, col, unit) {
  const key = `${row},${col}`;
  const data = tileData[key];
  if (!data) return Infinity; // off-map or undefined tile

  if (unit?.isFleet) return 1; // Fleets ignore terrain penalties

  const terrainList = Array.isArray(data.terrain) ? data.terrain : [data.terrain];
  const riversList = Array.isArray(data.rivers) ? data.rivers : [];

  // Assume default movement cost
  let maxCost = 1;

  const isFriendly = unit && !unit.isMercenary && unit.faction === data.faction;

  for (let terrain of terrainList) {
    if (terrain === "mountain") {
        maxCost = Math.max(maxCost, 3);
      
    } else if (terrain === "forest") {
      if (unit?.forestWalk || isFriendly) {
        maxCost = Math.max(maxCost, 1);
      } else {
        maxCost = Math.max(maxCost, 2);
      }
    } else if (terrain === "hills") {
      if (unit?.mountainWalk || isFriendly) {
        maxCost = Math.max(maxCost, 1);
      } else {
        maxCost = Math.max(maxCost, 2);
      }
    } else if (["marsh", "mountain_pass"].includes(terrain)) {
      maxCost = Math.max(maxCost, 2);
    }
  }

  if (riversList.length > 0) {
    maxCost = Math.max(maxCost, 2);
  }

  return maxCost;
}
 
function enemyAt(row, col, faction) {
  return units.some(u =>
    u.row === row &&
    u.col === col &&
    u.faction !== faction &&
    u.combatStrength > 0
  );
}

function validMoves(unit) {
  const visited = {};
  const result = [];
  const moveSpeed = unit.moveSpeed;
  const isFleet = unit.isFleet;

  function hasLakeOnSide(row, col, side) {
    const tile = tileData[`${row},${col}`];
    if (!tile || !tile.lakes) return false;
    return tile.lakes.includes(side);
  }

  function isPassableBetween(r1, c1, r2, c2) {
    const dirs = (r1 % 2 === 0) ? sideOffsetsEven : sideOffsetsOdd;
    const side = dirs.findIndex(([dr, dc]) => r1 + dr === r2 && c1 + dc === c2);
    if (side === -1) return false;

    const reverseSide = (side + 3) % 6;

    const hasLake1 = hasLakeOnSide(r1, c1, side);
    const hasLake2 = hasLakeOnSide(r2, c2, reverseSide);

    const passable = isFleet ? (hasLake1 && hasLake2) : (!hasLake1 && !hasLake2);

    return passable;
  }

function dfs(r, c, mp, cameFromMountain = false) {
  const key = `${r},${c}`;
  // 1) Basic bounds / MP checks
  if (!tileData[key] || mp < 0) return;

  // 2) "Came from a mountain with >0 MP left" blocks any further moves
  if (cameFromMountain && mp > 0) return;

  // 3) Mountain-blocking: you cannot enter a mountain and then keep moving
  const isMountain = tileData[key].terrain === "mountain";
  if (isMountain && mp > 0) return;

  // 4) Now your visited check: only skip if we've been here with at least as much MP
  if (visited[key] !== undefined && visited[key] >= mp) return;

  // 5) **Finally** mark it visited
  visited[key] = mp;

  // 6) Record as a valid move if it isn’t the start and has no enemy
  if (!(r === unit.row && c === unit.col) && !enemyAt(r, c, unit.faction)) {
    result.push([r, c]);
  }

  // 7) Explore neighbors (only called from here, i.e. only for actually entered tiles)
  const directions = (r % 2 === 0) ? sideOffsetsEven : sideOffsetsOdd;
  for (let [i, [dr, dc]] of directions.entries()) {
    const nr = r + dr;
    const nc = c + dc;
    const nextKey = `${nr},${nc}`;
    if (!tileData[nextKey]) continue;
    if (enemyAt(nr, nc, unit.faction)) continue;
    if (!isPassableBetween(r, c, nr, nc)) continue;

    const cost = getTileCost(nr, nc, unit);
    if (mp - cost >= 0) {
      dfs(nr, nc, mp - cost, isMountain);
    }
  }
}

  dfs(unit.row, unit.col, moveSpeed);
  return result;
}

function updateTurnInfo() {
  let phaseText = "";

  switch (currentPhase) {
    case "event":
      phaseText = "EVENT Phase";
      break;
    case "siege":
      phaseText = "SIEGE Phase";
      break;
    case "movement":
      phaseText = "MOVEMENT Phase";
      break;
    case "combat-declare":
      phaseText = "COMBAT DECLARATION Phase";
      break;
    case "combat-resolve":
      phaseText = "COMBAT RESOLUTION Phase";
      break;
  }


const factionText = turnOrder[currentTurnIndex];


  const textToSet = `Turn ${turnNumber} — ${factionText.toUpperCase()} (${phaseText})`;

  turnInfo.innerText = textToSet;

  const button = document.querySelector("button");
  if (currentPhase === "combat-resolve") {
    button.innerText = "End Turn";
  } else {
    button.innerText = "End Phase";
  }
}

function addVictoryPoints(faction, amount) {
  victoryPoints[faction] = (victoryPoints[faction] || 0) + amount;
  updateVictoryPointDisplay();
}

function updateVPInfo() {
  const entries = Object.entries(victoryPoints)
    .filter(([faction, vp]) => vp > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    vpInfo.innerText = "No victory points awarded yet.";
  } else {
    vpInfo.innerText = entries
      .map(([faction, vp]) => `${faction}: ${vp} VP`)
      .join("\n");
  }
}