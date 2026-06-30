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

  // Build all SVG elements into a fragment — single DOM insertion avoids per-element reflows
  const frag = document.createDocumentFragment();
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns(row); col++) {
      drawHex(row, col, frag);
    }
  }
  svg.appendChild(frag);
}
 
function drawHex(row, col, container = svg) {
  const key = `${row},${col}`;
  const rawData = tileData[key];                         // undefined = not yet coded
  const data = rawData || {};
  const faction = data.faction || "none";
  const name = data.name || "";
  const terrainArray = Array.isArray(data.terrain) ? data.terrain : data.terrain ? [data.terrain] : [];
  const isFortress = data.isFortress || false;
  const fortressStrength = data.fortressStrength || "";

  const cx = col * horizSpacing + (row % 2 === 0 ? horizSpacing / 2 : 0);
  const cy = row * (vertSpacing * 0.5);
  const corners = Array.from({ length: 6 }, (_, i) => hexCorner(cx, cy, side, i));
  const points = corners.map(p => p.join(',')).join(' ');

  // Uncoded hexes (not in tileData at all) → pale grey so they're visually distinct
  // from coded-but-neutral tiles which keep the tan #d2b48c colour.
  const fillColor = !rawData ? "#d0d0d0" : (kingdomColors[faction] || "#d2b48c");

  // Base hex
  const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hex.setAttribute("points", points);
  hex.setAttribute("fill", fillColor);
  hex.classList.add("hex");
  hex.setAttribute("pointer-events", "all");
  hex.dataset.hex = `${row},${col}`;
  container.appendChild(hex);
 
  // Handle clicks...
  hex.addEventListener("click", () => {
    // Spell/ability targeting intercepts first
    if (typeof handleSpellClick === "function" && handleSpellClick(row, col)) return;
    if (typeof handleBlackHandClick === "function" && handleBlackHandClick(row, col)) return;

    const clickedHex = `${row},${col}`;

    if (currentPhase === "movement") {
      if (selectedUnit && !selectedUnit.hasMoved) {
        const moves = validMoves(selectedUnit).map(([r, c]) => `${r},${c}`);
        if (moves.includes(clickedHex)) {
          if (selectedUnit.combatStrength > 0) {
            const enemyLeaders = units.filter(
              u => u.row === row && u.col === col && u.faction !== selectedUnit.faction && u.isLeader
            );
            for (const leader of enemyLeaders) fateDieRoll(leader);
          }
          selectedUnit.row = row;
          selectedUnit.col = col;
          selectedUnit.hasMoved = true;
          // Reset Bridge after Eaters complete their move
          if (selectedUnit.isEatersOfWisdom && selectedUnit.bridgeActive) {
            selectedUnit.bridgeActive = false;
          }
          // Enchanted Castle collapses when Eaters leave the hex
          if (selectedUnit.isEatersOfWisdom && selectedUnit.enchantedCastleActive) {
            selectedUnit.enchantedCastleActive = false;
          }
          selectedUnit = null;
          highlightedTilesByType.movement = [];
          drawMap();
        }
      }
      showHexInfo(row, col);
      return;
    }

    if (currentPhase === "combat-declare") {
      if (selectedUnit) {
        const targets = getAdjacentEnemies(selectedUnit).map(([r, c]) => `${r},${c}`);
        if (targets.includes(clickedHex)) {
          const fromHex = { row: selectedUnit.row, col: selectedUnit.col };
          const targetHex = { row, col };
          const alreadyDeclared = declaredCombats.some(
            c => c.fromHex.row === fromHex.row && c.fromHex.col === fromHex.col
              && c.targetHex.row === targetHex.row && c.targetHex.col === targetHex.col
          );
          if (!alreadyDeclared) declaredCombats.push({ fromHex, targetHex });
          selectedUnit = null;
          highlightedTilesByType.combat = [];
          drawMap();
          showHexInfo(row, col);
          return;
        }
      }
      const currentFaction = turnOrder[currentTurnIndex];
      const clickedUnit = units.find(u => u.row === row && u.col === col && u.faction === currentFaction);
      if (clickedUnit) {
        selectedUnit = clickedUnit;
        highlightedTilesByType.combat = [];
        highlightTiles(getAdjacentEnemies(clickedUnit), "combat");
      }
      showHexInfo(row, col);
      return;
    }

    // All other phases: just show tile info
    showHexInfo(row, col);
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
 
        container.appendChild(overlay);
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
    container.appendChild(lake);
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
    container.appendChild(river);
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
    container.appendChild(icon);
  });
 
  // Fortress
  if (isFortress) {
    const isBesieged = (highlightedTilesByType.siege || []).some(([r, c]) => r === row && c === col);
 
    const castle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    castle.setAttribute("x", cx);
    castle.setAttribute("y", cy - 12);
    castle.setAttribute("font-size", "14px");
    castle.setAttribute("pointer-events", "none");
    castle.classList.add("fortress-icon");
    castle.textContent = isBesieged ? "🔥" : "🏰";
    container.appendChild(castle);
 
    const fortressLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    fortressLabel.setAttribute("x", cx);
    fortressLabel.setAttribute("y", cy + 2);
    fortressLabel.setAttribute("pointer-events", "none");
    fortressLabel.classList.add("fortress-name");
    fortressLabel.textContent = name;
    container.appendChild(fortressLabel);
 
    const fortressNumber = document.createElementNS("http://www.w3.org/2000/svg", "text");
    fortressNumber.setAttribute("x", cx);
    fortressNumber.setAttribute("y", cy + 10);
    fortressNumber.setAttribute("pointer-events", "none");
    fortressNumber.classList.add("fortress-number");
    fortressNumber.textContent = fortressStrength;
    container.appendChild(fortressNumber);
 
if (isBesieged) {
  const outline = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  outline.setAttribute("points", points);
  outline.setAttribute("fill", "none");
  outline.setAttribute("stroke", "red");
  outline.setAttribute("stroke-width", "50");
  outline.setAttribute("pointer-events", "none");
  outline.classList.add("besieged-outline");
  container.appendChild(outline);
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
    container.appendChild(label);
  }
 
  // === UNIT DRAWING (new logic using separate function) ===
  drawUnitsInHex(row, col, cx, cy, lakes, container);
}

function drawUnitsInHex(row, col, cx, cy, lakes, container = svg) {
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
 
    if (unit.isBarbarian) {
      element.setAttribute("fill", "#8B4513"); // saddle brown — barbarian colour
    } else {
      element.setAttribute("fill", kingdomColors[unit.faction] || "#d2b48c");
    }

if (unit.isMercenary) {
  element.setAttribute("stroke", "#000");
  element.setAttribute("stroke-width", "2");
  element.setAttribute("stroke-dasharray", "3,1"); // dashed border = mercenary
} else if (unit.isBarbarian) {
  element.setAttribute("stroke", "#fff");
  element.setAttribute("stroke-width", "2");
  element.setAttribute("stroke-dasharray", "4,2"); // double-dash = barbarian
} else {
  element.setAttribute("stroke", "black");
  element.setAttribute("stroke-width", "1");
}
    element.classList.add("unit");
    element.dataset.unitIndex = unitIndex;
    if (unit.hasMoved) element.classList.add("faded");
 
    element.addEventListener("click", e => {
      e.stopPropagation();

      // Always show the tile's info panel first
      showHexInfo(unit.row, unit.col);

      // Only allow interaction with the active faction's units
      if (turnOrder[currentTurnIndex] !== unit.faction) return;

      if (unit.hasMoved && currentPhase === "movement") return;

      selectedUnit = unit;

      if (currentPhase === "movement") {
        highlightTiles(validMoves(unit), "movement");
      } else if (currentPhase === "combat-declare") {
        highlightTiles(getAdjacentEnemies(unit), "combat");
      }
    });
 
    container.appendChild(element);

 if (unit.isLeader) {
  const crown = document.createElementNS("http://www.w3.org/2000/svg", "text");
  crown.setAttribute("x", x);
  crown.setAttribute("y", y - 4); // Slightly above the unit
  crown.setAttribute("text-anchor", "middle");
  crown.setAttribute("font-size", "12px");
  crown.setAttribute("pointer-events", "none");
  crown.textContent = "👑";
  container.appendChild(crown);
}

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y + 3);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10px");
    label.setAttribute("pointer-events", "none");
    label.classList.add("unit-label");
    label.textContent = unit.moveSpeed;
    container.appendChild(label);
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
  const tileList = currentPhase === "movement"
    ? validMoves(unit)
    : currentPhase === "combat-declare"
      ? getAdjacentEnemies(unit)
      : [];
  highlightTiles(tileList, currentPhase === "movement" ? "movement" : "combat");
}

