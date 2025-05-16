const svg = document.getElementById("map");
const info = document.getElementById("info");
const turnInfo = document.getElementById("turnInfo");

svg.setAttribute("width", 2800);
svg.setAttribute("height", 2000);

initializeMap();

//drawMap();
// updateTurnInfo();
initGame();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(() => console.log('Service Worker registered!'))
    .catch(err => console.error('Service Worker registration failed:', err));
}

function initGame() {
  turnOrder = [...factionList];
  shuffle(turnOrder);
  currentTurnIndex = 0;
  drawMap();
  updateTurnInfo();
  updateVPInfo();
}

// ---------------------------
// END TURN FUNCTION BELOW
// ---------------------------
function endTurn() {
  const currentFaction = turnOrder[currentTurnIndex];

  // Reset unit movement state for current faction at the end of each phase
  for (let unit of units) {
    if (unit.faction === currentFaction) {
      unit.hasMoved = false;
    }
  }

  if (currentPhase === "event") {
    handleEventPhase(currentFaction);
    return;
  }

if (currentPhase === "siege") {
  const besiegedFortresses = getBesiegedFortresses();

  for (let hex of besiegedFortresses) {
    const [row, col] = hex.split(",").map(Number);
    const tileKey = `${row},${col}`;
    const tile = tileData[tileKey];

    if (!tile?.isFortress) continue;

    if (tile.faction === currentFaction) {
      alert(`Skipping fortress at (${row}, ${col}) — it's the defender's turn.`);
      continue;
    }

    const adjacentCoords = getAdjacentCoords(row, col);

    const adjacentAttackers = units.filter(
      u =>
        u.faction === currentFaction &&
        adjacentCoords.some(([r, c]) => u.row === r && u.col === c)
    );

    if (adjacentAttackers.length === 0) {
      alert(`Skipping fortress at (${row}, ${col}) — no adjacent attackers.`);
      continue;
    }

    const defendersInFortress = units.filter(
      u => u.faction === tile.faction && u.row === row && u.col === col
    );

    let attackerStrength = 0;
    for (const unit of adjacentAttackers) {
      attackerStrength += unit.siegeStrength || 0;
    }

    let defenderStrength = tile.fortressStrength || 0;
    for (const unit of defendersInFortress) {
      defenderStrength += unit.siegeStrength || 0;
    }

    const bonus = Math.max(0, Math.floor(attackerStrength / defenderStrength) - 1);

    const roll = Math.ceil(Math.random() * 6);
    const total = roll + bonus;

    alert(`Siege roll for fortress at (${row}, ${col}): d6 roll = ${roll}, bonus = ${bonus}, total = ${total}`);

    if (total >= 6) {
      alert(`Fortress at (${row}, ${col}) will fall.`);

      // Remove only non-leader defenders
      for (let unit of defendersInFortress) {
        if (!unit.isLeader) {
          removeUnitFromMap(unit);
        }
      }

      // Apply fate die roll to any remaining leaders
      for (let unit of defendersInFortress) {
        if (unit.isLeader) {
          fateDieRoll(unit);
        }
      }

      // Award victory points
      const vpAwarded = 5 * (tile.fortressStrength || 1);
      addVictoryPoints(currentFaction, vpAwarded);
      updateVPInfo();

      // Fortress strength drops to 0
      tileData[tileKey].fortressStrength = 0;
      alert(`Fortress strength at (${row}, ${col}) reduced to 0.`);
      alert(`Fortress at (${row}, ${col}) has fallen!`);

      // Move adjacent attackers into the fortress
      for (let attacker of adjacentAttackers) {
        attacker.row = row;
        attacker.col = col;
      }
    }
  }

  currentPhase = "movement";
  drawMap();
  updateTurnInfo();
  return;
}

  if (currentPhase === "movement") {
    currentPhase = "combat-declare";
    updateTurnInfo();
    return;
  }

  if (currentPhase === "combat-declare") {
    currentPhase = "combat-resolve";

    if (declaredCombats.length === 0) {
      endTurn();
      return;
    }

    startCombatResolution();
    updateTurnInfo();
    return;
  }

  if (currentPhase === "combat-resolve") {
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;

    if (currentTurnIndex === 0) {
      if (turnNumber === maxTurns) {
        let entries = Object.entries(victoryPoints);
        entries.sort((a, b) => b[1] - a[1]);
        const [winner, score] = entries[0];
        alert(`The game has ended! ${winner} wins with ${score} VP.`);
      }
      turnNumber++;
    }
// Reset leader fate die roll flags
for (let unit of units) {
  if (unit.isLeader) {
    unit.hasTakenAFateDieRoll = false;
  }
}


    currentPhase = "event";
    declaredCombats = [];
    selectedUnit = null;

    drawMap();
    updateTurnInfo();
  }
}