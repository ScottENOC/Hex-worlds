const terrainIcons = {
  "forest": "🌲",
  "mountain": "⛰️",
"mountain_pass": "⛰️  ⛰️",
  "hills": "〽️",
  "marsh": "🌿"
};

function drawMap() {
  // Clear existing SVG content
  svg.innerHTML = "";
 
  // Get list of currently besieged fortresses
  highlightedTilesByType.siege = Array.from(getBesiegedFortresses()).map(key => {
  const [row, col] = key.split(',').map(Number);
   return [row, col];
  });
 
  // Loop through all rows and columns of the map
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns(row); col++) {
      drawHex(row, col);
    }
  }
}
 
function drawHex(row, col, besiegedFortresses = new Set()) {
  const key = `${row},${col}`;
  const data = tileData[key] || {};
  const faction = data.faction || "none";
  const name = data.name || "";
  const terrainArray = Array.isArray(data.terrain) ? data.terrain : data.terrain ? [data.terrain] : [];
  const isFortress = data.isFortress || false;
  const fortressStrength = data.fortressStrength || "";
 
  const cx = col * horizSpacing + (row % 2 === 0 ? horizSpacing / 2 : 0);
  const cy = row * (vertSpacing * 0.5);
  const corners = Array.from({ length: 6 }, (_, i) => hexCorner(cx, cy, side, i));
  const points = corners.map(p => p.join(',')).join(' ');
 
  // Base hex
  const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hex.setAttribute("points", points);
  hex.setAttribute("fill", factions[faction]);
  hex.classList.add("hex");
  hex.setAttribute("pointer-events", "all");
  hex.dataset.hex = `${row},${col}`;
  svg.appendChild(hex);
 
  // Handle clicks...
  hex.addEventListener("click", () => {
    const clickedHex = `${row},${col}`;
 console.log(`Clicked tile: (${row}, ${col})`);

const offsets = (col % 2 === 0) ? sideOffsetsEven : sideOffsetsOdd;

  const neighbors = offsets.map(([dr, dc], side) => {
    const nr = row + dr;
    const nc = col + dc;
    const neighborKey = `${nr},${nc}`;
    return { side, row: nr, col: nc, exists: tileData[neighborKey] !== undefined };
  });

  console.log(`Neighbors of (${row}, ${col}):`);
  for (const n of neighbors) {
    console.log(`  Side ${n.side}: (${n.row}, ${n.col}) ${n.exists ? "✓" : "✗"}`);
  }


if (currentPhase === "movement") {
  info.innerText = "Movement Phase";
  if (selectedUnit && !selectedUnit.hasMoved) {
    const moves = validMoves(selectedUnit).map(([r, c]) => `${r},${c}`);
    if (moves.includes(clickedHex)) {
      selectedUnit.row = row;
      selectedUnit.col = col;
      selectedUnit.hasMoved = true;

      // Trigger fate roll if unit has combat strength and there are enemy leaders in the destination hex
      if (selectedUnit.combatStrength > 0) {
        const enemyLeaders = units.filter(
          u =>
            u.row === row &&
            u.col === col &&
            u.faction !== selectedUnit.faction &&
            u.isLeader
        );

        for (const leader of enemyLeaders) {
          fateDieRoll(leader);
        }
      }

      selectedUnit = null;
      highlightedTilesByType.movement = [];
      drawMap();
    }
  }
  return;
}
 
    if (currentPhase === "combat-declare") {
  info.innerText = "Combat Declare Phase";
  if (selectedUnit) {
    const targets = getAdjacentEnemies(selectedUnit).map(([r, c]) => `${r},${c}`);
    if (targets.includes(clickedHex)) {
      info.innerText = `Unit at (${selectedUnit.row}, ${selectedUnit.col}) is attacking (${row}, ${col})!`;
      declaredCombats.push({
        attacker: selectedUnit,
        fromHex: { row: selectedUnit.row, col: selectedUnit.col },
        targetHex: { row, col },
      });
      selectedUnit = null;
      highlightedTilesByType.combat = [];
      drawMap();
      return;
    }
  }

  const clickedUnit = units.find(
    u => u.row === row && u.col === col && u.faction === currentFaction);

  if (clickedUnit) {
    selectedUnit = clickedUnit;
    highlightedTilesByType.combat = [];
    const targets = getAdjacentEnemies(clickedUnit);
    highlightTiles(targets, "combat");
    info.innerText = "Selected unit for combat declaration.";
  }
  return;
}
      return;
  });
 
// === MULTI-TYPE HIGHLIGHTS ===
if (highlightedTilesByType) {
 
  for (const [type, tiles] of Object.entries(highlightedTilesByType)) {
      for (const [r, c] of tiles) {
      if (r === row && c === col) {
        const overlay = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        overlay.setAttribute("points", points);
        overlay.setAttribute("pointer-events", "none");
 
        switch (type) {
          case "movement":
            overlay.setAttribute("fill", "rgba(255,255,0,0.3)");
            overlay.setAttribute("stroke", "gold");
            overlay.setAttribute("stroke-width", "1.5");
            break;
          case "combat":
            overlay.setAttribute("fill", "none");
            overlay.setAttribute("stroke", "black");
            overlay.setAttribute("stroke-width", "1.5");
            break;
          case "event":
            overlay.setAttribute("fill", "none");
            overlay.setAttribute("stroke", "green");
            overlay.setAttribute("stroke-width", "2");
            break;
          default:
            overlay.setAttribute("fill", "none");
            overlay.setAttribute("stroke", "red");
            overlay.setAttribute("stroke-dasharray", "2,2");
        }
 
        svg.appendChild(overlay);
      }
    }
  }
}
 
  // Lakes
  const lakes = Array.isArray(data.lakes) ? data.lakes : [];
  for (let side of lakes) {
    const corner1 = corners[side];
    const corner2 = corners[(side + 1) % 6];
    const lake = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    lake.setAttribute("points", [
      [cx, cy].join(','),
      corner1.join(','),
      corner2.join(',')
    ].join(' '));
    lake.setAttribute("fill", "lightblue");
    lake.setAttribute("pointer-events", "none");
    lake.classList.add("lake");
    svg.appendChild(lake);
  }
 
  // Rivers
  const rivers = data.rivers || [];
  for (let side of rivers) {
    const corner1 = corners[side];
    const corner2 = corners[(side + 1) % 6];
    const midX = (corner1[0] + corner2[0]) / 2;
    const midY = (corner1[1] + corner2[1]) / 2;
    const river = document.createElementNS("http://www.w3.org/2000/svg", "line");
    river.setAttribute("x1", cx);
    river.setAttribute("y1", cy);
    river.setAttribute("x2", midX);
    river.setAttribute("y2", midY);
    river.setAttribute("stroke", "blue");
    river.setAttribute("stroke-width", "3");
    river.setAttribute("pointer-events", "none");
    river.classList.add("river");
    svg.appendChild(river);
  }
 
  // Terrain icons
  terrainArray.forEach((terrain, i) => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
    icon.setAttribute("x", cx);
    icon.setAttribute("y", cy - 8 - i * 12);
    icon.setAttribute("font-size", "12px");
    icon.setAttribute("pointer-events", "none");
    icon.classList.add("terrain-icon");
    icon.textContent = terrainIcons[terrain] || "";
    svg.appendChild(icon);
  });
 
  // Fortress
  if (isFortress) {
    const isBesieged = besiegedFortresses.has(`${row},${col}`);
 
    const castle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    castle.setAttribute("x", cx);
    castle.setAttribute("y", cy - 12);
    castle.setAttribute("font-size", "14px");
    castle.setAttribute("pointer-events", "none");
    castle.classList.add("fortress-icon");
    castle.textContent = isBesieged ? "🔥" : "🏰";
    svg.appendChild(castle);
 
    const fortressLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    fortressLabel.setAttribute("x", cx);
    fortressLabel.setAttribute("y", cy + 2);
    fortressLabel.setAttribute("pointer-events", "none");
    fortressLabel.classList.add("fortress-name");
    fortressLabel.textContent = name;
    svg.appendChild(fortressLabel);
 
    const fortressNumber = document.createElementNS("http://www.w3.org/2000/svg", "text");
    fortressNumber.setAttribute("x", cx);
    fortressNumber.setAttribute("y", cy + 10);
    fortressNumber.setAttribute("pointer-events", "none");
    fortressNumber.classList.add("fortress-number");
    fortressNumber.textContent = fortressStrength;
    svg.appendChild(fortressNumber);
 
if (isBesieged) {
  const outline = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  outline.setAttribute("points", points);
  outline.setAttribute("fill", "none");
  outline.setAttribute("stroke", "red");
  outline.setAttribute("stroke-width", "50");
  outline.setAttribute("pointer-events", "none");
  outline.classList.add("besieged-outline");
  svg.appendChild(outline);
}

  }
 
  // Tile name (non-fortress)
  if (name && !isFortress) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", cx);
    label.setAttribute("y", cy + 4);
    label.setAttribute("font-size", "6px");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("pointer-events", "none");
    label.classList.add("tile-name");
    label.textContent = name;
    svg.appendChild(label);
  }
 
  // === UNIT DRAWING (new logic using separate function) ===
  drawUnitsInHex(row, col, cx, cy, lakes);
}
 