function showHexInfo(row, col) {
  const key = `${row},${col}`;
  const data = tileData[key];
  const lines = [];

  // Coordinates
  lines.push(`Hex (${row}, ${col})`);

  if (!data) {
    lines.push("(uncoded — not yet mapped)");
    info.innerText = lines.join('\n');
    return;
  }

  // Name
  if (data.name) lines.push(data.name);

  // Kingdom / faction
  if (data.faction && data.faction !== "none") {
    lines.push(`Kingdom: ${data.faction}`);
  }

  // Fortress
  if (data.isFortress) {
    const besiege = (highlightedTilesByType.siege || []).some(([r, c]) => r === row && c === col)
      ? " — BESIEGED" : "";
    lines.push(`Fortress: strength ${data.fortressStrength || 0}${besiege}`);
  }

  // Special hex notes
  if (data.isTempleOfKings) lines.push('⚑ Temple of Kings — monarchs only, Test of Gods');
  if (data.isEntryHex) lines.push(`★ Entry hex: ${data.isEntryHex}`);
  if (data.isStubstaffKeep) lines.push(`★ Stubstaff Keep — activates when Black Knight deploys`);
  if (data.isAncientBattlefield) lines.push('† Ancient Battlefield');

  // Terrain
  const terrainList = Array.isArray(data.terrain)
    ? data.terrain : data.terrain ? [data.terrain] : [];
  if (terrainList.length) lines.push(`Terrain: ${terrainList.join(', ')}`);

  // Rivers
  const rivers = Array.isArray(data.rivers) ? data.rivers : [];
  if (rivers.length) lines.push(`Rivers: sides ${rivers.join(', ')}`);

  // Lakes / water
  const lakes = Array.isArray(data.lakes) ? data.lakes : [];
  if (lakes.length) lines.push(`Water/coast: sides ${lakes.join(', ')}`);

  // Units present
  const here = units.filter(u => u.row === row && u.col === col);
  if (here.length) {
    lines.push('');
    lines.push(`Troops (${here.length}):`);
    for (const u of here) {
      const kind = u.isFleet ? 'Fleet' : u.isLeader ? 'Leader' : u.isBarbarian ? 'Barbarian' : u.isSpecialMerc ? 'Special' : 'Army';
      const tags = [u.isMercenary ? 'merc' : '', u.isBarbarian ? 'barb' : '', u.isScum ? 'scum' : '', u.isOgsbogg ? '+1siege' : '', u.templeSleep ? 'SLEEPING' : '', u.hasMoved ? 'moved' : ''].filter(Boolean).join(', ');
      lines.push(`  ${u.faction} ${kind}${tags ? ` [${tags}]` : ''}`);
      lines.push(`    Spd ${u.moveSpeed}  Atk ${u.combatStrength}  Siege ${u.siegeStrength || 0}`);
    }
  }

  info.innerText = lines.join('\n');
}