function drawUnitsInHex(row, col, cx, cy, lakes) {
  const hexUnits = units.filter(u => u.row === row && u.col === col);
  if (hexUnits.length === 0) return;
 
  const lakeSet = new Set(lakes || []);
  const landSlices = [0, 1, 2, 3].filter(s => !lakeSet.has(s));
  const fleetSlices = [...lakeSet];
 
  const landUnits = hexUnits.filter(u => !u.isFleet);
  const fleetUnits = hexUnits.filter(u => u.isFleet);
 
  const sliceAngle = Math.PI / 3;
  const baseRadius = side * 0.65;
  const layerSpacing = 10;
 
  const drawUnit = (unit, angle, radius, shape) => {
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const unitIndex = units.indexOf(unit);
 
    let element;
    if (shape === "circle") {
      element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      element.setAttribute("cx", x);
      element.setAttribute("cy", y);
      element.setAttribute("r", 8);
    } else {
      const size = 10;
      const points = [
        [x, y - size],
        [x - size * 0.8, y + size * 0.6],
        [x + size * 0.8, y + size * 0.6],
      ].map(p => p.join(",")).join(" ");
      element = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      element.setAttribute("points", points);
    }
 
    element.setAttribute("fill", factions[unit.faction]);

if (unit.isMercenary) {
  element.setAttribute("stroke", "#000"); // black stroke to highlight
  element.setAttribute("stroke-width", "2");
  element.setAttribute("stroke-dasharray", "3,1"); // dashed border to indicate mercenary
} else {
  element.setAttribute("stroke", "black");
  element.setAttribute("stroke-width", "1");
}
    element.classList.add("unit");
    element.dataset.unitIndex = unitIndex;
    if (unit.hasMoved) element.classList.add("faded");
 
    element.addEventListener("click", e => {
  e.stopPropagation();
 
 
  if (turnOrder[currentTurnIndex] !== unit.faction) {
    alert("Not this faction's turn.");
    return;
  }
 
  if (unit.hasMoved) {
    alert("Unit has already moved.");
    return;
  }
 
  selectedUnit = unit;
 
if (currentPhase === "movement") {
    const movementTiles = validMoves(unit);
    highlightTiles(movementTiles, "movement");
  }

  if (currentPhase === "combat-declare") {
    const targets = getAdjacentEnemies(unit);
    highlightTiles(targets, "combat");
  }
});
 
    svg.appendChild(element);

 if (unit.isLeader) {
  const crown = document.createElementNS("http://www.w3.org/2000/svg", "text");
  crown.setAttribute("x", x);
  crown.setAttribute("y", y - 4); // Slightly above the unit
  crown.setAttribute("text-anchor", "middle");
  crown.setAttribute("font-size", "12px");
  crown.setAttribute("pointer-events", "none");
  crown.textContent = "👑";
  svg.appendChild(crown);
}

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y + 3);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10px");
    label.setAttribute("pointer-events", "none");
    label.classList.add("unit-label");
    label.textContent = unit.moveSpeed;
    svg.appendChild(label);
  };
 
  const placeUnits = (units, slices, shape) => {
    let layer = 0, index = 0;
    const maxPerLayer = slices.length;
 
    while (index < units.length) {
      const radius = baseRadius - layer * layerSpacing;
      for (let i = 0; i < maxPerLayer && index < units.length; i++) {
        const slice = slices[i];
        const angle = sliceAngle * (slice + 0.5);
        drawUnit(units[index], angle, radius, shape);
        index++;
      }
      layer++;
    }
  };
 
  placeUnits(landUnits, landSlices, "circle");
  placeUnits(fleetUnits, fleetSlices, "triangle");
}
 
function highlightTiles(tiles, type = "movement") {
highlightedTilesByType[type] = tiles;
  drawMap();
}
 
 
function showValidMovesOrCombat(unit) {
  alert(`Called showValidMovesOrCombat for ${unit.faction}`);
  const tileList = currentPhase === "movement"
    ? validMoves(unit)
    : currentPhase === "combat-declare"
      ? getAdjacentEnemies(unit)
      : [];
 
  highlightedTiles = tileList;
  alert(`Found ${tileList.length} valid tiles for ${unit.faction}`);
 
  highlightTiles(tileList, currentPhase === "movement" ? "movement" : "combat");
}